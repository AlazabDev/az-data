import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { StatusPill } from "@/components/status";
import { useI18n } from "@/lib/i18n";
import { useRows } from "@/lib/registry-hooks";
import { formatDate, type AuditRow } from "@/lib/registry-types";

export const Route = createFileRoute("/audit")({
  head: () => ({
    meta: [
      { title: "Audit Log — Alazab Data Platform" },
      {
        name: "description",
        content:
          "Immutable trail of every registry change on the Alazab Data Platform: who changed what and when.",
      },
      { property: "og:title", content: "Audit Log — Alazab Data Platform" },
      {
        property: "og:description",
        content: "Who changed what and when across the Alazab data registries.",
      },
    ],
  }),
  component: AuditPage,
});

function AuditPage() {
  const { t, te, lang } = useI18n();
  const audit = useRows<AuditRow>("audit_logs", "created_at", false);

  return (
    <AppShell title={t("nav_audit")}>
      <div className="panel overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-xs tracking-wide text-muted-foreground uppercase">
              <th className="px-4 py-3 text-start font-medium">{t("when")}</th>
              <th className="px-4 py-3 text-start font-medium">{t("actor")}</th>
              <th className="px-4 py-3 text-start font-medium">{t("action")}</th>
              <th className="px-4 py-3 text-start font-medium">{t("entity")}</th>
              <th className="px-4 py-3 text-start font-medium">{t("name")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {audit.isLoading ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                  {t("loading")}
                </td>
              </tr>
            ) : (audit.data ?? []).length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                  {t("no_records")}
                </td>
              </tr>
            ) : (
              (audit.data ?? []).map((row) => (
                <tr key={row.id} className="hover:bg-muted/40">
                  <td className="px-4 py-3 font-mono text-xs whitespace-nowrap text-muted-foreground">
                    {formatDate(row.created_at, lang)}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">{row.actor_email ?? "system"}</td>
                  <td className="px-4 py-3">
                    <StatusPill
                      value={row.action}
                      tone={row.action === "delete" ? "critical" : "info"}
                    />
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{te(row.entity_type)}</td>
                  <td className="px-4 py-3">{row.entity_label ?? "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
