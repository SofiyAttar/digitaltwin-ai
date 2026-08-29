/**
 * Fast-Forward Lookahead Shadow Simulation Engine — TypeScript port of
 * core/lookahead_twin.py. Clones the live line state into a background
 * discrete-event simulation and fast-forwards 30-45 minutes to forecast queue
 * overflows, starvation and blockages before they physically happen.
 */

import { round } from "./des";
import { AssemblyLineSimulation, type SimLogEvent } from "./factorySim";

export interface ForecastedDisruption {
  predicted_timestamp: number;
  lead_time_minutes: number;
  station_id: string;
  failure_type: "BUFFER_OVERFLOW_BLOCKING" | "CYCLE_TIME_DRIFT";
  severity: "HIGH" | "MEDIUM";
  description: string;
}

export interface TimelineSample {
  future_offset_mins: number;
  projected_time_seconds: number;
  projected_risk_level: "CRITICAL" | "WARNING" | "NOMINAL";
  blocking_count: number;
}

export interface LookaheadProjection {
  lookahead_horizon_mins: number;
  total_forecasted_disruptions: number;
  earliest_lead_time_mins: number | null;
  disruptions_list: ForecastedDisruption[];
  timeline_samples: TimelineSample[];
  shadow_event_log: SimLogEvent[];
}

export class LookaheadShadowTwin {
  constructor(public lookaheadHorizonSeconds = 2700.0) {}

  runLookaheadProjection(
    currentTime = 0.0,
    injectedBottlenecks?: Record<string, { multiplier?: number; num_vehicles?: number }>,
  ): LookaheadProjection {
    const shadowSim = new AssemblyLineSimulation(99);

    if (injectedBottlenecks) {
      for (const [stId, params] of Object.entries(injectedBottlenecks)) {
        shadowSim.injectBottleneck(stId, params.multiplier ?? 1.6, params.num_vehicles ?? 5);
      }
    }

    const targetEndTime = currentTime + this.lookaheadHorizonSeconds;
    const shadowEvents = shadowSim.runSimulation(targetEndTime, 45);

    const forecasted: ForecastedDisruption[] = [];

    for (const ev of shadowEvents) {
      const leadTimeMins = round((ev.timestamp - currentTime) / 60.0, 1);
      if (ev.event_type === "STATION_BLOCKED") {
        forecasted.push({
          predicted_timestamp: ev.timestamp,
          lead_time_minutes: Math.max(0.0, leadTimeMins),
          station_id: ev.station_id,
          failure_type: "BUFFER_OVERFLOW_BLOCKING",
          severity: "HIGH",
          description: `Buffer capacity exceeded downstream of ${ev.station_id}; upstream flow will freeze.`,
        });
      } else if (ev.event_type === "STATION_EXIT" && (ev.cycle_time ?? 0) > 85.0) {
        forecasted.push({
          predicted_timestamp: ev.timestamp,
          lead_time_minutes: Math.max(0.0, leadTimeMins),
          station_id: ev.station_id,
          failure_type: "CYCLE_TIME_DRIFT",
          severity: "MEDIUM",
          description: `Severe cycle time drift predicted at ${ev.station_id} (${ev.cycle_time}s).`,
        });
      }
    }

    const timelineSamples: TimelineSample[] = [0, 15, 30, 45].map((stepMins) => {
      const sampleTime = currentTime + stepMins * 60.0;
      const blockingCount = shadowEvents.filter(
        (e) => e.timestamp <= sampleTime && e.event_type === "STATION_BLOCKED",
      ).length;
      return {
        future_offset_mins: stepMins,
        projected_time_seconds: sampleTime,
        projected_risk_level:
          blockingCount > 2 ? "CRITICAL" : blockingCount > 0 ? "WARNING" : "NOMINAL",
        blocking_count: blockingCount,
      };
    });

    return {
      lookahead_horizon_mins: round(this.lookaheadHorizonSeconds / 60.0, 1),
      total_forecasted_disruptions: forecasted.length,
      earliest_lead_time_mins: forecasted.length > 0 ? forecasted[0]!.lead_time_minutes : null,
      disruptions_list: forecasted,
      timeline_samples: timelineSamples,
      shadow_event_log: shadowEvents,
    };
  }
}
