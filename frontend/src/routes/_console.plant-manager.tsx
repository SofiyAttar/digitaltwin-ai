import { createFileRoute } from "@tanstack/react-router";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Panel, StatBlock, Tag } from "@/components/twin/Panel";
import { useTwin } from "@/lib/twin/useTwin";

export const Route = createFileRoute("/_console/plant-manager")({
  head: () => ({
    meta: [
      { title: "Plant Manager Analytics | DigitalTwin.ai" },
      {
        name: "description",
        content:
          "Shift-level OEE, station utilisation, virtual-sensor inference on dark stations and quality lineage for every chassis on the line.",
      },
      { property: "og:title", content: "Plant Manager Analytics | DigitalTwin.ai" },
      {
        property: "og:description",
        content:
          "Analyse the shift: OEE, throughput, station bottleneck ranking and tolerance stack-up lineage.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PlantManagerView,
});

function PlantManagerView() {
  const { result } = useTwin();
  const { kpis, stationMetrics, quality, vsRecords, scenario } = result;

  const chartData = stationMetrics.map((s) => ({
    name: s.id,
    cycle: s.avg_cycle_time,
    util: s.utilization_pct,
  }));

  return (
    <div className="mx-auto max-w-[1500px] px-4 py-6 lg:px-8">
      <header className="mb-5">
        <h1 className="font-display text-2xl font-semibold">Plant Manager · Shift Analytics</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Scenario: {scenario.label} — 30-minute simulated shift window.
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatBlock label="OEE" value={kpis.oee_pct} unit="%" tone="primary" />
        <StatBlock label="Throughput" value={kpis.throughput_per_hour} unit="veh/hr" />
        <StatBlock label="Avg cycle time" value={kpis.avg_cycle_time} unit="s" />
        <StatBlock
          label="First pass yield"
          value={quality.estimated_first_pass_yield_pct}
          unit="%"
          tone={quality.flagged_chassis_count > 0 ? "watch" : "nominal"}
        />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <Panel title="Station cycle time" subtitle="Average seconds per station">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="name" stroke="var(--muted-foreground)" fontSize={11} />
                <YAxis stroke="var(--muted-foreground)" fontSize={11} />
                <Tooltip
                  contentStyle={{
                    background: "var(--card)",
                    border: "1px solid var(--border)",
                    fontSize: 12,
                  }}
                />
                <Bar dataKey="cycle" fill="var(--primary)" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel title="Station ranking" subtitle="Utilisation, blocking and starvation">
          <div className="overflow-x-auto">
            <table className="w-full text-left font-mono text-xs">
              <thead className="text-muted-foreground">
                <tr>
                  <th className="py-1.5">Station</th>
                  <th>Cycle</th>
                  <th>Util</th>
                  <th>Blocked</th>
                  <th>Starved</th>
                  <th>Health</th>
                </tr>
              </thead>
              <tbody>
                {stationMetrics.map((s) => (
                  <tr key={s.id} className="border-t border-border/60">
                    <td className="py-1.5">
                      {s.id} {s.dark && <Tag tone="dark">dark</Tag>}
                    </td>
                    <td className="tabular-nums">{s.avg_cycle_time}s</td>
                    <td className="tabular-nums">{s.utilization_pct}%</td>
                    <td className="tabular-nums">{s.blocked_events}</td>
                    <td className="tabular-nums">{s.starved_events}</td>
                    <td>
                      <Tag
                        tone={
                          s.health === "CRITICAL"
                            ? "critical"
                            : s.health === "WATCH"
                              ? "watch"
                              : "nominal"
                        }
                      >
                        {s.health}
                      </Tag>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel title="Virtual sensor · dark stations" subtitle="Inferred manual work times">
          <div className="max-h-64 overflow-y-auto">
            <table className="w-full text-left font-mono text-xs">
              <thead className="text-muted-foreground">
                <tr>
                  <th className="py-1.5">VIN</th>
                  <th>Station</th>
                  <th>Inferred</th>
                  <th>Mean</th>
                  <th>Signal</th>
                </tr>
              </thead>
              <tbody>
                {vsRecords.slice(-14).map((r, i) => (
                  <tr key={`${r.vin}-${r.dark_station_id}-${i}`} className="border-t border-border/60">
                    <td className="py-1.5">{r.vin}</td>
                    <td>{r.dark_station_id}</td>
                    <td className="tabular-nums">{r.inferred_work_time}s</td>
                    <td className="tabular-nums">{r.rolling_mean}s</td>
                    <td>
                      {r.stall_confirmed ? (
                        <Tag tone="critical">stall</Tag>
                      ) : r.is_anomaly ? (
                        <Tag tone="watch">anomaly</Tag>
                      ) : (
                        <Tag tone="nominal">normal</Tag>
                      )}
                    </td>
                  </tr>
                ))}
                {vsRecords.length === 0 && (
                  <tr>
                    <td className="py-3 text-muted-foreground" colSpan={5}>
                      No dark-station telemetry inferred yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel
          title="Quality lineage"
          subtitle={`${quality.flagged_chassis_count} of ${quality.total_vehicles_tracked} chassis flagged for inspection`}
          tone={quality.flagged_chassis_count > 0 ? "critical" : "default"}
        >
          <div className="max-h-64 space-y-2 overflow-y-auto">
            {quality.flagged_list.map((f) => (
              <div key={f.vin} className="rounded-sm border border-border bg-surface px-3 py-2">
                <div className="flex items-center justify-between font-mono text-xs">
                  <span>{f.vin}</span>
                  <Tag tone="critical">{f.cumulative_score} mm</Tag>
                </div>
                <div className="mt-1 text-[11px] text-muted-foreground">
                  Triggered at {f.triggered_at_station} — {f.action}
                </div>
              </div>
            ))}
            {quality.flagged_list.length === 0 && (
              <p className="text-sm text-muted-foreground">
                All tracked chassis are within tolerance stack-up limits.
              </p>
            )}
          </div>
        </Panel>
      </div>
    </div>
  );
}
