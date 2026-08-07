import { createFileRoute } from "@tanstack/react-router";
import { RegistryPage, type Column } from "@/components/registry-page";
import { StatusPill } from "@/components/status";
import { enumLabels, useI18n } from "@/lib/i18n";
import { useRows } from "@/lib/registry-hooks";
import {
  ENVIRONMENT_KINDS,
  LIFECYCLE_STATUSES,
  type EnvironmentRow,
  type SystemRow,
} from "@/lib/registry-types";
import type { FieldSpec } from "@/components/record-form";

export const Route = createFileRoute("/environments")({
  head: () => ({
    meta: [
      { title: "Environments Registry — Alazab Data Platform" },
      {
        name: "description",
        content:
          "Production, staging, testing and DR environments across all Alazab systems, clearly separated.",
      },
      { property: "og:title", content: "Environments Registry — Alazab Data Platform" },
      {
        property: "og:description",
        content: "Every environment across Alazab systems with its kind and lifecycle status.",
      },
    ],
  }),
  component: EnvironmentsPage,
});

function EnvironmentsPage() {
  const { lang } = useI18n();
  const systems = useRows<SystemRow>("systems", "name", true);
  const systemName = (id: string | null) =>
    (systems.data ?? []).find((s) => s.id === id)?.name ?? "—";

  const opts = (values: readonly string[]) =>
    values.map((v) => ({ value: v, label: enumLabels[v]?.[lang] ?? v }));

  const fields: FieldSpec[] = [
    { name: "name", labelKey: "name", type: "text", required: true },
    {
      name: "system_id",
      labelKey: "system",
      type: "select",
      required: true,
      options: (systems.data ?? []).map((s) => ({ value: s.id, label: s.name })),
    },
    {
      name: "kind",
      labelKey: "environment_kind",
      type: "select",
      required: true,
      options: opts(ENVIRONMENT_KINDS),
    },
    { name: "status", labelKey: "status", type: "select", options: opts(LIFECYCLE_STATUSES) },
    { name: "description", labelKey: "description", type: "textarea" },
    { name: "notes", labelKey: "notes", type: "textarea" },
  ];

  const columns: Column<EnvironmentRow>[] = [
    { key: "name", labelKey: "name", render: (r) => <span className="font-medium">{r.name}</span> },
    { key: "system", labelKey: "system", render: (r) => systemName(r.system_id) },
    { key: "kind", labelKey: "environment_kind", render: (r) => <StatusPill value={r.kind} /> },
    { key: "status", labelKey: "status", render: (r) => <StatusPill value={r.status} /> },
  ];

  return (
    <RegistryPage<EnvironmentRow>
      table="environments"
      titleKey="nav_environments"
      columns={columns}
      fields={fields}
      searchOf={(r) => `${r.name} ${systemName(r.system_id)} ${r.kind}`}
    />
  );
}
