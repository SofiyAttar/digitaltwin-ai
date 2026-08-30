import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Activity,
  ArrowRight,
  Boxes,
  Brain,
  Factory,
  Gauge,
  LineChart,
  Radar,
  ShieldCheck,
  Timer,
} from "lucide-react";

const TITLE = "DigitalTwin.ai — Predictive Twin for Vehicle Assembly Lines";
const DESCRIPTION =
  "A live discrete-event twin that sees dark stations, forecasts line stalls 30–45 minutes ahead, isolates root cause, and prescribes the fix before throughput is lost.";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

const CAPABILITIES = [
  {
    icon: Radar,
    title: "Virtual sensing",
    body: "Manual stations have no PLC tags. Transit-time inference reconstructs their cycle time from the sensors either side — no new hardware on the floor.",
  },
  {
    icon: Timer,
    title: "45-minute lookahead",
    body: "The twin fast-forwards the live line state through a discrete-event kernel to forecast starvation and blocking before either reaches the operator.",
  },
  {
    icon: Brain,
    title: "Root-cause backtracking",
    body: "Blocking propagates upstream and starvation downstream. The engine walks the buffer chain back to the one station that actually originated the event.",
  },
  {
    icon: ShieldCheck,
    title: "Prescriptive branching",
    body: "Three counterfactual futures — pacing, buffer divert, MTTA relief — are simulated in parallel and ranked by recovered units and cost avoided.",
  },
];

const PIPELINE = [
  { step: "01", label: "Ingest", detail: "Station scans, buffer levels, transit times" },
  { step: "02", label: "Infer", detail: "Soft sensors fill the dark-station gaps" },
  { step: "03", label: "Forecast", detail: "DES fast-forward, 30–45 min horizon" },
  { step: "04", label: "Prescribe", detail: "Ranked interventions with quantified upside" },
];

const VIEWS = [
  {
    to: "/supervisor",
    icon: Activity,
    kicker: "Act now",
    title: "Floor Supervisor",
    body: "Live line map, predictive alert bar, root-cause chain, and a one-click prescriptive sandbox.",
  },
  {
    to: "/plant-manager",
    icon: LineChart,
    kicker: "Analyse shift",
    title: "Plant Manager",
    body: "OEE decomposition, station ranking, virtual-sensor inference log, and per-VIN quality lineage.",
  },
  {
    to: "/leadership",
    icon: ShieldCheck,
    kicker: "Value case",
    title: "Executive",
    body: "Downtime cost avoided, annualised impact, and the three-phase rollout across the plant network.",
  },
] as const;

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-20 border-b border-border bg-background/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3">
          <div className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-sm border border-primary/50 bg-primary/12">
              <Factory className="size-4 text-primary" />
            </span>
            <span className="font-display text-sm font-semibold">
              DigitalTwin<span className="text-primary">.ai</span>
            </span>
          </div>
          <Link
            to="/supervisor"
            className="inline-flex items-center gap-1.5 rounded-sm bg-primary px-3.5 py-2 text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-90"
          >
            Open console <ArrowRight className="size-3.5" />
          </Link>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="panel-grid relative border-b border-border">
          <div className="mx-auto max-w-6xl px-5 py-20 md:py-28">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary/10 px-3 py-1">
              <span className="live-pulse size-1.5 rounded-full bg-primary" />
              <span className="label-caps text-primary">Live discrete-event twin</span>
            </div>

            <h1 className="mt-6 max-w-3xl font-display text-4xl font-bold leading-[1.05] tracking-tight text-foreground md:text-6xl">
              See the line stall
              <span className="block text-primary">before the line stalls.</span>
            </h1>

            <p className="mt-5 max-w-2xl text-base leading-relaxed text-muted-foreground md:text-lg">
              {DESCRIPTION}
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                to="/supervisor"
                className="inline-flex items-center gap-2 rounded-sm bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
              >
                Launch the console <ArrowRight className="size-4" />
              </Link>
              <Link
                to="/leadership"
                className="inline-flex items-center gap-2 rounded-sm border border-border bg-surface px-5 py-3 text-sm font-medium text-foreground transition-colors hover:border-primary/40 hover:bg-secondary"
              >
                See the value case
              </Link>
            </div>

            <dl className="mt-14 grid max-w-3xl grid-cols-2 gap-px overflow-hidden rounded-sm border border-border bg-border md:grid-cols-4">
              {[
                { k: "Takt time", v: "60s" },
                { k: "Stations modelled", v: "8" },
                { k: "Forecast horizon", v: "45 min" },
                { k: "Downtime cost", v: "$22k/min" },
              ].map((s) => (
                <div key={s.k} className="bg-surface px-4 py-4">
                  <dt className="label-caps text-muted-foreground">{s.k}</dt>
                  <dd className="mt-1 font-mono text-xl font-semibold text-foreground">{s.v}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        {/* Problem */}
        <section className="border-b border-border">
          <div className="mx-auto grid max-w-6xl gap-10 px-5 py-16 md:grid-cols-2 md:py-20">
            <div>
              <span className="label-caps text-primary">The gap</span>
              <h2 className="mt-3 font-display text-2xl font-bold tracking-tight md:text-3xl">
                Dashboards report the past. The line needs the next 40 minutes.
              </h2>
              <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
                Conventional MES reporting confirms a stoppage after throughput has already been
                lost, and manual stations stay invisible because they carry no instrumentation. By
                the time the andon board lights up, the buffer that could have absorbed the
                disruption is empty.
              </p>
            </div>
            <ul className="grid gap-px overflow-hidden rounded-sm border border-border bg-border">
              {[
                { icon: Gauge, t: "Reactive alerts", d: "Signal arrives after the units are gone." },
                { icon: Boxes, t: "Dark stations", d: "Manual work cells report nothing at all." },
                {
                  icon: Activity,
                  t: "Misattributed faults",
                  d: "The station that halts is rarely the station that failed.",
                },
              ].map((i) => (
                <li key={i.t} className="flex gap-3 bg-surface px-5 py-5">
                  <i.icon className="mt-0.5 size-4 shrink-0 text-critical" />
                  <div>
                    <p className="text-sm font-semibold text-foreground">{i.t}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{i.d}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Capabilities */}
        <section className="border-b border-border">
          <div className="mx-auto max-w-6xl px-5 py-16 md:py-20">
            <span className="label-caps text-primary">Engine stack</span>
            <h2 className="mt-3 max-w-2xl font-display text-2xl font-bold tracking-tight md:text-3xl">
              Four engines running against one simulated line state.
            </h2>
            <div className="mt-10 grid gap-px overflow-hidden rounded-sm border border-border bg-border md:grid-cols-2">
              {CAPABILITIES.map((c) => (
                <article key={c.title} className="bg-surface p-6">
                  <span className="flex size-9 items-center justify-center rounded-sm border border-accent/40 bg-accent/10">
                    <c.icon className="size-4 text-accent" />
                  </span>
                  <h3 className="mt-4 font-display text-base font-semibold text-foreground">
                    {c.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{c.body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* Pipeline */}
        <section className="hatch border-b border-border">
          <div className="mx-auto max-w-6xl px-5 py-16 md:py-20">
            <span className="label-caps text-primary">Signal path</span>
            <h2 className="mt-3 font-display text-2xl font-bold tracking-tight md:text-3xl">
              From scan event to prescribed action.
            </h2>
            <ol className="mt-10 grid gap-px overflow-hidden rounded-sm border border-border bg-border md:grid-cols-4">
              {PIPELINE.map((p) => (
                <li key={p.step} className="bg-surface p-6">
                  <span className="font-mono text-xs text-primary">{p.step}</span>
                  <p className="mt-2 font-display text-base font-semibold text-foreground">
                    {p.label}
                  </p>
                  <p className="mt-1.5 text-sm text-muted-foreground">{p.detail}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Views */}
        <section className="border-b border-border">
          <div className="mx-auto max-w-6xl px-5 py-16 md:py-20">
            <span className="label-caps text-primary">Console</span>
            <h2 className="mt-3 font-display text-2xl font-bold tracking-tight md:text-3xl">
              One twin, three stakeholder views.
            </h2>
            <div className="mt-10 grid gap-4 md:grid-cols-3">
              {VIEWS.map((v) => (
                <Link
                  key={v.to}
                  to={v.to}
                  className="group flex flex-col rounded-sm border border-border bg-surface p-6 transition-colors hover:border-primary/45 hover:bg-secondary"
                >
                  <span className="flex size-9 items-center justify-center rounded-sm border border-primary/40 bg-primary/10">
                    <v.icon className="size-4 text-primary" />
                  </span>
                  <span className="label-caps mt-4 text-muted-foreground">{v.kicker}</span>
                  <h3 className="mt-1 font-display text-lg font-semibold text-foreground">
                    {v.title}
                  </h3>
                  <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">
                    {v.body}
                  </p>
                  <span className="mt-5 inline-flex items-center gap-1.5 text-xs font-semibold text-primary">
                    Open view{" "}
                    <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="panel-grid">
          <div className="mx-auto max-w-3xl px-5 py-20 text-center">
            <h2 className="font-display text-2xl font-bold tracking-tight md:text-4xl">
              Run the stall scenario yourself.
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-muted-foreground">
              Switch between a nominal shift, a Station 3 stall, and a Station 5 quality drift — the
              twin re-simulates the whole line in the browser, deterministically.
            </p>
            <Link
              to="/supervisor"
              className="mt-8 inline-flex items-center gap-2 rounded-sm bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
            >
              Launch the console <ArrowRight className="size-4" />
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-6">
          <p className="font-mono text-xs text-muted-foreground">
            DigitalTwin.ai · predictive assembly intelligence
          </p>
          <p className="text-xs text-muted-foreground">Simulated data · prototype build</p>
        </div>
      </footer>
    </div>
  );
}
