import { createFileRoute } from "@tanstack/react-router";

import { Panel, StatBlock, Tag } from "@/components/twin/Panel";
import { useTwin } from "@/lib/twin/useTwin";

export const Route = createFileRoute("/_console/leadership")({
  head: () => ({
    meta: [
      { title: "Executive Value Case | DigitalTwin.ai" },
      {
        name: "description",
        content:
          "Downtime prevented, annualised savings and rollout roadmap for the predictive assembly-line digital twin.",
      },
      { property: "og:title", content: "Executive Value Case | DigitalTwin.ai" },
      {
        property: "og:description",
        content: "Quantified ROI of predictive bottleneck prevention across the assembly line.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LeadershipView,
});

const DOWNTIME_COST_PER_MIN = 22000;
const SHIFTS_PER_YEAR = 500;

const ROADMAP = [
  {
    phase: "Phase 1 · Pilot",
    window: "0–3 months",
    detail: "One assembly line, virtual sensors on dark stations, supervisor console in shadow mode.",
  },
  {
    phase: "Phase 2 · Closed loop",
    window: "3–6 months",
    detail: "Prescriptive actions wired to MES pacing and buffer routing with supervisor approval.",
  },
  {
    phase: "Phase 3 · Plant-wide",
    window: "6–12 months",
    detail: "All lines, quality lineage feeding warranty analytics, cross-plant benchmarking.",
  },
];

function LeadershipView() {
  const { result } = useTwin();
  const { kpis, lookahead, scenario, quality } = result;

  const savedPerShift = kpis.downtime_prevented_mins * DOWNTIME_COST_PER_MIN;
  const annualised = savedPerShift * SHIFTS_PER_YEAR;
  const fmt = (n: number) =>
    n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : `${Math.round(n / 1000)}K`;

  return (
    <div className="mx-auto max-w-[1500px] px-4 py-6 lg:px-8">
      <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold">Executive · Value Case</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Modelled on the {scenario.label} scenario at ${DOWNTIME_COST_PER_MIN.toLocaleString()}
            /minute of line downtime.
          </p>
        </div>
        <Tag tone={kpis.downtime_prevented_mins > 0 ? "primary" : "muted"}>
          {kpis.downtime_prevented_mins} min prevented
        </Tag>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatBlock
          label="Downtime prevented"
          value={kpis.downtime_prevented_mins}
          unit="min/shift"
          tone="primary"
        />
        <StatBlock label="Value per shift" value={`$${fmt(savedPerShift)}`} tone="nominal" />
        <StatBlock label="Annualised impact" value={`$${fmt(annualised)}`} tone="nominal" />
        <StatBlock
          label="Warning lead time"
          value={kpis.lead_time_mins ? `${kpis.lead_time_mins} min` : "—"}
          tone="accent"
        />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <Panel title="Why it works" subtitle="Predict, isolate, prescribe — before the line stops">
          <ul className="space-y-3 text-sm leading-relaxed text-foreground/85">
            <li>
              <span className="font-medium text-primary">Look-ahead twin.</span> A shadow simulation
              runs {lookahead.lookahead_horizon_mins} minutes ahead of the real line and flagged{" "}
              {lookahead.total_forecasted_disruptions} disruption
              {lookahead.total_forecasted_disruptions === 1 ? "" : "s"} in this window.
            </li>
            <li>
              <span className="font-medium text-primary">Virtual sensors.</span> Manual stations with
              no instrumentation are inferred from transit timing — no capital spend on hardware.
            </li>
            <li>
              <span className="font-medium text-primary">Prescriptive branches.</span> Three
              candidate fixes are simulated and ranked, so the supervisor executes the best one, not
              the first one.
            </li>
            <li>
              <span className="font-medium text-primary">Quality lineage.</span>{" "}
              {quality.total_vehicles_tracked} chassis carry a tolerance birth certificate, cutting
              warranty exposure downstream.
            </li>
          </ul>
        </Panel>

        <Panel title="Rollout roadmap" subtitle="From pilot line to plant-wide deployment">
          <ol className="space-y-3">
            {ROADMAP.map((r) => (
              <li key={r.phase} className="rounded-sm border border-border bg-surface px-3 py-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium">{r.phase}</span>
                  <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                    {r.window}
                  </span>
                </div>
                <p className="mt-1 text-xs leading-snug text-muted-foreground">{r.detail}</p>
              </li>
            ))}
          </ol>
        </Panel>
      </div>
    </div>
  );
}
