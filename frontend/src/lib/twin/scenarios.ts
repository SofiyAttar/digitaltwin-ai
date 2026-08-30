/**
 * Scenario orchestration — TypeScript equivalent of app.py's run_scenario().
 * Drives all five engines and derives the analytics the dashboards render.
 */

import { round } from "./des";
import { LINE_CONFIG } from "./config";
import { AssemblyLineSimulation, type LineSnapshot, type SimLogEvent } from "./factorySim";
import { LookaheadShadowTwin, type LookaheadProjection } from "./lookahead";
import { RootCauseIsolator, type Diagnosis } from "./rootCause";
import { PrescriptiveDecisionEngine, type Prescription } from "./prescriptive";
import { QualityLineageTracker, type QualitySummary } from "./qualityTracker";
import { VirtualSensingEngine, type VirtualSensorRecord } from "./virtualSensor";

export type ScenarioId = "nominal" | "s3_stall" | "defect_drift" | "shift_noise";

export interface ScenarioMeta {
  id: ScenarioId;
  label: string;
  short: string;
  description: string;
}

export const SCENARIOS: ScenarioMeta[] = [
  {
    id: "nominal",
    label: "Nominal Shift Baseline",
    short: "Baseline",
    description: "Healthy takt-paced flow with natural stochastic variance only.",
  },
  {
    id: "s3_stall",
    label: "Dark Station S3 Stall",
    short: "S3 Stall",
    description:
      "Unmeasured manual delay injected at the uninstrumented wiring-harness station.",
  },
  {
    id: "defect_drift",
    label: "Cumulative Defect Drift",
    short: "Defect Drift",
    description: "Subtle tolerance bias at S1/S2 that stacks up toward end-of-line teardown.",
  },
  {
    id: "shift_noise",
    label: "Shift Changeover Noise",
    short: "Shift Noise",
    description: "Mild human variance at both dark stations — tests false-alarm resiliency.",
  },
];

export interface StationMetric {
  id: string;
  name: string;
  dark: boolean;
  status: string;
  active_vin: string | null;
  avg_cycle_time: number;
  max_cycle_time: number;
  samples: number;
  blocked_events: number;
  starved_events: number;
  utilization_pct: number;
  health: "NOMINAL" | "WATCH" | "CRITICAL";
}

export interface ThroughputPoint {
  minute: number;
  completed: number;
  cumulative: number;
}

export interface ScenarioResult {
  scenario: ScenarioMeta;
  snapshot: LineSnapshot;
  events: SimLogEvent[];
  lookahead: LookaheadProjection;
  diagnosis: Diagnosis;
  prescription: Prescription | null;
  quality: QualitySummary;
  vsRecords: VirtualSensorRecord[];
  stationMetrics: StationMetric[];
  throughputSeries: ThroughputPoint[];
  kpis: {
    completed_vehicles: number;
    active_vehicles: number;
    telemetry_events: number;
    avg_cycle_time: number;
    blocked_incidents: number;
    starved_incidents: number;
    throughput_per_hour: number;
    oee_pct: number;
    lead_time_mins: number | null;
    downtime_prevented_mins: number;
  };
}

const HORIZON_SECONDS = 1800.0;
const TOTAL_VEHICLES = 25;

function buildStationMetrics(
  events: SimLogEvent[],
  snapshot: LineSnapshot,
  horizon: number,
): StationMetric[] {
  return LINE_CONFIG.stations.map((st) => {
    const exits = events.filter((e) => e.event_type === "STATION_EXIT" && e.station_id === st.id);
    const cycles = exits.map((e) => e.cycle_time ?? 0);
    const busySeconds = cycles.reduce((a, b) => a + b, 0);
    const blocked = events.filter(
      (e) => e.event_type === "STATION_BLOCKED" && e.station_id === st.id,
    ).length;
    const starved = events.filter(
      (e) => e.event_type === "STATION_STARVED" && e.station_id === st.id,
    ).length;
    const avg = cycles.length ? round(busySeconds / cycles.length, 1) : 0;
    const max = cycles.length ? round(Math.max(...cycles), 1) : 0;

    let health: StationMetric["health"] = "NOMINAL";
    if (avg > LINE_CONFIG.target_takt_time_seconds + 12 || blocked > 2) health = "CRITICAL";
    else if (avg > LINE_CONFIG.target_takt_time_seconds + 4 || blocked > 0 || starved > 2)
      health = "WATCH";

    return {
      id: st.id,
      name: st.name,
      dark: st.dark,
      status: snapshot.station_status[st.id] ?? "IDLE",
      active_vin: snapshot.station_active_vin[st.id] ?? null,
      avg_cycle_time: avg,
      max_cycle_time: max,
      samples: cycles.length,
      blocked_events: blocked,
      starved_events: starved,
      utilization_pct: round(Math.min(100, (busySeconds / horizon) * 100), 1),
      health,
    };
  });
}

function buildThroughputSeries(events: SimLogEvent[], horizon: number): ThroughputPoint[] {
  const points: ThroughputPoint[] = [];
  const completions = events
    .filter((e) => e.event_type === "CHASSIS_COMPLETED")
    .map((e) => e.timestamp);
  let cumulative = 0;
  for (let minute = 0; minute <= Math.round(horizon / 60); minute += 1) {
    const from = minute * 60;
    const to = from + 60;
    const inWindow = completions.filter((t) => t >= from && t < to).length;
    cumulative += inWindow;
    points.push({ minute, completed: inWindow, cumulative });
  }
  return points;
}

export function runScenario(scenarioId: ScenarioId): ScenarioResult {
  const scenario = SCENARIOS.find((s) => s.id === scenarioId) ?? SCENARIOS[0]!;

  const sim = new AssemblyLineSimulation(42);
  const lookaheadEngine = new LookaheadShadowTwin(2700.0);
  const qualityTracker = new QualityLineageTracker(4.5);
  const vsEngine = new VirtualSensingEngine();
  const rcIsolator = new RootCauseIsolator(60.0);
  const prescriptiveEngine = new PrescriptiveDecisionEngine(2700.0);

  let injected: Record<string, { multiplier: number; num_vehicles: number }> | undefined;
  let prescriptionStation: string | null = null;

  if (scenarioId === "s3_stall") {
    sim.injectBottleneck("S3", 1.7, 6);
    injected = { S3: { multiplier: 1.7, num_vehicles: 6 } };
    prescriptionStation = "S3";
  } else if (scenarioId === "defect_drift") {
    sim.injectQualityDrift("S1", 1.2, 10);
    sim.injectQualityDrift("S2", 1.3, 10);
  } else if (scenarioId === "shift_noise") {
    sim.injectBottleneck("S3", 1.1, 4);
    sim.injectBottleneck("S5", 1.1, 4);
  }

  const events = sim.runSimulation(HORIZON_SECONDS, TOTAL_VEHICLES);

  if (scenarioId === "defect_drift") {
    for (const ev of events) {
      if (ev.event_type === "STATION_EXIT") {
        qualityTracker.recordStationTolerance(
          ev.vin,
          ev.station_id,
          ev.tolerance_drift ?? 0.3,
          ev.timestamp,
        );
      }
    }
  } else {
    for (const ev of events) {
      if (ev.event_type === "STATION_EXIT") {
        qualityTracker.recordStationTolerance(
          ev.vin,
          ev.station_id,
          ev.tolerance_drift ?? 0.3,
          ev.timestamp,
        );
      }
    }
  }

  const lookahead = lookaheadEngine.runLookaheadProjection(HORIZON_SECONDS, injected);
  const diagnosis = rcIsolator.isolateRootCause(lookahead.shadow_event_log);

  const prescription =
    prescriptionStation || diagnosis.diagnosis_status === "ROOT_CAUSE_IDENTIFIED"
      ? prescriptiveEngine.evaluateInterventions(
          prescriptionStation ?? diagnosis.root_station_id ?? "S3",
        )
      : null;

  const snapshot = sim.getSnapshot();
  const quality = qualityTracker.getSummaryMetrics();
  const vsRecords = vsEngine.analyzeEventLog(events);
  const stationMetrics = buildStationMetrics(events, snapshot, HORIZON_SECONDS);
  const throughputSeries = buildThroughputSeries(events, HORIZON_SECONDS);

  const allCycles = events
    .filter((e) => e.event_type === "STATION_EXIT")
    .map((e) => e.cycle_time ?? 0);
  const avgCycle = allCycles.length
    ? round(allCycles.reduce((a, b) => a + b, 0) / allCycles.length, 1)
    : 0;
  const blockedIncidents = events.filter((e) => e.event_type === "STATION_BLOCKED").length;
  const starvedIncidents = events.filter((e) => e.event_type === "STATION_STARVED").length;

  const availability = Math.max(
    0,
    1 - (blockedIncidents * 60) / (HORIZON_SECONDS * LINE_CONFIG.stations.length),
  );
  const performance = Math.min(1, LINE_CONFIG.target_takt_time_seconds / Math.max(1, avgCycle));
  const qualityRate = quality.estimated_first_pass_yield_pct / 100;

  return {
    scenario,
    snapshot,
    events,
    lookahead,
    diagnosis,
    prescription,
    quality,
    vsRecords,
    stationMetrics,
    throughputSeries,
    kpis: {
      completed_vehicles: snapshot.completed_count,
      active_vehicles: snapshot.active_count,
      telemetry_events: snapshot.event_count,
      avg_cycle_time: avgCycle,
      blocked_incidents: blockedIncidents,
      starved_incidents: starvedIncidents,
      throughput_per_hour: round((snapshot.completed_count / HORIZON_SECONDS) * 3600, 1),
      oee_pct: round(availability * performance * qualityRate * 100, 1),
      lead_time_mins: lookahead.earliest_lead_time_mins,
      downtime_prevented_mins: prescription?.downtime_prevented_minutes ?? 0,
    },
  };
}
