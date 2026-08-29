import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { Activity, ChevronLeft, Factory, LineChart, ShieldCheck } from "lucide-react";

import { Toaster } from "@/components/ui/sonner";
import { Tag } from "@/components/twin/Panel";
import { TwinProvider, useTwin, SCENARIOS } from "@/lib/twin/useTwin";

export const Route = createFileRoute("/_console")({
  component: ConsoleLayout,
});

const NAV = [
  { to: "/supervisor", label: "Floor Supervisor", icon: Activity, blurb: "Act now" },
  { to: "/plant-manager", label: "Plant Manager", icon: LineChart, blurb: "Analyse shift" },
  { to: "/leadership", label: "Executive", icon: ShieldCheck, blurb: "Value case" },
] as const;

function ConsoleLayout() {
  return (
    <TwinProvider>
      <div className="flex min-h-screen bg-background">
        <ConsoleSidebar />
        <main className="min-w-0 flex-1">
          <Outlet />
        </main>
      </div>
      <Toaster position="bottom-right" />
    </TwinProvider>
  );
}

function ConsoleSidebar() {
  const { scenarioId, setScenarioId, result } = useTwin();
  const critical = result.lookahead.total_forecasted_disruptions > 0;

  return (
    <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col overflow-y-auto border-r border-border bg-sidebar lg:flex">
      <div className="border-b border-border px-4 py-4">
        <Link to="/" className="group flex items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-sm border border-primary/50 bg-primary/12">
            <Factory className="size-4 text-primary" />
          </span>
          <span className="min-w-0">
            <span className="block font-display text-sm font-semibold leading-tight">
              DigitalTwin<span className="text-primary">.ai</span>
            </span>
            <span className="block text-[10px] leading-tight text-muted-foreground">
              Predictive assembly twin
            </span>
          </span>
        </Link>
      </div>

      <nav className="border-b border-border p-3">
        <div className="label-caps mb-2 px-1 text-muted-foreground">Stakeholder view</div>
        <div className="flex flex-col gap-1">
          {NAV.map(({ to, label, icon: Icon, blurb }) => (
            <Link
              key={to}
              to={to}
              className="flex items-center gap-2.5 rounded-sm px-2.5 py-2 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              activeProps={{
                className:
                  "bg-primary/12 text-foreground border-l-2 border-primary hover:bg-primary/12",
              }}
            >
              <Icon className="size-4 shrink-0" />
              <span className="min-w-0">
                <span className="block leading-tight">{label}</span>
                <span className="block text-[10px] leading-tight text-muted-foreground">
                  {blurb}
                </span>
              </span>
            </Link>
          ))}
        </div>
      </nav>

      <div className="flex-1 p-3">
        <div className="label-caps mb-2 px-1 text-muted-foreground">Stress-test scenario</div>
        <div className="flex flex-col gap-1.5">
          {SCENARIOS.map((s) => {
            const active = s.id === scenarioId;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => setScenarioId(s.id)}
                className={
                  active
                    ? "rounded-sm border border-primary/55 bg-primary/12 px-2.5 py-2 text-left transition-colors"
                    : "rounded-sm border border-border bg-surface px-2.5 py-2 text-left transition-colors hover:border-primary/35 hover:bg-secondary"
                }
              >
                <span
                  className={
                    active
                      ? "block text-sm font-medium leading-tight text-primary"
                      : "block text-sm font-medium leading-tight text-foreground"
                  }
                >
                  {s.label}
                </span>
                <span className="mt-0.5 block text-[10px] leading-snug text-muted-foreground">
                  {s.description}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="border-t border-border p-3">
        <div className="flex items-center justify-between">
          <span className="label-caps text-muted-foreground">Line state</span>
          {critical ? <Tag tone="critical">at risk</Tag> : <Tag tone="nominal">nominal</Tag>}
        </div>
        <div className="mt-2 font-mono text-[11px] text-muted-foreground">
          T+{Math.round(result.snapshot.current_time_seconds / 60)} min ·{" "}
          {result.snapshot.event_count} events
        </div>
        <Link
          to="/"
          className="mt-3 flex items-center gap-1 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
        >
          <ChevronLeft className="size-3" /> Back to overview
        </Link>
      </div>
    </aside>
  );
}
