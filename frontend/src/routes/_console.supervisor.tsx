import { createFileRoute } from "@tanstack/react-router";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Crosshair,
  Play,
  Radar,
  Zap,
} from "lucide-react";
import { useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "sonner";

import { LineMap } from "@/components/twin/LineMap";
import { Panel, StatBlock, Tag } from "@/components/twin/Panel";
import { Button } from "@/components/ui/button";
import { stationName } from "@/lib/twin/config";
import { useTwin } from "@/lib/twin/useTwin";

export const Route = createFileRoute("/_console/supervisor")({
  head: () => ({
    meta: [
      { title: "Floor Supervisor Console | DigitalTwin.ai" },
      {
        name: "description",
        content:
          "Live assembly-line map, 45-minute bottleneck forecast, root-cause isolation and 1-click prescriptive interventions for floor supervisors.",
      },
      { property: "og:title", content: "Floor Supervisor Console | DigitalTwin.ai" },
      {
        property: "og:description",
        content:
          "Forecast bottlenecks 45 minutes ahead, isolate the root station and execute the ranked fix.",
      },
    ],
  }),
  component: SupervisorView,
});

function SupervisorView() {
  const { result } = useTwin();
  const { snapshot, lookahead, diagnosis, prescription, stationMetrics, kpis, vsRecords } = result;
  const [executed, setExecuted] = useState(false);

  const atRisk = lookahead.total_forecasted_disruptions > 0;
  const rootStation = diagnosis.root_station_id;

  return (
    <div className="mx-auto max-w-[1500px] px-4 py-6 lg:px-8">
      <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="label-caps text-muted-foreground">Floor supervisor · Line 4</div>
          <h1 className="mt-1 text-2xl font-semibold">Live Line Command</h1>
        </div>
        <div className="flex items-center gap-2 font-mono text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span
              className={
                atRisk
                  ? "size-2 rounded-full bg-critical live-pulse"
                  : "size-2 rounded-full bg-nominal"
              }
            />
            {result.scenario.label}
          </span>
          <span className="text-border">|</span>
          <span>SHIFT CLOCK T+{Math.round(snapshot.current_time_seconds / 60)} min</span>
        </div>
      </header>

      {/* Predictive alert bar */}
      <div
        className={
          atRisk
            ? "mb-5 flex flex-wrap items-center gap-4 rounded-md border border-critical/55 bg-critical/10 px-4 py-3"
            : "mb-5 flex flex-wrap items-center gap-4 rounded-md border border-nominal/45 bg-nominal/8 px-4 py-3"
        }
      >
        {atRisk ? (
          <AlertTriangle className="size-5 shrink-0 text-critical" />
        ) : (
          <CheckCircle2 className="size-5 shrink-0 text-nominal" />
        )}
        <div className="min-w-0 flex-1">
          <div className="font-display text-sm font-semibold">
            {atRisk
              ? `Bottleneck forecast at ${rootStation ?? "line"} in ${lookahead.earliest_lead_time_mins ?? 0} minutes`
              : "No disruption forecast within the 45-minute lookahead horizon"}
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {atRisk
              ? `Shadow twin fast-forwarded ${lookahead.lookahead_horizon_mins} min and detected ${lookahead.total_forecasted_disruptions} future disruption events before they physically occur.`
              : `Shadow twin fast-forwarded ${lookahead.lookahead_horizon_mins} min. Buffers and cycle times stay inside nominal thresholds.`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Tag tone={atRisk ? "critical" : "nominal"}>
            <Clock className="size-3" />
            lead time {lookahead.earliest_lead_time_mins ?? "—"} min
          </Tag>
        </div>
      </div>

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatBlock label="Completed" value={kpis.completed_vehicles} unit="units" hint="This shift window" />
        <StatBlock label="On line" value={kpis.active_vehicles} unit="chassis" hint="WIP in stations + buffers" />
        <StatBlock
          label="Avg cycle"
          value={kpis.avg_cycle_time}
          unit="s"
          hint="Target takt 60 s"
          tone={kpis.avg_cycle_time > 60 ? "watch" : "nominal"}
        />
        <StatBlock
          label="Blocking events"
          value={kpis.blocked_incidents}
          hint="Observed this window"
          tone={kpis.blocked_incidents > 0 ? "critical" : "nominal"}
        />
        <StatBlock
          label="Downtime prevented"
          value={kpis.downtime_prevented_mins}
          unit="min"
          hint="If the ranked fix is executed"
          tone="primary"
        />
      </div>

      <Panel
        title="Assembly line topology"
        subtitle="8 stations · 2-slot inter-station buffers · takt 60 s"
        right={
          <div className="flex gap-1.5">
            <Tag tone="nominal">nominal</Tag>
            <Tag tone="watch">watch</Tag>
            <Tag tone="critical">critical</Tag>
            <Tag tone="dark">virtual sensor</Tag>
          </div>
        }
        className="mb-5"
      >
        <LineMap stations={stationMetrics} snapshot={snapshot} rootStationId={rootStation} />
      </Panel>

      <div className="mb-5 grid gap-5 xl:grid-cols-2">
        {/* Root cause */}
        <Panel
          title="Temporal root-cause backtracking"
          subtitle={diagnosis.plain_english_diagnosis}
          tone={atRisk ? "critical" : "default"}
          right={<Crosshair className="size-4 text-muted-foreground" />}
        >
          {diagnosis.diagnosis_status === "ROOT_CAUSE_IDENTIFIED" ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <StatBlock label="Root station" value={diagnosis.root_station_id ?? "—"} tone="critical" />
                <StatBlock
                  label="Observed cycle"
                  value={diagnosis.observed_cycle_time?.toFixed(1) ?? "—"}
                  unit="s"
                />
                <StatBlock
                  label="Excess vs takt"
                  value={`+${diagnosis.delay_excess_seconds ?? 0}`}
                  unit="s"
                  tone="watch"
                />
                <StatBlock
                  label="Alarms suppressed"
                  value={diagnosis.total_symptoms_suppressed ?? 0}
                  hint="Cascade noise filtered"
                  tone="accent"
                />
              </div>

              <div>
                <div className="label-caps mb-2 text-muted-foreground">
                  Suppressed ripple alarms
                </div>
                <ul className="divide-y divide-border/70 rounded-md border border-border">
                  {(diagnosis.suppressed_symptoms_sample ?? []).map((s, i) => (
                    <li
                      key={`${s.station_id}-${s.timestamp}-${i}`}
                      className="flex items-center justify-between gap-3 px-3 py-2 font-mono text-xs"
                    >
                      <span className="text-muted-foreground">
                        T+{Math.round(s.timestamp / 60)}m
                      </span>
                      <span className="flex-1 truncate text-foreground/85">
                        {s.station_id} · {s.symptom_type.replace("STATION_", "")}
                      </span>
                      <span className="text-muted-foreground line-through">suppressed</span>
                    </li>
                  ))}
                  {(diagnosis.suppressed_symptoms_sample ?? []).length === 0 && (
                    <li className="px-3 py-2 text-xs text-muted-foreground">
                      No cascade symptoms recorded.
                    </li>
                  )}
                </ul>
              </div>

              <p className="text-xs leading-relaxed text-muted-foreground">
                {stationName(diagnosis.root_station_id)} drifted first at T+
                {Math.round((diagnosis.earliest_drift_time ?? 0) / 60)} min. Every later blocking or
                starvation alarm is a downstream consequence, so the crew sees one instruction
                instead of {(diagnosis.total_symptoms_suppressed ?? 0) + 1} red lights.
              </p>
            </div>
          ) : (
            <div className="flex items-center gap-3 rounded-md border border-nominal/40 bg-nominal/8 px-3 py-6">
              <CheckCircle2 className="size-5 text-nominal" />
              <p className="text-sm text-foreground/85">
                All station cycle times and buffer queues are inside nominal thresholds. No root
                cause to isolate.
              </p>
            </div>
          )}
        </Panel>

        {/* Prescriptive */}
        <Panel
          title="3-branch prescriptive sandbox"
          subtitle={
            prescription
              ? "Three interventions simulated in parallel; ranked by projected downtime."
              : "Nothing to prescribe — the line is running clean."
          }
          tone={prescription ? "primary" : "default"}
          right={<Zap className="size-4 text-muted-foreground" />}
        >
          {prescription ? (
            <div className="space-y-4">
              <div className="rounded-md border border-primary/50 bg-primary/10 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Tag tone="primary">recommended · {prescription.recommended_branch_id}</Tag>
                  <span className="font-mono text-[11px] text-muted-foreground">
                    confidence {prescription.confidence_score_pct}%
                  </span>
                </div>
                <h3 className="mt-2 font-display text-lg font-semibold">
                  {prescription.recommended_action_title}
                </h3>
                <p className="mt-1 text-sm leading-relaxed text-foreground/80">
                  {prescription.operational_instruction}
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-4">
                  <div className="font-mono text-xs text-muted-foreground">
                    unmitigated{" "}
                    <span className="text-critical">
                      {prescription.baseline_unmitigated_downtime_mins} min
                    </span>{" "}
                    → with fix{" "}
                    <span className="text-nominal">
                      {prescription.projected_downtime_with_fix_mins} min
                    </span>
                  </div>
                  <Button
                    size="sm"
                    disabled={executed}
                    onClick={() => {
                      setExecuted(true);
                      toast.success("Intervention dispatched to the line", {
                        description: prescription.operational_instruction,
                      });
                    }}
                  >
                    <Play className="size-3.5" />
                    {executed ? "Dispatched" : "Execute fix"}
                  </Button>
                </div>
              </div>

              <div>
                <div className="label-caps mb-2 text-muted-foreground">Branch comparison</div>
                <div className="overflow-hidden rounded-md border border-border">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-secondary/60 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2">Rank</th>
                        <th className="px-3 py-2">Branch</th>
                        <th className="px-3 py-2 text-right">Downtime</th>
                        <th className="px-3 py-2 text-right">Output</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/70">
                      {prescription.all_evaluated_branches.map((b, i) => (
                        <tr key={b.branch_id} className={i === 0 ? "bg-primary/8" : undefined}>
                          <td className="px-3 py-2 font-mono text-muted-foreground">#{i + 1}</td>
                          <td className="px-3 py-2">{b.name}</td>
                          <td className="px-3 py-2 text-right font-mono tabular-nums">
                            {b.blocked_mins} min
                          </td>
                          <td className="px-3 py-2 text-right font-mono tabular-nums">
                            {b.throughput}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3 rounded-md border border-border bg-surface px-3 py-6">
              <CheckCircle2 className="size-5 text-nominal" />
              <p className="text-sm text-foreground/85">
                No intervention required. The sandbox stays warm and re-evaluates on the next
                forecasted deviation.
              </p>
            </div>
          )}
        </Panel>
      </div>

      <VirtualSensingPanel records={vsRecords} />
    </div>
  );
}

function VirtualSensingPanel({
  records,
}: {
  records: ReturnType<typeof useTwin>["result"]["vsRecords"];
}) {
  const byStation = ["S3", "S5"].map((id) => ({
    id,
    rows: records.filter((r) => r.dark_station_id === id),
  }));

  return (
    <Panel
      title="Virtual sensing · uninstrumented dark stations"
      subtitle="Inferred work time from checkpoint Delta-T, filtered against a rolling mu + 2σ threshold. Zero hardware sensors."
      right={<Radar className="size-4 text-muted-foreground" />}
      tone="accent"
    >
      <div className="grid gap-5 lg:grid-cols-2">
        {byStation.map(({ id, rows }) => {
          const data = rows.map((r, i) => ({
            i: i + 1,
            inferred: r.inferred_work_time,
            threshold: r.threshold,
            anomaly: r.is_anomaly,
          }));
          const stalls = rows.filter((r) => r.stall_confirmed).length;
          const anomalies = rows.filter((r) => r.is_anomaly).length;

          return (
            <div key={id} className="rounded-md border border-border bg-surface p-3">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="font-mono text-sm font-semibold">
                    {id} · {stationName(id)}
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    {rows.length} chassis inferred from transit differentials
                  </div>
                </div>
                <div className="flex gap-1.5">
                  <Tag tone={anomalies ? "watch" : "nominal"}>{anomalies} anomalies</Tag>
                  <Tag tone={stalls ? "critical" : "nominal"}>{stalls} stalls confirmed</Tag>
                </div>
              </div>

              <div className="h-44">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -18 }}>
                    <CartesianGrid stroke="var(--grid-line)" strokeDasharray="2 4" vertical={false} />
                    <XAxis
                      dataKey="i"
                      tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                      tickLine={false}
                      axisLine={{ stroke: "var(--border)" }}
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                      tickLine={false}
                      axisLine={false}
                      domain={["auto", "auto"]}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "var(--popover)",
                        border: "1px solid var(--border)",
                        borderRadius: 6,
                        fontSize: 12,
                      }}
                      labelFormatter={(v) => `Chassis #${v}`}
                    />
                    <ReferenceLine y={60} stroke="var(--muted-foreground)" strokeDasharray="4 4" />
                    <Line
                      type="monotone"
                      dataKey="threshold"
                      stroke="var(--critical)"
                      strokeWidth={1.5}
                      strokeDasharray="4 3"
                      dot={false}
                      name="μ + 2σ threshold"
                    />
                    <Line
                      type="monotone"
                      dataKey="inferred"
                      stroke="var(--accent)"
                      strokeWidth={2}
                      dot={false}
                      name="Inferred work time (s)"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}
