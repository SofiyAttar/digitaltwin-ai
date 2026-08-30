/**
 * Temporal Backtracking & Root-Cause Isolation Engine — TypeScript port of
 * core/root_cause.py. Traces backwards through the chronological event trace to
 * isolate the earliest originating station deviation, suppressing downstream
 * cascade and starvation alarms.
 */

import { round } from "./des";
import type { SimLogEvent } from "./factorySim";

export interface SuppressedSymptom {
  timestamp: number;
  station_id: string;
  symptom_type: string;
  status: "SUPPRESSED_RIPPLE_ALARM";
}

export interface Diagnosis {
  diagnosis_status: "ROOT_CAUSE_IDENTIFIED" | "LINE_NOMINAL";
  root_station_id: string | null;
  failure_category?: string;
  observed_cycle_time?: number;
  delay_excess_seconds?: number;
  earliest_drift_time?: number;
  total_symptoms_suppressed?: number;
  suppressed_symptoms_sample?: SuppressedSymptom[];
  plain_english_diagnosis: string;
}

export class RootCauseIsolator {
  constructor(public taktBaseline = 60.0) {}

  isolateRootCause(eventLog: SimLogEvent[]): Diagnosis {
    let rootCandidate: {
      root_station_id: string;
      anomaly_detected_timestamp: number;
      observed_cycle_time: number;
      baseline_takt: number;
      delay_excess_seconds: number;
      failure_category: string;
    } | null = null;
    const symptomAlarms: SuppressedSymptom[] = [];

    const sorted = [...eventLog].sort((a, b) => a.timestamp - b.timestamp);

    for (const ev of sorted) {
      const cycleTime = ev.cycle_time ?? 0;
      if (ev.event_type === "STATION_EXIT" && cycleTime > this.taktBaseline + 12.0) {
        if (rootCandidate === null) {
          rootCandidate = {
            root_station_id: ev.station_id,
            anomaly_detected_timestamp: ev.timestamp,
            observed_cycle_time: cycleTime,
            baseline_takt: this.taktBaseline,
            delay_excess_seconds: round(cycleTime - this.taktBaseline, 2),
            failure_category: ["S3", "S5"].includes(ev.station_id)
              ? "UNMEASURED_CYCLE_STALL"
              : "MACHINE_TOOLING_DEGRADATION",
          };
        }
      } else if (ev.event_type === "STATION_BLOCKED" || ev.event_type === "STATION_STARVED") {
        if (rootCandidate !== null) {
          symptomAlarms.push({
            timestamp: ev.timestamp,
            station_id: ev.station_id,
            symptom_type: ev.event_type,
            status: "SUPPRESSED_RIPPLE_ALARM",
          });
        }
      }
    }

    if (rootCandidate === null) {
      for (const ev of sorted) {
        if (ev.event_type === "STATION_BLOCKED") {
          rootCandidate = {
            root_station_id: ev.station_id,
            anomaly_detected_timestamp: ev.timestamp,
            observed_cycle_time: this.taktBaseline,
            baseline_takt: this.taktBaseline,
            delay_excess_seconds: 0.0,
            failure_category: "BUFFER_CAPACITY_BOTTLENECK",
          };
          break;
        }
      }
    }

    if (rootCandidate) {
      return {
        diagnosis_status: "ROOT_CAUSE_IDENTIFIED",
        root_station_id: rootCandidate.root_station_id,
        failure_category: rootCandidate.failure_category,
        observed_cycle_time: rootCandidate.observed_cycle_time,
        delay_excess_seconds: rootCandidate.delay_excess_seconds,
        earliest_drift_time: rootCandidate.anomaly_detected_timestamp,
        total_symptoms_suppressed: symptomAlarms.length,
        suppressed_symptoms_sample: symptomAlarms.slice(0, 5),
        plain_english_diagnosis: `Root cause isolated to ${rootCandidate.root_station_id} (${rootCandidate.failure_category}). Suppressed ${symptomAlarms.length} downstream cascade symptom alarms.`,
      };
    }

    return {
      diagnosis_status: "LINE_NOMINAL",
      root_station_id: null,
      total_symptoms_suppressed: 0,
      suppressed_symptoms_sample: [],
      plain_english_diagnosis:
        "All station cycle times and buffer queues are operating within nominal thresholds.",
    };
  }
}
