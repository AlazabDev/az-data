import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { StatusPill } from "@/components/status";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { enumLabels, useI18n } from "@/lib/i18n";
import { useDeleteRow, useRows, useSaveRow } from "@/lib/registry-hooks";
import { supabase } from "@/integrations/supabase/client";
import type { AppRole } from "@/lib/registry-types";

export const Route = createFileRoute("/access")({
  head: () => ({
    meta: [
      { title: "Access Control — Alazab Data Platform" },
      {
        name: "description",
        content:
          "Role assignments for the Alazab Data Platform: owners, administrators, DBAs, engineers, analysts and read-only users.",
      },
      { property: "og:title", content: "Access Control — Alazab Data Platform" },
      {
        property: "og:description",
        content: "Manage who can read and who can change the Alazab data registries.",
      },
    ],
  }),
  component: AccessPage,
});

const ROLES: AppRole[] = [
  "platform_owner",
  "platform_admin",
  "database_administrator",
  "data_engineer",
  "application_owner",
  "integration_manager",
  "analyst",
  "read_only",
];

type ProfileRow = { id: string; email: string | null; full_name: string | null };
type RoleRow = { id: string; user_id: string; role: AppRole };

function AccessPage() {
  const { t, lang } = useI18n();
  const { roles: myRoles, user } = useAuth();
  const isOwner = myRoles.includes("platform_owner") || myRoles.includes("platform_admin");
  const profiles = useRows<ProfileRow>("profiles", "created_at", true);
  const userRoles = useRows<RoleRow>("user_roles", "created_at", true);
  const saveRole = useSaveRow("user_roles");
  const removeRole = useDeleteRow("user_roles");
  const [pending, setPending] = useState<string | null>(null);

  async function claimOwnership() {
    setPending("claim");
    const { error } = await supabase.rpc("claim_platform_ownership");
    setPending(null);
    if (error) toast.error(error.message);
    else {
      toast.success(t("saved"));
      window.location.reload();
    }
  }

  return (
    <AppShell title={t("nav_access")}>
      {!isOwner ? (
        <p className="mb-4 rounded-md border border-warning/30 bg-warning/10 p-3 text-sm text-warning">
          {t("read_only_notice")}
        </p>
      ) : null}

      {user && myRoles.length === 0 ? (
        <Button className="mb-4" disabled={pending === "claim"} onClick={() => void claimOwnership()}>
          {t("claim_ownership")}
        </Button>
      ) : null}

      <div className="panel overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-xs tracking-wide text-muted-foreground uppercase">
              <th className="px-4 py-3 text-start font-medium">{t("user")}</th>
              <th className="px-4 py-3 text-start font-medium">{t("role")}</th>
              {isOwner ? <th className="px-4 py-3" /> : null}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {(profiles.data ?? []).length === 0 ? (
              <tr>
                <td colSpan={3} className="px-4 py-8 text-center text-muted-foreground">
                  {t("no_records")}
                </td>
              </tr>
            ) : (
              (profiles.data ?? []).map((p) => {
                const assigned = (userRoles.data ?? []).filter((r) => r.user_id === p.id);
                return (
                  <tr key={p.id} className="align-top hover:bg-muted/40">
                    <td className="px-4 py-3">
                      <p className="font-medium">{p.full_name ?? "—"}</p>
                      <p className="font-mono text-xs text-muted-foreground">{p.email}</p>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1.5">
                        {assigned.length === 0 ? (
                          <StatusPill value="read_only" />
                        ) : (
                          assigned.map((r) => (
                            <span key={r.id} className="inline-flex items-center gap-1">
                              <StatusPill value={r.role} tone="info" />
                              {isOwner ? (
                                <button
                                  type="button"
                                  className="text-xs text-destructive"
                                  onClick={() =>
                                    removeRole.mutate(r.id, {
                                      onSuccess: () => toast.success(t("deleted")),
                                      onError: (e) => toast.error((e as Error).message),
                                    })
                                  }
                                >
                                  ×
                                </button>
                              ) : null}
                            </span>
                          ))
                        )}
                      </div>
                    </td>
                    {isOwner ? (
                      <td className="px-4 py-3 text-end">
                        <select
                          className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                          value=""
                          onChange={(e) => {
                            if (!e.target.value) return;
                            saveRole.mutate(
                              { user_id: p.id, role: e.target.value },
                              {
                                onSuccess: () => toast.success(t("saved")),
                                onError: (err) => toast.error((err as Error).message),
                              },
                            );
                            e.target.value = "";
                          }}
                        >
                          <option value="">{t("add")}…</option>
                          {ROLES.map((r) => (
                            <option key={r} value={r}>
                              {enumLabels[r]?.[lang] ?? r}
                            </option>
                          ))}
                        </select>
                      </td>
                    ) : null}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
