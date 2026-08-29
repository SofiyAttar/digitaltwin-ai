/**
 * Discrete-Event Factory Simulation Engine for DigitalTwin.ai (TypeScript port
 * of core/factory_sim.py). Simulates an 8-station vehicle assembly line with
 * buffers, mixed-model flow, stochastic cycle times, and realistic
 * blocking/starvation dynamics.
 */

import { Environment, SeededRandom, Store, round, type SimEvent } from "./des";
import { LINE_CONFIG, cloneLineStations, type StationConfig } from "./config";

export type EventType =
  | "STATION_ENTER"
  | "STATION_EXIT"
  | "STATION_BLOCKED"
  | "STATION_STARVED"
  | "CHASSIS_COMPLETED";

export interface SimLogEvent {
  timestamp: number;
  event_type: EventType;
  station_id: string;
  vin: string;
  status?: string;
  buffer?: string;
  cycle_time?: number;
  tolerance_drift?: number;
  cumulative_tolerance?: number;
  final_tolerance_score?: number;
}

export type StationStatus = "IDLE" | "BUSY" | "BLOCKED";

export interface LineSnapshot {
  current_time_seconds: number;
  station_status: Record<string, StationStatus>;
  station_active_vin: Record<string, string | null>;
  buffer_levels: Record<string, number>;
  buffer_capacity: number;
  completed_count: number;
  active_count: number;
  event_count: number;
}

export class Chassis {
  station_timestamps: Record<string, { entered?: number; exited?: number; cycle_time?: number }> = {};
  tolerances: Record<string, number> = {};
  cumulative_tolerance_score = 0;
  completed = false;

  constructor(
    public vin: string,
    public variant: string = "Sedan",
  ) {}

  logStationEntry(stationId: string, timestamp: number) {
    this.station_timestamps[stationId] = { ...this.station_timestamps[stationId], entered: timestamp };
  }

  logStationExit(stationId: string, timestamp: number, cycleTime: number) {
    this.station_timestamps[stationId] = {
      ...this.station_timestamps[stationId],
      exited: timestamp,
      cycle_time: cycleTime,
    };
  }

  recordTolerance(stationId: string, deviation: number) {
    this.tolerances[stationId] = deviation;
    this.cumulative_tolerance_score += Math.abs(deviation);
  }
}

export class AssemblyLineSimulation {
  env = new Environment();
  rng: SeededRandom;
  stationsConfig: StationConfig[] = cloneLineStations();
  taktTime = LINE_CONFIG.target_takt_time_seconds;
  conveyorTime = LINE_CONFIG.conveyor_transit_time_seconds;
  bufferCapacity = LINE_CONFIG.max_buffer_capacity;

  buffers: Record<string, Store<Chassis>> = {};
  entryQueue: Store<Chassis>;

  stationStatus: Record<string, StationStatus> = {};
  stationActiveVin: Record<string, string | null> = {};
  eventLog: SimLogEvent[] = [];
  completedChassis: Chassis[] = [];
  activeChassisList: Chassis[] = [];

  bottleneckInjections: Record<string, { multiplier: number; remaining: number }> = {};
  qualityDriftInjections: Record<string, { drift_bias: number; remaining: number }> = {};

  constructor(randomSeed = 42) {
    this.rng = new SeededRandom(randomSeed);
    for (let i = 0; i < this.stationsConfig.length - 1; i++) {
      this.buffers[`B${i + 1}`] = new Store<Chassis>(this.env, this.bufferCapacity);
    }
    this.entryQueue = new Store<Chassis>(this.env);
    for (const st of this.stationsConfig) {
      this.stationStatus[st.id] = "IDLE";
      this.stationActiveVin[st.id] = null;
    }
  }

  injectBottleneck(stationId: string, multiplier = 1.6, numVehicles = 5) {
    this.bottleneckInjections[stationId] = { multiplier, remaining: numVehicles };
  }

  injectQualityDrift(stationId: string, driftBias = 1.5, numVehicles = 10) {
    this.qualityDriftInjections[stationId] = { drift_bias: driftBias, remaining: numVehicles };
  }

  private logEvent(
    eventType: EventType,
    stationId: string,
    vin: string,
    details: Partial<SimLogEvent> = {},
  ) {
    this.eventLog.push({
      timestamp: round(this.env.now, 2),
      event_type: eventType,
      station_id: stationId,
      vin,
      ...details,
    });
  }

  private calculateCycleTime(stationCfg: StationConfig): number {
    let actual = this.rng.gauss(stationCfg.base_cycle_time, stationCfg.variance_std);
    const injection = this.bottleneckInjections[stationCfg.id];
    if (injection && injection.remaining > 0) {
      actual *= injection.multiplier;
      injection.remaining -= 1;
    }
    return Math.max(15.0, round(actual, 2));
  }

  private calculateToleranceDrift(stationCfg: StationConfig): number {
    let deviation = this.rng.gauss(0.0, 0.4);
    const drift = this.qualityDriftInjections[stationCfg.id];
    if (drift && drift.remaining > 0) {
      deviation += drift.drift_bias;
      drift.remaining -= 1;
    }
    return round(deviation, 3);
  }

  private *stationProcess(idx: number): Generator<SimEvent, void, unknown> {
    const stCfg = this.stationsConfig[idx]!;
    const stId = stCfg.id;
    const isFirst = idx === 0;
    const isLast = idx === this.stationsConfig.length - 1;
    const inBuffer = isFirst ? this.entryQueue : this.buffers[`B${idx}`]!;
    const outBuffer = isLast ? null : this.buffers[`B${idx + 1}`];

    for (;;) {
      const wasStarved = inBuffer.items.length === 0;
      const chassis = (yield inBuffer.get()) as Chassis;

      if (!isFirst) {
        if (wasStarved) {
          this.logEvent("STATION_STARVED", stId, chassis.vin, { buffer: `B${idx}` });
        }
        yield this.env.timeout(this.conveyorTime);
      }

      const entryTime = this.env.now;
      chassis.logStationEntry(stId, entryTime);
      this.stationStatus[stId] = "BUSY";
      this.stationActiveVin[stId] = chassis.vin;
      this.logEvent("STATION_ENTER", stId, chassis.vin, { status: "BUSY" });

      const cycleTime = this.calculateCycleTime(stCfg);
      yield this.env.timeout(cycleTime);

      chassis.logStationExit(stId, this.env.now, cycleTime);
      const tol = this.calculateToleranceDrift(stCfg);
      chassis.recordTolerance(stId, tol);

      this.logEvent("STATION_EXIT", stId, chassis.vin, {
        cycle_time: cycleTime,
        tolerance_drift: tol,
        cumulative_tolerance: round(chassis.cumulative_tolerance_score, 3),
      });

      if (isLast || !outBuffer) {
        this.stationStatus[stId] = "IDLE";
        this.stationActiveVin[stId] = null;
        chassis.completed = true;
        this.completedChassis.push(chassis);
        this.logEvent("CHASSIS_COMPLETED", stId, chassis.vin, {
          final_tolerance_score: round(chassis.cumulative_tolerance_score, 3),
        });
      } else {
        if (outBuffer.items.length >= outBuffer.capacity) {
          this.stationStatus[stId] = "BLOCKED";
          this.logEvent("STATION_BLOCKED", stId, chassis.vin, { buffer: `B${idx + 1}` });
        }
        yield outBuffer.put(chassis);
        this.stationStatus[stId] = "IDLE";
        this.stationActiveVin[stId] = null;
      }
    }
  }

  private *chassisGenerator(totalVehicles: number): Generator<SimEvent, void, unknown> {
    for (let i = 0; i < totalVehicles; i++) {
      const vin = `VIN-${1001 + i}`;
      const variant = i % 4 === 0 ? "SUV" : "Sedan";
      const chassis = new Chassis(vin, variant);
      this.activeChassisList.push(chassis);
      yield this.entryQueue.put(chassis);
      yield this.env.timeout(this.taktTime);
    }
  }

  runSimulation(untilTime = 3600.0, totalVehicles = 40): SimLogEvent[] {
    for (let idx = 0; idx < this.stationsConfig.length; idx++) {
      this.env.process(this.stationProcess(idx));
    }
    this.env.process(this.chassisGenerator(totalVehicles));
    this.env.run(untilTime);
    return this.eventLog;
  }

  getSnapshot(): LineSnapshot {
    const bufferLevels: Record<string, number> = {};
    for (const [name, buf] of Object.entries(this.buffers)) {
      bufferLevels[name] = buf.items.length;
    }
    return {
      current_time_seconds: round(this.env.now, 2),
      station_status: { ...this.stationStatus },
      station_active_vin: { ...this.stationActiveVin },
      buffer_levels: bufferLevels,
      buffer_capacity: this.bufferCapacity,
      completed_count: this.completedChassis.length,
      active_count: this.activeChassisList.length - this.completedChassis.length,
      event_count: this.eventLog.length,
    };
  }
}
