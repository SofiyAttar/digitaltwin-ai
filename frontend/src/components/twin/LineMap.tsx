import { cn } from "@/lib/utils";
import type { LineSnapshot } from "@/lib/twin/factorySim";
import type { StationMetric } from "@/lib/twin/scenarios";

import { Tag } from "./Panel";

const healthStyles = {
  NOMINAL: {
    ring: "border-nominal/45",
    bar: "bg-nominal",
    text: "text-nominal",
    glow: "shadow-[0_0_0_1px_var(--nominal)_inset]",
  },
  WATCH: {
    ring: "border-watch/50",
    bar: "bg-watch",
    text: "text-watch",
    glow: "shadow-[0_0_0_1px_var(--watch)_inset]",
  },
  CRITICAL: {
    ring: "border-critical/60",
    bar: "bg-critical",
    text: "text-critical",
    glow: "shadow-[0_0_0_1px_var(--critical)_inset]",
  },
} as const;

export function LineMap({
  stations,
  snapshot,
  rootStationId,
}: {
  stations: StationMetric[];
  snapshot: LineSnapshot;
  rootStationId: string | null;
}) {
  return (
    <div className="overflow-x-auto">
      <div className="flex min-w-[900px] items-stretch gap-0">
        {stations.map((st, index) => {
          const style = healthStyles[st.health];
          const isRoot = rootStationId === st.id;
          const bufferName = `B${index + 1}`;
          const bufferLevel = snapshot.buffer_levels[bufferName] ?? 0;
          const capacity = snapshot.buffer_capacity;

          return (
            <div key={st.id} className="flex flex-1 items-stretch">
              <div
                className={cn(
                  "relative flex min-w-0 flex-1 flex-col rounded-md border bg-surface p-3",
                  style.ring,
                  isRoot && "live-pulse",
                )}
              >
                <div className={cn("absolute inset-x-0 top-0 h-[3px] rounded-t-md", style.bar)} />

                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-sm font-semibold tracking-wider">{st.id}</span>
                  {st.dark && <Tag tone="dark">dark</Tag>}
                </div>

                <div className="mt-1 line-clamp-2 min-h-[2.2rem] text-[11px] leading-snug text-muted-foreground">
                  {st.name}
                </div>

                <div className={cn("mt-2 font-mono text-lg font-semibold tabular-nums", style.text)}>
                  {st.avg_cycle_time}
                  <span className="ml-0.5 text-[10px] text-muted-foreground">s</span>
                </div>

                <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-secondary">
                  <div
                    className={cn("h-full", style.bar)}
                    style={{ width: `${Math.min(100, st.utilization_pct)}%` }}
                  />
                </div>
                <div className="mt-1 flex items-center justify-between font-mono text-[10px] text-muted-foreground">
                  <span>{st.utilization_pct}% util</span>
                  <span
                    className={cn(
                      st.status === "BLOCKED" && "text-critical",
                      st.status === "BUSY" && "text-accent",
                    )}
                  >
                    {st.status}
                  </span>
                </div>

                {isRoot && (
                  <div className="mt-2 rounded-sm border border-critical/50 bg-critical/12 px-1.5 py-0.5 text-center font-mono text-[9px] uppercase tracking-[0.12em] text-critical">
                    root cause
                  </div>
                )}
              </div>

              {index < stations.length - 1 && (
                <div className="flex w-10 shrink-0 flex-col items-center justify-center gap-1 px-1">
                  <div className="h-px w-full bg-border" />
                  <div
                    className={cn(
                      "flex flex-col items-center rounded-sm border px-1 py-0.5 font-mono text-[9px]",
                      bufferLevel >= capacity
                        ? "border-critical/50 bg-critical/12 text-critical"
                        : bufferLevel > 0
                          ? "border-watch/40 bg-watch/10 text-watch"
                          : "border-border bg-secondary text-muted-foreground",
                    )}
                    title={`Buffer ${bufferName}: ${bufferLevel}/${capacity}`}
                  >
                    <span>{bufferName}</span>
                    <span className="tabular-nums">
                      {bufferLevel}/{capacity}
                    </span>
                  </div>
                  <div className="h-px w-full bg-border" />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
