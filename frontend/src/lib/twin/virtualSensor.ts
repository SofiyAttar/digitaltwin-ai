/**
 * Virtual Sensing (Soft Sensor) Engine — TypeScript port of core/virtual_sensor.py.
 * Infers cycle times, micro-stalls and operator delays at uninstrumented manual
 * stations (S3, S5) from checkpoint transit-time differentials (Delta-T) plus
 * rolling statistical anomaly filtering (mu + 2*sigma).
 */

import { round } from "./des";
import type { SimLogEvent } from "./factorySim";

export interface VirtualSensorRecord {
  vin: string;
  dark_station_id: string;
  raw_delta_t: number;
  inferred_work_time: number;
  rolling_mean: number;
  rolling_std: number;
  threshold: number;
  is_anomaly: boolean;
  stall_confirmed: boolean;
}

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const std = (xs: number[]) => {
  const m = mean(xs);
  return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / xs.length);
};

export class VirtualSensorStation {
  history: number[] = [];
  consecutiveAnomalies = 0;
  inferredRecords: VirtualSensorRecord[] = [];

  constructor(
    public darkStationId: string,
    public upstreamStationId: string,
    public downstreamStationId: string,
    public conveyorTransitTime = 10.0,
    public targetTakt = 60.0,
    public windowSize = 30,
  ) {}

  processCheckpointTransition(
    vin: string,
    upstreamExitTime: number,
    downstreamEnterTime: number,
    bufferDwellTime = 0.0,
  ): VirtualSensorRecord {
    const rawDeltaT = downstreamEnterTime - upstreamExitTime;
    const inferredWorkTime = round(
      Math.max(10.0, rawDeltaT - this.conveyorTransitTime - bufferDwellTime),
      2,
    );

    let rollingMean: number;
    let rollingStd: number;
    let threshold: number;

    if (this.history.length >= 5) {
      rollingMean = mean(this.history);
      rollingStd = Math.max(1.5, std(this.history));
      threshold = round(rollingMean + 2.0 * rollingStd, 2);
    } else {
      rollingMean = this.targetTakt;
      rollingStd = 5.0;
      threshold = this.targetTakt + 10.0;
    }

    const isAnomaly = inferredWorkTime > threshold;
    this.consecutiveAnomalies = isAnomaly ? this.consecutiveAnomalies + 1 : 0;
    const stallConfirmed = this.consecutiveAnomalies >= 2;

    const record: VirtualSensorRecord = {
      vin,
      dark_station_id: this.darkStationId,
      raw_delta_t: round(rawDeltaT, 2),
      inferred_work_time: inferredWorkTime,
      rolling_mean: round(rollingMean, 2),
      rolling_std: round(rollingStd, 2),
      threshold,
      is_anomaly: isAnomaly,
      stall_confirmed: stallConfirmed,
    };

    this.history.push(inferredWorkTime);
    if (this.history.length > this.windowSize) this.history.shift();
    this.inferredRecords.push(record);
    return record;
  }
}

export class VirtualSensingEngine {
  sensors: Record<string, VirtualSensorStation>;

  constructor(conveyorTransitTime = 10.0, targetTakt = 60.0) {
    this.sensors = {
      S3: new VirtualSensorStation("S3", "S2", "S4", conveyorTransitTime, targetTakt),
      S5: new VirtualSensorStation("S5", "S4", "S6", conveyorTransitTime, targetTakt),
    };
  }

  analyzeEventLog(eventLog: SimLogEvent[]): VirtualSensorRecord[] {
    const results: VirtualSensorRecord[] = [];
    const vinEvents: Record<string, Record<string, { enter?: number; exit?: number }>> = {};

    for (const ev of eventLog) {
      const byStation = (vinEvents[ev.vin] ??= {});
      const slot = (byStation[ev.station_id] ??= {});
      if (ev.event_type === "STATION_EXIT") slot.exit = ev.timestamp;
      else if (ev.event_type === "STATION_ENTER") slot.enter = ev.timestamp;
    }

    for (const sensor of Object.values(this.sensors)) {
      const upId = sensor.upstreamStationId;
      const downId = sensor.downstreamStationId;
      for (const [vin, data] of Object.entries(vinEvents)) {
        const upExit = data[upId]?.exit;
        const downEnter = data[downId]?.enter;
        if (upExit !== undefined && downEnter !== undefined && downEnter > upExit) {
          results.push(sensor.processCheckpointTransition(vin, upExit, downEnter));
        }
      }
    }

    return results;
  }
}
