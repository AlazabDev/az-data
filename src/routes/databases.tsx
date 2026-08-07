import { createFileRoute } from "@tanstack/react-router";
import { RegistryPage, type Column } from "@/components/registry-page";
import { StatusPill } from "@/components/status";
import { enumLabels, useI18n } from "@/lib/i18n";
import { useRows } from "@/lib/registry-hooks";
import {
  CRITICALITY_LEVELS,
  ENGINE_OPTIONS,
  HEALTH_STATUSES,
  LIFECYCLE_STATUSES,
  formatDate,
  type DatabaseRow,
  type EnvironmentRow,
  type SystemRow,
} from "@/lib/registry-types";
import type { FieldSpec } from "@/components/record-form";

export const Route = createFileRoute("/databases")({
  head: () => ({
    meta: [
      { title: "Database Registry — Alazab Data Platform" },
      {
        name: "description",
        content:
          "Every Alazab database with engine, version, owners, backup policy, restore verification and health.",
      },
      { property: "og:title", content: "Database Registry — Alazab Data Platform" },
      {
        property: "og:description",
        content: "Engines, versions, owners, backups and health for every Alazab database.",
      },
    ],
  }),
  component: DatabasesPage,
});

function DatabasesPage() {
  const { t, lang } = useI18n();
  const systems = useRows<SystemRow>("systems", "name", true);
  const envs = useRows<EnvironmentRow>("environments", "name", true);
  const systemName = (id: string | null) =>
    (systems.data ?? []).find((s) => s.id === id)?.name ?? "—";

  const opts = (values: readonly string[]) =>
    values.map((v) => ({ value: v, label: enumLabels[v]?.[lang] ?? v }));

  const fields: FieldSpec[] = [
    { name: "name", labelKey: "name", type: "text", required: true },
    { name: "code", labelKey: "code", type: "text", required: true },
    {
      name: "system_id",
      labelKey: "system",
      type: "select",
      options: (systems.data ?? []).map((s) => ({ value: s.id, label: s.name })),
    },
    {
      name: "environment_id",
      labelKey: "environment",
      type: "select",
      options: (envs.data ?? []).map((e) => ({
        value: e.id,
        label: `${e.name} — ${systemName(e.system_id)}`,
      })),
    },
    {
      name: "engine",
      labelKey: "engine",
      type: "select",
      options: ENGINE_OPTIONS.map((e) => ({ value: e, label: e })),
    },
    { name: "engine_version", labelKey: "engine_version", type: "text" },
    { name: "target_version", labelKey: "target_version", type: "text" },
    { name: "status", labelKey: "status", type: "select", options: opts(LIFECYCLE_STATUSES) },
    { name: "health", labelKey: "health", type: "select", options: opts(HEALTH_STATUSES) },
    {
      name: "criticality",
      labelKey: "criticality",
      type: "select",
      options: opts(CRITICALITY_LEVELS),
    },
    { name: "provider", labelKey: "provider", type: "text" },
    { name: "region", labelKey: "region", type: "text" },
    { name: "host", labelKey: "host", type: "text" },
    { name: "port", labelKey: "port", type: "number" },
    { name: "database_name", labelKey: "database_name", type: "text" },
    { name: "technical_owner", labelKey: "technical_owner", type: "text" },
    { name: "business_owner", labelKey: "business_owner", type: "text" },
    { name: "operations_owner", labelKey: "operations_owner", type: "text" },
    { name: "backup_required", labelKey: "backup_required", type: "boolean" },
    { name: "backup_policy", labelKey: "backup_policy", type: "text" },
    { name: "last_backup_at", labelKey: "last_backup", type: "datetime" },
    { name: "last_restore_test_at", labelKey: "last_restore_test", type: "datetime" },
    { name: "restore_verified", labelKey: "restore_verified", type: "boolean" },
    { name: "monitoring_policy", labelKey: "monitoring_policy", type: "text" },
    { name: "last_health_check_at", labelKey: "last_health_check", type: "datetime" },
    { name: "schema_version", labelKey: "schema_version", type: "text" },
    { name: "migration_version", labelKey: "migration_version", type: "text" },
    { name: "connection_reference", labelKey: "connection_reference", type: "text" },
    { name: "dependencies", labelKey: "dependencies", type: "textarea" },
    { name: "notes", labelKey: "notes", type: "textarea" },
  ];

  const columns: Column<DatabaseRow>[] = [
    {
      key: "name",
      labelKey: "name",
      render: (r) => (
        <div>
          <p className="font-medium">{r.name}</p>
          <p className="font-mono text-xs text-muted-foreground">{r.code}</p>
        </div>
      ),
    },
    { key: "system", labelKey: "system", render: (r) => systemName(r.system_id) },
    {
      key: "engine",
      labelKey: "engine",
      render: (r) => (
        <span className="font-mono text-xs">
          {r.engine ?? "—"} {r.engine_version ?? ""}
          {r.target_version && r.engine_version && r.target_version !== r.engine_version ? (
            <span className="ms-1 text-warning">→ {r.target_version}</span>
          ) : null}
        </span>
      ),
    },
    { key: "health", labelKey: "health", render: (r) => <StatusPill value={r.health} /> },
    {
      key: "backup",
      labelKey: "last_backup",
      render: (r) => (
        <span
          className={
            r.last_backup_at
              ? "font-mono text-xs text-muted-foreground"
              : "font-mono text-xs text-warning"
          }
        >
          {formatDate(r.last_backup_at, lang) ?? t("never")}
        </span>
      ),
    },
    {
      key: "restore",
      labelKey: "restore_verified",
      render: (r) => (
        <StatusPill
          value={r.restore_verified ? t("yes") : t("no")}
          tone={r.restore_verified ? "success" : "warning"}
        />
      ),
    },
    {
      key: "owner",
      labelKey: "technical_owner",
      render: (r) => <span className="text-muted-foreground">{r.technical_owner ?? "—"}</span>,
    },
  ];

  return (
    <RegistryPage<DatabaseRow>
      table="databases"
      titleKey="nav_databases"
      columns={columns}
      fields={fields}
      searchOf={(r) =>
        `${r.name} ${r.code} ${r.engine ?? ""} ${systemName(r.system_id)} ${r.technical_owner ?? ""}`
      }
    />
  );
}
