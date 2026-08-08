import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { useTheme } from "@/lib/theme";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Platform Settings — Alazab Data Platform" },
      {
        name: "description",
        content:
          "Configure identity, sign-in providers, cloud storage limits and data governance policies for the Alazab Data Platform.",
      },
      { property: "og:title", content: "Platform Settings — Alazab Data Platform" },
      {
        property: "og:description",
        content: "Central control panel for identity, storage and governance settings.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SettingsPage,
});

type FieldType = "text" | "number" | "bool" | "select";

type Field = {
  key: string;
  label: string;
  type: FieldType;
  options?: { value: string; label: string }[];
};

type Section = { title: string; fields: Field[] };

function SettingsPage() {
  const { t, lang, setLang } = useI18n();
  const { roles } = useAuth();
  const { theme, setTheme } = useTheme();
  const isAdmin = roles.includes("platform_owner") || roles.includes("platform_admin");

  const [draft, setDraft] = useState<Record<string, unknown>>({});
  const [saving, setSaving] = useState(false);

  const settings = useQuery({
    queryKey: ["adp_settings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("adp_settings").select("key,value");
      if (error) throw error;
      const map: Record<string, unknown> = {};
      for (const row of data ?? []) map[row.key] = row.value;
      return map;
    },
  });

  useEffect(() => {
    if (settings.data) setDraft(settings.data);
  }, [settings.data]);

  const endpoints = useQuery({
    queryKey: ["storage_endpoints", "settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("storage_endpoints")
        .select("key,label,provider,endpoint_url,region,default_bucket,is_active")
        .order("label");
      if (error) throw error;
      return data ?? [];
    },
  });

  const sections: Section[] = useMemo(
    () => [
      {
        title: t("settings_platform"),
        fields: [
          { key: "platform.name_ar", label: t("platform_name_ar"), type: "text" },
          { key: "platform.name_en", label: t("platform_name_en"), type: "text" },
          { key: "platform.domain", label: t("domain"), type: "text" },
        ],
      },
      {
        title: t("settings_auth"),
        fields: [
          { key: "auth.password_enabled", label: t("enable_password"), type: "bool" },
          { key: "auth.google_enabled", label: t("enable_google"), type: "bool" },
          { key: "auth.microsoft_enabled", label: t("enable_microsoft"), type: "bool" },
          { key: "auth.whatsapp_enabled", label: t("enable_whatsapp"), type: "bool" },
        ],
      },
      {
        title: t("settings_storage"),
        fields: [
          { key: "storage.presign_seconds", label: t("presign_seconds"), type: "number" },
          { key: "storage.max_upload_mb", label: t("max_upload_mb"), type: "number" },
          { key: "storage.multi_upload", label: t("multi_upload"), type: "bool" },
        ],
      },
      {
        title: t("settings_governance"),
        fields: [
          { key: "governance.audit_retention_days", label: t("audit_retention_days"), type: "number" },
          { key: "governance.require_backup", label: t("require_backup"), type: "bool" },
          { key: "governance.health_check_hours", label: t("health_check_hours"), type: "number" },
        ],
      },
    ],
    [t],
  );

  async function handleSave() {
    setSaving(true);
    try {
      const rows = sections
        .flatMap((s) => s.fields)
        .map((f) => ({ key: f.key, value: (draft[f.key] ?? null) as never }));
      const { error } = await supabase.from("adp_settings").upsert(rows, { onConflict: "key" });
      if (error) throw error;
      toast.success(t("settings_saved"));
      void settings.refetch();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  function renderField(f: Field) {
    const value = draft[f.key];
    if (f.type === "bool") {
      return (
        <label key={f.key} className="flex items-center justify-between gap-3 py-2 text-sm">
          <span>{f.label}</span>
          <input
            type="checkbox"
            className="size-4 accent-[hsl(var(--primary))]"
            disabled={!isAdmin}
            checked={value === true || value === "true"}
            onChange={(e) => setDraft((d) => ({ ...d, [f.key]: e.target.checked }))}
          />
        </label>
      );
    }
    return (
      <div key={f.key} className="space-y-1.5 py-2">
        <Label htmlFor={f.key}>{f.label}</Label>
        <Input
          id={f.key}
          type={f.type === "number" ? "number" : "text"}
          disabled={!isAdmin}
          value={value === null || value === undefined ? "" : String(value)}
          onChange={(e) =>
            setDraft((d) => ({
              ...d,
              [f.key]: f.type === "number" ? Number(e.target.value) : e.target.value,
            }))
          }
        />
      </div>
    );
  }

  return (
    <AppShell title={t("nav_settings")} description={t("settings_desc")}>
      {settings.isLoading ? (
        <p className="text-sm text-muted-foreground">{t("loading")}</p>
      ) : (
        <div className="space-y-5">
          {!isAdmin ? (
            <p className="panel p-3 text-sm text-muted-foreground">{t("admin_only")}</p>
          ) : null}

          <div className="panel p-4">
            <p className="mb-2 text-sm font-medium">{t("settings_appearance")}</p>
            <div className="flex flex-wrap gap-2">
              <Button variant={lang === "ar" ? "default" : "outline"} size="sm" onClick={() => setLang("ar")}>
                العربية
              </Button>
              <Button variant={lang === "en" ? "default" : "outline"} size="sm" onClick={() => setLang("en")}>
                English
              </Button>
              <Button
                variant={theme === "light" ? "default" : "outline"}
                size="sm"
                onClick={() => setTheme("light")}
              >
                {t("light")}
              </Button>
              <Button
                variant={theme === "dark" ? "default" : "outline"}
                size="sm"
                onClick={() => setTheme("dark")}
              >
                {t("dark")}
              </Button>
            </div>
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            {sections.map((s) => (
              <div key={s.title} className="panel p-4">
                <p className="mb-2 text-sm font-medium">{s.title}</p>
                <div className="divide-y divide-border">{s.fields.map(renderField)}</div>
              </div>
            ))}
          </div>

          <div className="panel p-4">
            <p className="mb-3 text-sm font-medium">{t("settings_endpoints")}</p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-xs tracking-wide text-muted-foreground uppercase">
                    <th className="px-3 py-2 text-start font-medium">{t("name")}</th>
                    <th className="px-3 py-2 text-start font-medium">{t("provider")}</th>
                    <th className="px-3 py-2 text-start font-medium">Endpoint</th>
                    <th className="px-3 py-2 text-start font-medium">{t("status")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {(endpoints.data ?? []).map((ep) => (
                    <tr key={ep.key}>
                      <td className="px-3 py-2">{ep.label}</td>
                      <td className="px-3 py-2 font-mono text-xs">{ep.provider}</td>
                      <td className="max-w-[320px] truncate px-3 py-2 font-mono text-xs text-muted-foreground">
                        {ep.endpoint_url} · {ep.region}
                      </td>
                      <td className="px-3 py-2">
                        <span className={ep.is_active ? "text-success" : "text-muted-foreground"}>
                          {ep.is_active ? "active" : "inactive"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {isAdmin ? (
            <div className="flex justify-end">
              <Button disabled={saving} onClick={() => void handleSave()}>
                {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                {t("save")}
              </Button>
            </div>
          ) : null}
        </div>
      )}
    </AppShell>
  );
}
