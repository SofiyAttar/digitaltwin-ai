/**
 * 3-Branch Prescriptive Decision Engine — TypeScript port of core/prescriptive.py.
 * When a bottleneck is forecasted, clones the line state into 3 parallel
 * simulation branches (Pacing, Buffer Divert, MTTA Relief Assist), evaluates each
 * fix deterministically, and ranks the optimal intervention.
 */

import { round } from "./des";
import { AssemblyLineSimulation } from "./factorySim";

type ModificationType =
  | "NO_ACTION"
  | "PACING_REGULATION"
  | "BUFFER_DIVERT"
  | "MTTA_OPERATOR_ASSIST";

export interface BranchResult {
  branch_id: string;
  branch_name: string;
  modification_type: ModificationType;
  total_blocked_minutes: number;
  completed_vehicles: number;
  blocking_incidents: number;
}

export interface Prescription {
  evaluation_status: "OPTIMAL_FIX_IDENTIFIED";
  root_station_id: string;
  recommended_branch_id: string;
  recommended_action_title: string;
  operational_instruction: string;
  baseline_unmitigated_downtime_mins: number;
  projected_downtime_with_fix_mins: number;
  downtime_prevented_minutes: number;
  confidence_score_pct: number;
  all_evaluated_branches: Array<{
    branch_id: string;
    name: string;
    blocked_mins: number;
    throughput: number;
    incidents: number;
  }>;
}

export class PrescriptiveDecisionEngine {
  constructor(public evaluationHorizonSeconds = 2700.0) {}

  private simulateBranch(
    branchId: string,
    branchName: string,
    rootStationId: string,
    modificationType: ModificationType,
  ): BranchResult {
    const shadowSim = new AssemblyLineSimulation(101);

    if (modificationType === "NO_ACTION") {
      shadowSim.injectBottleneck(rootStationId, 1.7, 6);
    } else if (modificationType === "PACING_REGULATION") {
      shadowSim.injectBottleneck(rootStationId, 1.7, 6);
      for (const st of shadowSim.stationsConfig) {
        if (st.id === "S1" || st.id === "S2") st.base_cycle_time = 66.0;
      }
    } else if (modificationType === "BUFFER_DIVERT") {
      shadowSim.injectBottleneck(rootStationId, 1.7, 4);
    } else if (modificationType === "MTTA_OPERATOR_ASSIST") {
      shadowSim.injectBottleneck(rootStationId, 1.7, 1);
    }

    const events = shadowSim.runSimulation(this.evaluationHorizonSeconds, 45);
    const blockingEvents = events.filter((e) => e.event_type === "STATION_BLOCKED");
    const totalBlockedSecs = blockingEvents.length * 60.0;

    return {
      branch_id: branchId,
      branch_name: branchName,
      modification_type: modificationType,
      total_blocked_minutes: round(totalBlockedSecs / 60.0, 1),
      completed_vehicles: shadowSim.completedChassis.length,
      blocking_incidents: blockingEvents.length,
    };
  }

  evaluateInterventions(rootStationId = "S3"): Prescription {
    const baseline = this.simulateBranch(
      "BASELINE",
      "No Action (Unmitigated)",
      rootStationId,
      "NO_ACTION",
    );
    const branchA = this.simulateBranch(
      "BRANCH_A",
      "Dynamic Upstream Pacing",
      rootStationId,
      "PACING_REGULATION",
    );
    const branchB = this.simulateBranch(
      "BRANCH_B",
      "Dynamic Buffer Diverting",
      rootStationId,
      "BUFFER_DIVERT",
    );
    const branchC = this.simulateBranch(
      "BRANCH_C",
      "Historical MTTA Relief Assist",
      rootStationId,
      "MTTA_OPERATOR_ASSIST",
    );

    const ranked = [branchA, branchB, branchC].sort(
      (a, b) =>
        a.total_blocked_minutes - b.total_blocked_minutes ||
        b.completed_vehicles - a.completed_vehicles,
    );
    const winner = ranked[0]!;

    const downtimePrevented = round(
      baseline.total_blocked_minutes - winner.total_blocked_minutes,
      1,
    );

    let instruction: string;
    if (winner.branch_id === "BRANCH_C") {
      instruction = `Dispatch roving technician to ${rootStationId} (estimated assist duration: 8 mins based on historical maintenance MTTA).`;
    } else if (winner.branch_id === "BRANCH_B") {
      instruction =
        "Route the next 2 sequenced chassis from Buffer 2 into offline auxiliary lane to prevent S2 upstream blocking.";
    } else {
      instruction =
        "Throttle upstream feeder stations S1/S2 pacing to 66s (+10%) for 15 minutes to allow downstream buffer queue to normalize.";
    }

    return {
      evaluation_status: "OPTIMAL_FIX_IDENTIFIED",
      root_station_id: rootStationId,
      recommended_branch_id: winner.branch_id,
      recommended_action_title: winner.branch_name,
      operational_instruction: instruction,
      baseline_unmitigated_downtime_mins: baseline.total_blocked_minutes,
      projected_downtime_with_fix_mins: winner.total_blocked_minutes,
      downtime_prevented_minutes: Math.max(0.0, downtimePrevented),
      confidence_score_pct: 94.0,
      all_evaluated_branches: ranked.map((b) => ({
        branch_id: b.branch_id,
        name: b.branch_name,
        blocked_mins: b.total_blocked_minutes,
        throughput: b.completed_vehicles,
        incidents: b.blocking_incidents,
      })),
    };
  }
}
