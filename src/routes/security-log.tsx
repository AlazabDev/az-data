import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { KeyRound, Loader2, RefreshCw, ShieldAlert } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { StatusPill } from "@/components/status";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { formatDate } from "@/lib/registry-types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/security-log")({
  head: () => ({
    meta: [
      { title: "Security Log — Alazab Data Platform" },
      {
        name: "description",
        content:
          "Admin-only trail of authentication and file storage events across the Alazab Data Platform.",
      },
      { property: "og:title", content: "Security Log — Alazab Data Platform" },
      {
        property: "og:description",
        content: "Sign-in attempts, sessions and storage uploads recorded for platform administrators.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SecurityLogPage,
});

type SecurityEvent = {
  id: string;
  category: string;
  event_type: string;
  status: string;
  actor_email: string | null;
  description: string | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
};

const FILTERS = ["all", "auth", "storage", "failure"] as const;
type Filter = (typeof FILTERS)[number];

function SecurityLogPage() {
  const { t, te, lang } = useI18n();
  const { roles } = useAuth();
  const isAdmin = roles.includes("platform_owner") || roles.includes("platform_admin");
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");

  const events = useQuery({
    queryKey: ["adp_security_events", filter],
    enabled: isAdmin,
    queryFn: async (): Promise<SecurityEvent[]> => {
      let query = supabase
        .from("adp_security_events")
        .select("id,category,event_type,status,actor_email,description,ip_address,user_agent,created_at")
        .order("created_at", { ascending: false })
        .limit(500);
      if (filter === "auth" || filter === "storage") query = query.eq("category", filter);
      if (filter === "failure") query = query.eq("status", "failure");
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as SecurityEvent[];
    },
  });

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return events.data ?? [];
    return (events.data ?? []).filter((row) =>
      [row.event_type, row.actor_email, row.description, row.ip_address]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(term)),
    );
  }, [events.data, search]);

  if (!isAdmin) {
    return (
      <AppShell title={t("nav_security_log")} description={t("security_log_desc")}>
        <div className="panel flex items-center gap-3 p-6 text-sm text-muted-foreground">
          <ShieldAlert className="size-5 text-warning" />
          {t("security_log_forbidden")}
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell
      title={t("nav_security_log")}
      description={t("security_log_desc")}
      actions={
        <Button variant="outline" size="sm" onClick={() => void events.refetch()}>
          <RefreshCw className={cn("size-4", events.isFetching && "animate-spin")} />
          {t("refresh")}
        </Button>
      }
    >
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={cn(
              "rounded-md border border-border px-3 py-1.5 text-xs transition-colors",
              filter === f ? "bg-primary/10 font-medium text-primary" : "text-muted-foreground hover:bg-muted",
            )}
          >
            {t(`security_filter_${f}`)}
          </button>
        ))}
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("search")}
          className="h-8 w-full max-w-xs"
        />
      </div>

      <div className="panel overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-xs tracking-wide text-muted-foreground uppercase">
              <th className="px-4 py-3 text-start font-medium">{t("when")}</th>
              <th className="px-4 py-3 text-start font-medium">{t("actor")}</th>
              <th className="px-4 py-3 text-start font-medium">{t("category")}</th>
              <th className="px-4 py-3 text-start font-medium">{t("event")}</th>
              <th className="px-4 py-3 text-start font-medium">{t("status")}</th>
              <th className="px-4 py-3 text-start font-medium">{t("details")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {events.isLoading ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                  <Loader2 className="mx-auto size-4 animate-spin" />
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                  {t("no_records")}
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} className="hover:bg-muted/40">
                  <td className="px-4 py-3 font-mono text-xs whitespace-nowrap text-muted-foreground">
                    {formatDate(row.created_at, lang)}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">{row.actor_email ?? "—"}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                      <KeyRound className="size-3.5" />
                      {te(row.category)}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">{row.event_type}</td>
                  <td className="px-4 py-3">
                    <StatusPill
                      value={row.status}
                      tone={row.status === "failure" ? "critical" : "success"}
                    />
                  </td>
                  <td className="max-w-[22rem] truncate px-4 py-3 text-xs text-muted-foreground" title={row.description ?? ""}>
                    {row.description ?? "—"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
