/**
 * Quality Lineage & Cumulative Tolerance Stack-Up Tracker — TypeScript port of
 * core/quality_tracker.py. Maintains each vehicle's "Digital Birth Certificate"
 * to intercept cascading tolerance deviations before end-of-line teardowns.
 */

import { round } from "./des";

export interface BirthCertificate {
  vin: string;
  first_seen: number;
  station_tolerances: Record<string, number>;
  cumulative_score: number;
  flagged_for_inspection: boolean;
  recommended_routing: string;
}

export interface QualityFlag {
  timestamp: number;
  vin: string;
  triggered_at_station: string;
  cumulative_score: number;
  threshold: number;
  station_breakdown: Record<string, number>;
  action: string;
}

export interface QualitySummary {
  total_vehicles_tracked: number;
  flagged_chassis_count: number;
  estimated_first_pass_yield_pct: number;
  flagged_list: QualityFlag[];
  certificates: BirthCertificate[];
}

export class QualityLineageTracker {
  birthCertificates: Record<string, BirthCertificate> = {};
  flaggedChassis: QualityFlag[] = [];

  constructor(public cumulativeThreshold = 4.5) {}

  recordStationTolerance(
    vin: string,
    stationId: string,
    toleranceDeviation: number,
    currentTimestamp: number,
  ) {
    const chassis = (this.birthCertificates[vin] ??= {
      vin,
      first_seen: currentTimestamp,
      station_tolerances: {},
      cumulative_score: 0.0,
      flagged_for_inspection: false,
      recommended_routing: "CONTINUE_LINE",
    });

    chassis.station_tolerances[stationId] = round(toleranceDeviation, 3);
    chassis.cumulative_score = round(
      Object.values(chassis.station_tolerances).reduce((a, v) => a + Math.abs(v), 0),
      3,
    );

    if (chassis.cumulative_score >= this.cumulativeThreshold && !chassis.flagged_for_inspection) {
      chassis.flagged_for_inspection = true;
      chassis.recommended_routing = "DIVERT_OFFLINE_INSPECTION_BUFFER_5";

      const flag: QualityFlag = {
        timestamp: currentTimestamp,
        vin,
        triggered_at_station: stationId,
        cumulative_score: chassis.cumulative_score,
        threshold: this.cumulativeThreshold,
        station_breakdown: { ...chassis.station_tolerances },
        action:
          "Divert to Buffer 5 offline inspection before End-of-Line (S8) teardown",
      };
      this.flaggedChassis.push(flag);
      return flag;
    }

    return null;
  }

  getSummaryMetrics(): QualitySummary {
    const totalTracked = Object.keys(this.birthCertificates).length;
    const flaggedCount = this.flaggedChassis.length;
    const fpy = round((1.0 - flaggedCount / Math.max(1, totalTracked)) * 100.0, 1);

    return {
      total_vehicles_tracked: totalTracked,
      flagged_chassis_count: flaggedCount,
      estimated_first_pass_yield_pct: fpy,
      flagged_list: this.flaggedChassis,
      certificates: Object.values(this.birthCertificates),
    };
  }
}
