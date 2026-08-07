import { createFileRoute, Link } from "@tanstack/react-router";
import { RegistryPage, type Column } from "@/components/registry-page";
import { StatusPill } from "@/components/status";
import { useI18n } from "@/lib/i18n";
import { enumLabels } from "@/lib/i18n";
import {
  CRITICALITY_LEVELS,
  LIFECYCLE_STATUSES,
  type SystemRow,
} from "@/lib/registry-types";
import type { FieldSpec } from "@/components/record-form";

export const Route = createFileRoute("/systems/")({
  head: () => ({
    meta: [
      { title: "Systems Registry — Alazab Data Platform" },
      {
        name: "description",
        content:
          "Registry of every Alazab business system with owners, criticality and lifecycle status.",
      },
      { property: "og:title", content: "Systems Registry — Alazab Data Platform" },
      {
        property: "og:description",
        content: "Every Alazab business system, its owners, criticality and lifecycle status.",
      },
    ],
  }),
  component: SystemsPage,
});

function SystemsPage() {
  const { lang } = useI18n();
  const opts = (values: readonly string[]) =>
    values.map((v) => ({ value: v, label: enumLabels[v]?.[lang] ?? v }));

  const fields: FieldSpec[] = [
    { name: "name", labelKey: "name", type: "text", required: true },
    { name: "code", labelKey: "code", type: "text", required: true },
    { name: "status", labelKey: "status", type: "select", options: opts(LIFECYCLE_STATUSES) },
    {
      name: "criticality",
      labelKey: "criticality",
      type: "select",
      options: opts(CRITICALITY_LEVELS),
    },
    { name: "business_owner", labelKey: "business_owner", type: "text" },
    { name: "technical_owner", labelKey: "technical_owner", type: "text" },
    { name: "purpose", labelKey: "purpose", type: "textarea" },
    { name: "operational_notes", labelKey: "operational_notes", type: "textarea" },
  ];

  const columns: Column<SystemRow>[] = [
    {
      key: "name",
      labelKey: "name",
      render: (r) => (
        <Link
          to="/systems/$systemId"
          params={{ systemId: r.id }}
          className="font-medium text-primary underline-offset-4 hover:underline"
        >
          {r.name}
        </Link>
      ),
    },
    { key: "code", labelKey: "code", render: (r) => <span className="font-mono text-xs">{r.code}</span> },
    { key: "status", labelKey: "status", render: (r) => <StatusPill value={r.status} /> },
    {
      key: "criticality",
      labelKey: "criticality",
      render: (r) => <StatusPill value={r.criticality} />,
    },
    {
      key: "owner",
      labelKey: "technical_owner",
      render: (r) => <span className="text-muted-foreground">{r.technical_owner ?? "—"}</span>,
    },
  ];

  return (
    <RegistryPage<SystemRow>
      table="systems"
      titleKey="nav_systems"
      descriptionKey="discovery_note"
      columns={columns}
      fields={fields}
      searchOf={(r) => `${r.name} ${r.code} ${r.technical_owner ?? ""}`}
    />
  );
}
