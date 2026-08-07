import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import {
  ChevronRight,
  Cloud,
  Download,
  Folder,
  HardDrive,
  Loader2,
  RefreshCw,
  Trash2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import {
  checkStorageEndpoint,
  deleteStorageObject,
  getStorageDownloadUrl,
  getStorageUploadUrl,
  listStorageBuckets,
  listStorageObjects,
} from "@/lib/storage.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/storage")({
  head: () => ({
    meta: [
      { title: "Cloud Storage Console — Alazab Data Platform" },
      {
        name: "description",
        content:
          "Browse, upload and manage objects across AWS S3, Google Cloud Storage, MinIO, Oracle, Cloudflare R2 and Supabase from one console.",
      },
      { property: "og:title", content: "Cloud Storage Console — Alazab Data Platform" },
      {
        property: "og:description",
        content: "Unified S3-compatible storage administration for Alazab systems.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: StoragePage,
});

type EndpointRow = {
  id: string;
  key: string;
  label: string;
  provider: string;
  endpoint_url: string;
  region: string;
  default_bucket: string | null;
  is_active: boolean;
};

function formatBytes(n: number) {
  if (!n) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.min(Math.floor(Math.log(n) / Math.log(1024)), units.length - 1);
  return `${(n / 1024 ** i).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

function StoragePage() {
  const { t, lang } = useI18n();
  const { canWrite } = useAuth();

  const listBuckets = useServerFn(listStorageBuckets);
  const listObjects = useServerFn(listStorageObjects);
  const downloadUrl = useServerFn(getStorageDownloadUrl);
  const uploadUrl = useServerFn(getStorageUploadUrl);
  const removeObject = useServerFn(deleteStorageObject);
  const checkEndpoint = useServerFn(checkStorageEndpoint);

  const [endpointKey, setEndpointKey] = useState<string | null>(null);
  const [bucket, setBucket] = useState<string | null>(null);
  const [prefix, setPrefix] = useState("");
  const [busy, setBusy] = useState(false);
  const [health, setHealth] = useState<Record<string, { ok: boolean; msg: string }>>({});
  const fileRef = useRef<HTMLInputElement>(null);

  const endpoints = useQuery({
    queryKey: ["storage_endpoints"],
    queryFn: async (): Promise<EndpointRow[]> => {
      const { data, error } = await supabase
        .from("storage_endpoints")
        .select("id,key,label,provider,endpoint_url,region,default_bucket,is_active")
        .order("label");
      if (error) throw error;
      return (data ?? []) as EndpointRow[];
    },
  });

  useEffect(() => {
    if (!endpointKey && endpoints.data?.length) setEndpointKey(endpoints.data[0]!.key);
  }, [endpoints.data, endpointKey]);

  const buckets = useQuery({
    queryKey: ["s3-buckets", endpointKey],
    enabled: !!endpointKey,
    queryFn: () => listBuckets({ data: { endpoint: endpointKey! } }),
  });

  const objects = useQuery({
    queryKey: ["s3-objects", endpointKey, bucket, prefix],
    enabled: !!endpointKey && !!bucket,
    queryFn: () => listObjects({ data: { endpoint: endpointKey!, bucket: bucket!, prefix } }),
  });

  const crumbs = useMemo(() => prefix.split("/").filter(Boolean), [prefix]);

  const selectEndpoint = useCallback((key: string) => {
    setEndpointKey(key);
    setBucket(null);
    setPrefix("");
  }, []);

  async function handleUpload(file: File) {
    if (!endpointKey || !bucket) return;
    setBusy(true);
    try {
      const { url } = await uploadUrl({
        data: { endpoint: endpointKey, bucket, key: `${prefix}${file.name}` },
      });
      const res = await fetch(url, { method: "PUT", body: file });
      if (!res.ok) throw new Error(`Upload failed [${res.status}]: ${await res.text()}`);
      toast.success(t("upload_done"));
      void objects.refetch();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function handleDownload(key: string) {
    if (!endpointKey || !bucket) return;
    try {
      const { url } = await downloadUrl({ data: { endpoint: endpointKey, bucket, key } });
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function handleDelete(key: string) {
    if (!endpointKey || !bucket) return;
    if (!window.confirm(t("confirm_delete"))) return;
    try {
      await removeObject({ data: { endpoint: endpointKey, bucket, key } });
      toast.success(t("deleted"));
      void objects.refetch();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function handleCheck(key: string) {
    try {
      const r = await checkEndpoint({ data: { endpoint: key } });
      setHealth((h) => ({
        ...h,
        [key]: { ok: r.ok, msg: r.ok ? `${r.buckets} buckets · ${r.latencyMs}ms` : (r.error ?? "error") },
      }));
    } catch (e) {
      setHealth((h) => ({ ...h, [key]: { ok: false, msg: (e as Error).message } }));
    }
  }

  const activeEndpoint = endpoints.data?.find((e) => e.key === endpointKey) ?? null;

  return (
    <AppShell title={t("nav_storage")} description={t("storage_desc")}>
      <div className="grid gap-5 lg:grid-cols-[280px_1fr]">
        <div className="panel p-3">
          <p className="mb-2 px-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">
            {t("storage_endpoints")}
          </p>
          <div className="space-y-1">
            {(endpoints.data ?? []).map((ep) => (
              <button
                key={ep.key}
                onClick={() => selectEndpoint(ep.key)}
                className={cn(
                  "w-full rounded-md px-3 py-2 text-start text-sm transition-colors",
                  ep.key === endpointKey ? "bg-muted font-medium" : "hover:bg-muted/60",
                )}
              >
                <span className="flex items-center gap-2">
                  <Cloud className="size-4 shrink-0 text-primary" />
                  <span className="truncate">{ep.label}</span>
                </span>
                <span className="mt-0.5 block truncate font-mono text-[10px] text-muted-foreground">
                  {ep.endpoint_url.replace(/^https?:\/\//, "")}
                </span>
                {health[ep.key] ? (
                  <span
                    className={cn(
                      "mt-1 block truncate text-[10px]",
                      health[ep.key]!.ok ? "text-success" : "text-destructive",
                    )}
                  >
                    {health[ep.key]!.msg}
                  </span>
                ) : null}
              </button>
            ))}
          </div>
          {endpointKey ? (
            <Button
              variant="outline"
              size="sm"
              className="mt-3 w-full"
              onClick={() => void handleCheck(endpointKey)}
            >
              <RefreshCw className="size-4" />
              {t("test_connection")}
            </Button>
          ) : null}
        </div>

        <div className="min-w-0 space-y-4">
          {activeEndpoint ? (
            <div className="panel flex flex-wrap items-center justify-between gap-3 p-4">
              <div className="min-w-0">
                <p className="text-sm font-medium">{activeEndpoint.label}</p>
                <p className="truncate font-mono text-xs text-muted-foreground">
                  {activeEndpoint.endpoint_url} · {activeEndpoint.region}
                </p>
              </div>
              {bucket && canWrite ? (
                <div className="flex items-center gap-2">
                  <input
                    ref={fileRef}
                    type="file"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) void handleUpload(f);
                    }}
                  />
                  <Button size="sm" disabled={busy} onClick={() => fileRef.current?.click()}>
                    {busy ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
                    {t("upload")}
                  </Button>
                </div>
              ) : null}
            </div>
          ) : null}

          {!bucket ? (
            <div className="panel p-4">
              <p className="mb-3 text-sm font-medium">{t("buckets")}</p>
              {buckets.isLoading ? (
                <p className="text-sm text-muted-foreground">{t("loading")}</p>
              ) : buckets.data?.error ? (
                <p className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                  {buckets.data.error}
                </p>
              ) : !buckets.data?.buckets.length ? (
                <p className="text-sm text-muted-foreground">{t("no_records")}</p>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                  {buckets.data.buckets.map((b) => (
                    <button
                      key={b.name}
                      onClick={() => {
                        setBucket(b.name);
                        setPrefix("");
                      }}
                      className="flex items-center gap-3 rounded-md border border-border p-3 text-start hover:bg-muted/50"
                    >
                      <HardDrive className="size-4 text-primary" />
                      <span className="min-w-0">
                        <span className="block truncate text-sm">{b.name}</span>
                        <span className="block font-mono text-[10px] text-muted-foreground">
                          {b.creationDate
                            ? new Date(b.creationDate).toLocaleDateString(lang === "ar" ? "ar-EG" : "en-GB")
                            : "—"}
                        </span>
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="panel">
              <div className="flex flex-wrap items-center gap-1 border-b border-border px-4 py-3 text-sm">
                <button className="text-primary hover:underline" onClick={() => setBucket(null)}>
                  {t("buckets")}
                </button>
                <ChevronRight className="size-3 text-muted-foreground rtl:rotate-180" />
                <button className="text-primary hover:underline" onClick={() => setPrefix("")}>
                  {bucket}
                </button>
                {crumbs.map((c, i) => (
                  <span key={`${c}-${i}`} className="flex items-center gap-1">
                    <ChevronRight className="size-3 text-muted-foreground rtl:rotate-180" />
                    <button
                      className="text-primary hover:underline"
                      onClick={() => setPrefix(`${crumbs.slice(0, i + 1).join("/")}/`)}
                    >
                      {c}
                    </button>
                  </span>
                ))}
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-xs tracking-wide text-muted-foreground uppercase">
                      <th className="px-4 py-3 text-start font-medium">{t("name")}</th>
                      <th className="px-4 py-3 text-start font-medium">{t("size")}</th>
                      <th className="px-4 py-3 text-start font-medium">{t("modified")}</th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {objects.isLoading ? (
                      <tr>
                        <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                          {t("loading")}
                        </td>
                      </tr>
                    ) : objects.data?.error ? (
                      <tr>
                        <td colSpan={4} className="px-4 py-6 text-center text-destructive">
                          {objects.data.error}
                        </td>
                      </tr>
                    ) : !objects.data?.folders.length && !objects.data?.objects.length ? (
                      <tr>
                        <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                          {t("no_records")}
                        </td>
                      </tr>
                    ) : (
                      <>
                        {objects.data.folders.map((f) => (
                          <tr key={f} className="hover:bg-muted/40">
                            <td className="px-4 py-3" colSpan={3}>
                              <button
                                className="flex items-center gap-2 text-start"
                                onClick={() => setPrefix(f)}
                              >
                                <Folder className="size-4 text-primary" />
                                {f.slice(prefix.length).replace(/\/$/, "")}
                              </button>
                            </td>
                            <td />
                          </tr>
                        ))}
                        {objects.data.objects.map((o) => (
                          <tr key={o.key} className="hover:bg-muted/40">
                            <td className="max-w-[420px] truncate px-4 py-3 font-mono text-xs">
                              {o.key.slice(prefix.length)}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">{formatBytes(o.size)}</td>
                            <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                              {o.lastModified
                                ? new Date(o.lastModified).toLocaleString(
                                    lang === "ar" ? "ar-EG" : "en-GB",
                                    { dateStyle: "short", timeStyle: "short" },
                                  )
                                : "—"}
                            </td>
                            <td className="px-4 py-3 text-end whitespace-nowrap">
                              <Button variant="ghost" size="icon" onClick={() => void handleDownload(o.key)}>
                                <Download className="size-4" />
                              </Button>
                              {canWrite ? (
                                <Button variant="ghost" size="icon" onClick={() => void handleDelete(o.key)}>
                                  <Trash2 className="size-4 text-destructive" />
                                </Button>
                              ) : null}
                            </td>
                          </tr>
                        ))}
                      </>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
