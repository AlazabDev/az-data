import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";

type Tone = "success" | "warning" | "critical" | "neutral" | "info";

const toneClass: Record<Tone, string> = {
  success: "bg-success/15 text-success border-success/30",
  warning: "bg-warning/15 text-warning border-warning/30",
  critical: "bg-destructive/15 text-destructive border-destructive/35",
  info: "bg-primary/15 text-primary border-primary/30",
  neutral: "bg-muted text-muted-foreground border-border",
};

const toneByValue: Record<string, Tone> = {
  healthy: "success",
  active: "success",
  production: "critical",
  warning: "warning",
  maintenance: "warning",
  high: "warning",
  critical: "critical",
  inactive: "neutral",
  deprecated: "warning",
  archived: "neutral",
  unknown: "neutral",
  medium: "info",
  low: "neutral",
  staging: "warning",
  development: "info",
  testing: "info",
  sandbox: "neutral",
  dr: "info",
  other: "neutral",
};

export function StatusPill({
  value,
  tone,
  className,
}: {
  value: string | null | undefined;
  tone?: Tone;
  className?: string;
}) {
  const { te } = useI18n();
  const resolved = tone ?? (value ? (toneByValue[value] ?? "neutral") : "neutral");
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap",
        toneClass[resolved],
        className,
      )}
    >
      <span className="size-1.5 rounded-full bg-current" />
      {te(value)}
    </span>
  );
}

export function Metric({
  label,
  value,
  hint,
  tone = "neutral",
}: {
  label: string;
  value: string | number;
  hint?: string;
  tone?: Tone;
}) {
  return (
    <div className="panel p-4">
      <p className="text-xs tracking-wide text-muted-foreground uppercase">{label}</p>
      <p
        className={cn(
          "mt-2 font-mono text-3xl leading-none font-semibold",
          tone === "critical" && "text-destructive",
          tone === "warning" && "text-warning",
          tone === "success" && "text-success",
          tone === "info" && "text-primary",
        )}
      >
        {value}
      </p>
      {hint ? <p className="mt-2 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
