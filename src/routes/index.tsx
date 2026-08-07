import { createFileRoute, Link } from "@tanstack/react-router";
import { AlertTriangle, ArrowLeftRight, ShieldAlert } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Metric, StatusPill } from "@/components/status";
import { useI18n } from "@/lib/i18n";
import { useRows } from "@/lib/registry-hooks";
import {
  formatDate,
  type AuditRow,
  type DataSourceRow,
  type DatabaseRow,
  type EnvironmentRow,
  type SystemRow,
} from "@/lib/registry-types";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Alazab Data Platform — Control Plane" },
      {
        name: "description",
        content:
          "Central control plane for Alazab data infrastructure: systems, databases, environments, ownership, backups and audit.",
      },
      { property: "og:title", content: "Alazab Data Platform — Control Plane" },
      {
        property: "og:description",
        content:
          "Unified visibility and governance over every Alazab system, database and data source.",
      },
    ],
  }),
  component: Overview,
});

function Overview() {
  const { t, te, lang } = useI18n();
  const systems = useRows<SystemRow>("systems", "name", true);
  const envs = useRows<EnvironmentRow>("environments", "name", true);
  const dbs = useRows<DatabaseRow>("databases", "name", true);
  const sources = useRows<DataSourceRow>("data_sources", "name", true);
  const audit = useRows<AuditRow>("audit_logs", "created_at", false);

  const dbRows = dbs.data ?? [];
  const prodEnvs = (envs.data ?? []).filter((e) => e.kind === "production");
  const health = {
    healthy: dbRows.filter((d) => d.health === "healthy").length,
    warning: dbRows.filter((d) => d.health === "warning").length,
    critical: dbRows.filter((d) => d.health === "critical").length,
    unknown: dbRows.filter((d) => d.health === "unknown").length,
  };
  const noBackup = dbRows.filter((d) => d.backup_required && !d.last_backup_at);
  const noRestore = dbRows.filter((d) => !d.restore_verified);
  const noHealthCheck = dbRows.filter((d) => !d.last_health_check_at);
  const noOwner = dbRows.filter((d) => !d.technical_owner && !d.business_owner);

  return (
    <AppShell title={t("nav_overview")} description={t("platform_tagline")}>
      <p className="mb-6 flex items-start gap-2 rounded-md border border-primary/25 bg-primary/8 p-3 text-sm text-muted-foreground">
        <ArrowLeftRight className="mt-0.5 size-4 shrink-0 text-primary" />
        {t("discovery_note")}
      </p>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label={t("total_systems")} value={systems.data?.length ?? 0} tone="info" />
        <Metric label={t("total_databases")} value={dbRows.length} />
        <Metric label={t("total_data_sources")} value={sources.data?.length ?? 0} />
        <Metric
          label={t("production_envs")}
          value={prodEnvs.length}
          tone={prodEnvs.length ? "critical" : "neutral"}
        />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <section className="panel p-4">
          <h2 className="text-sm font-semibold">{t("health_breakdown")}</h2>
          <div className="mt-4 space-y-3">
            {(["healthy", "warning", "critical", "unknown"] as const).map((k) => {
              const total = dbRows.length || 1;
              const pct = Math.round((health[k] / total) * 100);
              return (
                <div key={k}>
                  <div className="flex items-center justify-between text-xs">
                    <StatusPill value={k} />
                    <span className="font-mono text-muted-foreground">
                      {health[k]} · {pct}%
                    </span>
                  </div>
                  <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className={
                        k === "healthy"
                          ? "h-full bg-success"
                          : k === "warning"
                            ? "h-full bg-warning"
                            : k === "critical"
                              ? "h-full bg-destructive"
                              : "h-full bg-neutral-signal"
                      }
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="panel p-4">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <ShieldAlert className="size-4 text-warning" />
            {t("needs_attention")}
          </h2>
          <ul className="mt-4 space-y-2 text-sm">
            {[
              { label: t("backup_missing"), rows: noBackup },
              { label: t("restore_untested"), rows: noRestore },
              { label: t("never_health_checked"), rows: noHealthCheck },
              { label: t("unknown_owner"), rows: noOwner },
            ].map((group) => (
              <li
                key={group.label}
                className="flex items-center justify-between rounded-md border border-border px-3 py-2"
              >
                <span className="text-muted-foreground">{group.label}</span>
                <span className="flex items-center gap-2">
                  <span
                    className={
                      group.rows.length
                        ? "font-mono text-sm font-semibold text-warning"
                        : "font-mono text-sm text-success"
                    }
                  >
                    {group.rows.length}
                  </span>
                  <Link
                    to="/databases"
                    className="text-xs text-primary underline-offset-4 hover:underline"
                  >
                    {t("view_source")}
                  </Link>
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="panel mt-6 p-4">
        <h2 className="text-sm font-semibold">{t("recent_activity")}</h2>
        {audit.isLoading ? (
          <p className="mt-3 text-sm text-muted-foreground">{t("loading")}</p>
        ) : (audit.data ?? []).length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">{t("no_records")}</p>
        ) : (
          <ul className="mt-3 divide-y divide-border">
            {(audit.data ?? []).slice(0, 8).map((row) => (
              <li key={row.id} className="flex flex-wrap items-center gap-2 py-2 text-sm">
                <StatusPill
                  value={row.action}
                  tone={row.action === "delete" ? "critical" : "info"}
                />
                <span className="text-muted-foreground">{te(row.entity_type)}</span>
                <span className="font-medium">{row.entity_label ?? "—"}</span>
                <span className="ms-auto font-mono text-xs text-muted-foreground">
                  {formatDate(row.created_at, lang)}
                </span>
              </li>
            ))}
          </ul>
        )}
        <Link
          to="/audit"
          className="mt-3 inline-block text-xs text-primary underline-offset-4 hover:underline"
        >
          {t("nav_audit")}
        </Link>
      </section>

      {systems.data && systems.data.length > 0 ? (
        <section className="panel mt-6 p-4">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <AlertTriangle className="size-4 text-muted-foreground" />
            {t("nav_systems")}
          </h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {systems.data.map((s) => {
              const count = dbRows.filter((d) => d.system_id === s.id).length;
              return (
                <Link
                  key={s.id}
                  to="/systems/$systemId"
                  params={{ systemId: s.id }}
                  className="rounded-md border border-border p-3 transition-colors hover:border-primary/50"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{s.name}</span>
                    <StatusPill value={s.status} />
                  </div>
                  <p className="mt-1 font-mono text-xs text-muted-foreground">{s.code}</p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {t("total_databases")}: <span className="font-mono">{count}</span>
                  </p>
                </Link>
              );
            })}
          </div>
        </section>
      ) : null}
    </AppShell>
  );
}
