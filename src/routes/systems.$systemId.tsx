import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { StatusPill } from "@/components/status";
import { useI18n } from "@/lib/i18n";
import { useRows } from "@/lib/registry-hooks";
import {
  formatDate,
  type DataSourceRow,
  type DatabaseRow,
  type EnvironmentRow,
  type SystemRow,
} from "@/lib/registry-types";

export const Route = createFileRoute("/systems/$systemId")({
  head: () => ({
    meta: [
      { title: "System Details — Alazab Data Platform" },
      {
        name: "description",
        content: "Full profile of an Alazab system: environments, databases, data sources and owners.",
      },
      { property: "og:title", content: "System Details — Alazab Data Platform" },
      {
        property: "og:description",
        content: "Environments, databases, data sources and ownership for a single Alazab system.",
      },
    ],
  }),
  component: SystemDetail,
});

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border py-2 last:border-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-end text-sm">{value ?? "—"}</span>
    </div>
  );
}

function SystemDetail() {
  const { systemId } = Route.useParams();
  const { t, lang } = useI18n();
  const systems = useRows<SystemRow>("systems", "name", true);
  const envs = useRows<EnvironmentRow>("environments", "name", true);
  const dbs = useRows<DatabaseRow>("databases", "name", true);
  const sources = useRows<DataSourceRow>("data_sources", "name", true);

  const system = (systems.data ?? []).find((s) => s.id === systemId);
  const sysEnvs = (envs.data ?? []).filter((e) => e.system_id === systemId);
  const sysDbs = (dbs.data ?? []).filter((d) => d.system_id === systemId);
  const sysSources = (sources.data ?? []).filter((s) => s.system_id === systemId);

  return (
    <AppShell title={system?.name ?? t("loading")} description={system?.purpose ?? undefined}>
      <Link to="/systems" className="text-xs text-primary underline-offset-4 hover:underline">
        ← {t("nav_systems")}
      </Link>

      {system ? (
        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          <section className="panel p-4">
            <h2 className="mb-2 text-sm font-semibold">{t("details")}</h2>
            <Row label={t("code")} value={<span className="font-mono text-xs">{system.code}</span>} />
            <Row label={t("status")} value={<StatusPill value={system.status} />} />
            <Row label={t("criticality")} value={<StatusPill value={system.criticality} />} />
            <Row label={t("business_owner")} value={system.business_owner ?? t("none")} />
            <Row label={t("technical_owner")} value={system.technical_owner ?? t("none")} />
            <Row label={t("notes")} value={system.notes ?? t("none")} />
          </section>

          <section className="panel p-4">
            <h2 className="mb-3 text-sm font-semibold">{t("nav_environments")}</h2>
            {sysEnvs.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("no_records")}</p>
            ) : (
              <ul className="space-y-2">
                {sysEnvs.map((e) => (
                  <li key={e.id} className="flex items-center justify-between gap-2 text-sm">
                    <span>{e.name}</span>
                    <StatusPill value={e.kind} />
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="panel p-4">
            <h2 className="mb-3 text-sm font-semibold">{t("nav_data_sources")}</h2>
            {sysSources.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("no_records")}</p>
            ) : (
              <ul className="space-y-2">
                {sysSources.map((s) => (
                  <li key={s.id} className="flex items-center justify-between gap-2 text-sm">
                    <span>{s.name}</span>
                    <StatusPill value={s.kind} />
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      ) : null}

      <section className="panel mt-4 overflow-x-auto">
        <h2 className="px-4 pt-4 text-sm font-semibold">{t("nav_databases")}</h2>
        <table className="mt-3 w-full text-sm">
          <thead>
            <tr className="border-b border-border text-xs tracking-wide text-muted-foreground uppercase">
              <th className="px-4 py-2 text-start font-medium">{t("name")}</th>
              <th className="px-4 py-2 text-start font-medium">{t("engine")}</th>
              <th className="px-4 py-2 text-start font-medium">{t("health")}</th>
              <th className="px-4 py-2 text-start font-medium">{t("last_backup")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {sysDbs.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-muted-foreground">
                  {t("no_records")}
                </td>
              </tr>
            ) : (
              sysDbs.map((d) => (
                <tr key={d.id}>
                  <td className="px-4 py-2">{d.name}</td>
                  <td className="px-4 py-2 font-mono text-xs">
                    {d.engine} {d.engine_version ?? ""}
                  </td>
                  <td className="px-4 py-2">
                    <StatusPill value={d.health} />
                  </td>
                  <td className="px-4 py-2 font-mono text-xs text-muted-foreground">
                    {formatDate(d.last_backup_at, lang) ?? t("never")}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>
    </AppShell>
  );
}
