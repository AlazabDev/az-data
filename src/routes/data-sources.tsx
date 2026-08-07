import { createFileRoute } from "@tanstack/react-router";
import { RegistryPage, type Column } from "@/components/registry-page";
import { StatusPill } from "@/components/status";
import { enumLabels, useI18n } from "@/lib/i18n";
import { useRows } from "@/lib/registry-hooks";
import {
  CRITICALITY_LEVELS,
  DATASOURCE_KINDS,
  HEALTH_STATUSES,
  LIFECYCLE_STATUSES,
  type DataSourceRow,
  type EnvironmentRow,
  type SystemRow,
} from "@/lib/registry-types";
import type { FieldSpec } from "@/components/record-form";

export const Route = createFileRoute("/data-sources")({
  head: () => ({
    meta: [
      { title: "Data Sources Registry — Alazab Data Platform" },
      {
        name: "description",
        content:
          "APIs, file stores, queues, caches and warehouses that hold Alazab data outside relational databases.",
      },
      { property: "og:title", content: "Data Sources Registry — Alazab Data Platform" },
      {
        property: "og:description",
        content: "Non-database Alazab data sources with owners, location and health.",
      },
    ],
  }),
  component: DataSourcesPage,
});

function DataSourcesPage() {
  const { lang } = useI18n();
  const systems = useRows<SystemRow>("systems", "name", true);
  const envs = useRows<EnvironmentRow>("environments", "name", true);
  const systemName = (id: string | null) =>
    (systems.data ?? []).find((s) => s.id === id)?.name ?? "—";

  const opts = (values: readonly string[]) =>
    values.map((v) => ({ value: v, label: enumLabels[v]?.[lang] ?? v }));

  const fields: FieldSpec[] = [
    { name: "name", labelKey: "name", type: "text", required: true },
    { name: "code", labelKey: "code", type: "text", required: true },
    { name: "kind", labelKey: "kind", type: "select", required: true, options: opts(DATASOURCE_KINDS) },
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
    { name: "status", labelKey: "status", type: "select", options: opts(LIFECYCLE_STATUSES) },
    { name: "health", labelKey: "health", type: "select", options: opts(HEALTH_STATUSES) },
    {
      name: "criticality",
      labelKey: "criticality",
      type: "select",
      options: opts(CRITICALITY_LEVELS),
    },
    { name: "provider", labelKey: "provider", type: "text" },
    { name: "location", labelKey: "location", type: "text" },
    { name: "data_format", labelKey: "data_format", type: "text" },
    { name: "connection_reference", labelKey: "connection_reference", type: "text" },
    { name: "technical_owner", labelKey: "technical_owner", type: "text" },
    { name: "business_owner", labelKey: "business_owner", type: "text" },
    { name: "notes", labelKey: "notes", type: "textarea" },
  ];

  const columns: Column<DataSourceRow>[] = [
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
    { key: "kind", labelKey: "kind", render: (r) => <StatusPill value={r.kind} /> },
    { key: "system", labelKey: "system", render: (r) => systemName(r.system_id) },
    {
      key: "location",
      labelKey: "location",
      render: (r) => <span className="font-mono text-xs">{r.location ?? "—"}</span>,
    },
    { key: "health", labelKey: "health", render: (r) => <StatusPill value={r.health} /> },
    {
      key: "owner",
      labelKey: "technical_owner",
      render: (r) => <span className="text-muted-foreground">{r.technical_owner ?? "—"}</span>,
    },
  ];

  return (
    <RegistryPage<DataSourceRow>
      table="data_sources"
      titleKey="nav_data_sources"
      columns={columns}
      fields={fields}
      searchOf={(r) => `${r.name} ${r.code} ${r.kind} ${systemName(r.system_id)}`}
    />
  );
}
