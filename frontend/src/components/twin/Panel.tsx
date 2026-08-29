import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export function Panel({
  title,
  subtitle,
  right,
  children,
  className,
  tone = "default",
}: {
  title?: string;
  subtitle?: string;
  right?: ReactNode;
  children: ReactNode;
  className?: string;
  tone?: "default" | "critical" | "accent" | "primary";
}) {
  const toneRing =
    tone === "critical"
      ? "border-critical/50"
      : tone === "accent"
        ? "border-accent/45"
        : tone === "primary"
          ? "border-primary/50"
          : "border-border";

  return (
    <section
      className={cn(
        "relative rounded-md border bg-card shadow-[0_1px_0_0_rgba(255,255,255,0.03)_inset]",
        toneRing,
        className,
      )}
    >
      {(title || right) && (
        <header className="flex items-start justify-between gap-4 border-b border-border/70 px-4 py-3">
          <div className="min-w-0">
            {title && <h2 className="label-caps text-muted-foreground">{title}</h2>}
            {subtitle && (
              <p className="mt-1 text-sm leading-snug text-foreground/80">{subtitle}</p>
            )}
          </div>
          {right && <div className="shrink-0">{right}</div>}
        </header>
      )}
      <div className="p-4">{children}</div>
    </section>
  );
}

export function StatBlock({
  label,
  value,
  unit,
  hint,
  tone = "default",
}: {
  label: string;
  value: string | number;
  unit?: string;
  hint?: string;
  tone?: "default" | "nominal" | "watch" | "critical" | "accent" | "primary";
}) {
  const valueTone = {
    default: "text-foreground",
    nominal: "text-nominal",
    watch: "text-watch",
    critical: "text-critical",
    accent: "text-accent",
    primary: "text-primary",
  }[tone];

  return (
    <div className="rounded-md border border-border bg-surface px-4 py-3">
      <div className="label-caps text-muted-foreground">{label}</div>
      <div className={cn("mt-2 flex items-baseline gap-1 font-mono", valueTone)}>
        <span className="text-2xl font-semibold tabular-nums tracking-tight">{value}</span>
        {unit && <span className="text-xs text-muted-foreground">{unit}</span>}
      </div>
      {hint && <div className="mt-1 text-xs leading-snug text-muted-foreground">{hint}</div>}
    </div>
  );
}

export function Tag({
  children,
  tone = "muted",
}: {
  children: ReactNode;
  tone?: "muted" | "nominal" | "watch" | "critical" | "accent" | "dark" | "primary";
}) {
  const styles = {
    muted: "border-border bg-secondary text-muted-foreground",
    nominal: "border-nominal/40 bg-nominal/10 text-nominal",
    watch: "border-watch/40 bg-watch/10 text-watch",
    critical: "border-critical/45 bg-critical/12 text-critical",
    accent: "border-accent/40 bg-accent/10 text-accent",
    dark: "border-dark-station/45 bg-dark-station/12 text-dark-station",
    primary: "border-primary/45 bg-primary/12 text-primary",
  }[tone];

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-sm border px-2 py-0.5 font-mono text-[10px] font-medium uppercase tracking-[0.12em]",
        styles,
      )}
    >
      {children}
    </span>
  );
}
