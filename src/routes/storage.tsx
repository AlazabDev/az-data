import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Boxes,
  CheckCircle2,
  CircleAlert,
  Cloud,
  Database,
  ExternalLink,
  FileBox,
  FolderKanban,
  HardDrive,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  WalletCards,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { checkStorageEndpoint, listStorageBuckets } from "@/lib/storage.functions";
import {
  createStorageRequestRecord,
  getStorageOverview,
  listStorageObjectsRegistry,
  listStorageProjectsRegistry,
  listStorageRequestsRegistry,
  promoteStorageRequestRecord,
} from "@/lib/storage-domain.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/storage")({
  head: () => ({
    meta: [
      { title: "Storage — Alazab Data Platform" },
      {
        name: "description",
        content: "Provider-neutral storage identity, project assets, objects and infrastructure for Alazab Data Platform.",
      },
    ],
  }),
  component: StoragePage,
});

type ViewKey = "overview" | "requests" | "projects" | "objects" | "infrastructure";

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

function formatBytes(value: number | null | undefined) {
  const n = Number(value ?? 0);
  if (!n) return "—";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.min(Math.floor(Math.log(n) / Math.log(1024)), units.length - 1);
  return `${(n / 1024 ** i).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

function StoragePage() {
  const { lang } = useI18n();
  const { roles, canWrite } = useAuth();
  const [view, setView] = useState<ViewKey>("overview");
  const tr = (ar: string, en: string) => (lang === "ar" ? ar : en);
  const isAdmin = roles.includes("platform_owner") || roles.includes("platform_admin");

  const views: Array<{ key: ViewKey; label: string; icon: typeof Database }> = [
    { key: "overview", label: tr("نظرة عامة", "Overview"), icon: Database },
    { key: "requests", label: tr("الطلبات", "Requests"), icon: WalletCards },
    { key: "projects", label: tr("أصول المشاريع", "Project Assets"), icon: FolderKanban },
    { key: "objects", label: tr("الكائنات", "Objects"), icon: FileBox },
    { key: "infrastructure", label: tr("البنية التحتية", "Infrastructure"), icon: Cloud },
  ];

  return (
    <AppShell
      title={tr("التخزين", "Storage")}
      description={tr(
        "هوية وسياق وملكية أصول العزب أولاً، ومكان التخزين طبقة تشغيلية ثانوية.",
        "Alazab-owned identity, context and asset ownership first; physical storage is an operational layer.",
      )}
    >
      <div className="space-y-5">
        <div className="panel flex flex-wrap gap-2 p-2">
          {views.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => setView(item.key)}
                className={cn(
                  "flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors",
                  view === item.key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted",
                )}
              >
                <Icon className="size-4" />
                {item.label}
              </button>
            );
          })}
        </div>

        {view === "overview" ? <Overview tr={tr} /> : null}
        {view === "requests" ? <RequestsView tr={tr} canWrite={canWrite} isAdmin={isAdmin} /> : null}
        {view === "projects" ? <ProjectsView tr={tr} /> : null}
        {view === "objects" ? <ObjectsView tr={tr} /> : null}
        {view === "infrastructure" ? <InfrastructureView tr={tr} isAdmin={isAdmin} /> : null}
      </div>
    </AppShell>
  );
}

function Overview({ tr }: { tr: (ar: string, en: string) => string }) {
  const load = useServerFn(getStorageOverview);
  const query = useQuery({ queryKey: ["storage-domain", "overview"], queryFn: () => load() });

  if (query.isLoading) return <LoadingPanel label={tr("جاري تحميل حالة التخزين...", "Loading storage state...")} />;
  if (query.error) return <ErrorPanel message={(query.error as Error).message} />;

  const data = query.data!;
  const cards = [
    { label: tr("طلبات قبل الأصل", "Pre-Asset Requests"), value: data.preAssetRequests, icon: WalletCards },
    { label: tr("مشروعات رسمية", "Official Projects"), value: data.officialProjects, icon: FolderKanban },
    { label: tr("كائنات مسجلة", "Registered Objects"), value: data.objects, icon: FileBox },
    { label: tr("متاح مباشرة من السيرفر", "Server-Available Objects"), value: data.serverAvailableObjects, icon: HardDrive },
    { label: tr("كائنات غير محلولة", "Unresolved Objects"), value: data.unresolvedObjects, icon: CircleAlert },
    { label: tr("وجهات تخزين نشطة", "Active Storage Targets"), value: data.activeProviders, icon: Cloud },
  ];

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="panel p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm text-muted-foreground">{card.label}</p>
                  <p className="mt-2 text-3xl font-semibold tracking-tight">{card.value}</p>
                </div>
                <span className="rounded-md bg-primary/10 p-2 text-primary">
                  <Icon className="size-5" />
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="panel p-5">
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-0.5 size-5 text-primary" />
          <div>
            <h2 className="font-medium">{tr("قاعدة السلطة", "Authority Rule")}</h2>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              {tr(
                "RQ يظل خارج دائرة الأصول. عند التحقق من الاستلام المالي للدفعة الأولى فقط يتم Promotion إلى PRJ، ويصدر العنوان المؤسسي الدائم على alazab.com. المزود والـBucket والـPath لا يمثلون الهوية.",
                "RQ remains outside the official asset circle. Only a verified first financial receipt promotes it to PRJ and issues its permanent alazab.com canonical address. Provider, bucket and path are not identity.",
              )}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function RequestsView({
  tr,
  canWrite,
  isAdmin,
}: {
  tr: (ar: string, en: string) => string;
  canWrite: boolean;
  isAdmin: boolean;
}) {
  const queryClient = useQueryClient();
  const load = useServerFn(listStorageRequestsRegistry);
  const createRequest = useServerFn(createStorageRequestRecord);
  const promote = useServerFn(promoteStorageRequestRecord);
  const query = useQuery({ queryKey: ["storage-domain", "requests"], queryFn: () => load() });
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [clientName, setClientName] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [promotionId, setPromotionId] = useState<string | null>(null);
  const [paymentReference, setPaymentReference] = useState("");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentReceivedAt, setPaymentReceivedAt] = useState("");
  const [verificationSource, setVerificationSource] = useState("manual_verified");

  async function refreshAll() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["storage-domain", "requests"] }),
      queryClient.invalidateQueries({ queryKey: ["storage-domain", "projects"] }),
      queryClient.invalidateQueries({ queryKey: ["storage-domain", "objects"] }),
      queryClient.invalidateQueries({ queryKey: ["storage-domain", "overview"] }),
    ]);
  }

  async function handleCreate() {
    if (!name.trim()) return;
    setBusy(true);
    try {
      const created = await createRequest({ data: { name, clientName, notes } });
      toast.success(`${tr("تم إنشاء", "Created")} ${created.request_code}`);
      setName("");
      setClientName("");
      setNotes("");
      setShowCreate(false);
      await refreshAll();
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function handlePromote() {
    if (!promotionId || !paymentReference.trim() || !paymentReceivedAt || !paymentAmount) return;
    setBusy(true);
    try {
      const result = await promote({
        data: {
          requestId: promotionId,
          paymentReference,
          paymentReceivedAt: new Date(paymentReceivedAt).toISOString(),
          paymentAmount: Number(paymentAmount),
          paymentCurrency: "EGP",
          verificationSource,
        },
      });
      toast.success(`${tr("تم اعتماد المشروع", "Project promoted")}: ${result?.project_code ?? "PRJ"}`);
      setPromotionId(null);
      setPaymentReference("");
      setPaymentAmount("");
      setPaymentReceivedAt("");
      await refreshAll();
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">{tr("سياق ما قبل الأصل", "Pre-Asset Context")}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {tr("طلب، معاينة، مقاسات، عروض أسعار ومرفقات قبل الاستلام المالي الأول.", "Request, survey, measurements, quotations and attachments before the first verified receipt.")}
          </p>
        </div>
        {canWrite ? (
          <Button onClick={() => setShowCreate((v) => !v)}>
            <Plus className="size-4" />
            {tr("طلب جديد", "New Request")}
          </Button>
        ) : null}
      </div>

      {showCreate ? (
        <div className="panel grid gap-4 p-4 lg:grid-cols-3">
          <div className="space-y-1.5">
            <Label>{tr("اسم الطلب", "Request Name")}</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>{tr("العميل", "Client")}</Label>
            <Input value={clientName} onChange={(e) => setClientName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>{tr("ملاحظات", "Notes")}</Label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          <div className="flex justify-end lg:col-span-3">
            <Button disabled={busy || !name.trim()} onClick={() => void handleCreate()}>
              {busy ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
              {tr("إنشاء RQ", "Create RQ")}
            </Button>
          </div>
        </div>
      ) : null}

      {promotionId ? (
        <div className="panel border-primary/40 p-4">
          <div className="mb-4 flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 size-5 text-primary" />
            <div>
              <h3 className="font-medium">{tr("بوابة اعتماد المشروع", "Project Promotion Gate")}</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {tr("لا يتم إنشاء PRJ إلا بعد إدخال مرجع الاستلام المالي الفعلي والتحقق منه.", "PRJ is created only after a real received payment reference is supplied and verified.")}
              </p>
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div className="space-y-1.5">
              <Label>{tr("مرجع الاستلام", "Receipt Reference")}</Label>
              <Input value={paymentReference} onChange={(e) => setPaymentReference(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>{tr("المبلغ", "Amount")}</Label>
              <Input type="number" min="0.01" step="0.01" value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>{tr("وقت الاستلام", "Received At")}</Label>
              <Input type="datetime-local" value={paymentReceivedAt} onChange={(e) => setPaymentReceivedAt(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>{tr("مصدر التحقق", "Verification Source")}</Label>
              <Input value={verificationSource} onChange={(e) => setVerificationSource(e.target.value)} />
            </div>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="outline" onClick={() => setPromotionId(null)}>{tr("إلغاء", "Cancel")}</Button>
            <Button
              disabled={busy || !paymentReference.trim() || !paymentReceivedAt || Number(paymentAmount) <= 0}
              onClick={() => void handlePromote()}
            >
              {busy ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />}
              {tr("تأكيد الاستلام وإنشاء PRJ", "Verify Receipt & Create PRJ")}
            </Button>
          </div>
        </div>
      ) : null}

      {query.isLoading ? <LoadingPanel label={tr("جاري تحميل الطلبات...", "Loading requests...")} /> : null}
      {query.error ? <ErrorPanel message={(query.error as Error).message} /> : null}
      {query.data ? (
        <div className="panel overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-xs text-muted-foreground">
                <th className="px-4 py-3 text-start font-medium">RQ</th>
                <th className="px-4 py-3 text-start font-medium">{tr("الطلب", "Request")}</th>
                <th className="px-4 py-3 text-start font-medium">{tr("العميل", "Client")}</th>
                <th className="px-4 py-3 text-start font-medium">{tr("الكائنات", "Objects")}</th>
                <th className="px-4 py-3 text-start font-medium">{tr("الحالة", "Status")}</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {query.data.length ? query.data.map((row: any) => (
                <tr key={row.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3 font-mono text-xs">{row.request_code}</td>
                  <td className="px-4 py-3 font-medium">{row.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{row.client_name || "—"}</td>
                  <td className="px-4 py-3">{row.object_count}</td>
                  <td className="px-4 py-3"><Status value={row.status} /></td>
                  <td className="px-4 py-3 text-end">
                    {isAdmin && row.status !== "promoted" && row.status !== "cancelled" && row.status !== "closed" ? (
                      <Button size="sm" variant="outline" onClick={() => setPromotionId(row.id)}>
                        <ShieldCheck className="size-4" />
                        {tr("اعتماد", "Promote")}
                      </Button>
                    ) : null}
                  </td>
                </tr>
              )) : (
                <tr><td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">{tr("لا توجد طلبات مسجلة.", "No requests registered.")}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}

function ProjectsView({ tr }: { tr: (ar: string, en: string) => string }) {
  const load = useServerFn(listStorageProjectsRegistry);
  const query = useQuery({ queryKey: ["storage-domain", "projects"], queryFn: () => load() });
  if (query.isLoading) return <LoadingPanel label={tr("جاري تحميل أصول المشاريع...", "Loading project assets...")} />;
  if (query.error) return <ErrorPanel message={(query.error as Error).message} />;
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">{tr("أصول المشاريع الرسمية", "Official Project Assets")}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{tr("لا يظهر هنا إلا ما عبر بوابة الاستلام المالي وتم إصدار PRJ وعنوان مؤسسي له.", "Only requests that crossed the verified financial receipt gate and received PRJ identity appear here.")}</p>
      </div>
      <div className="panel overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-border text-xs text-muted-foreground">
            <th className="px-4 py-3 text-start font-medium">PRJ</th>
            <th className="px-4 py-3 text-start font-medium">{tr("المشروع", "Project")}</th>
            <th className="px-4 py-3 text-start font-medium">{tr("الأصل", "Origin")}</th>
            <th className="px-4 py-3 text-start font-medium">{tr("الكائنات", "Objects")}</th>
            <th className="px-4 py-3 text-start font-medium">Canonical URI</th>
          </tr></thead>
          <tbody className="divide-y divide-border">
            {query.data?.length ? query.data.map((row: any) => (
              <tr key={row.id} className="hover:bg-muted/30">
                <td className="px-4 py-3 font-mono text-xs">{row.project_code}</td>
                <td className="px-4 py-3"><p className="font-medium">{row.name}</p><p className="text-xs text-muted-foreground">{row.client_name || "—"}</p></td>
                <td className="px-4 py-3 font-mono text-xs">{row.origin_request_code || "—"}</td>
                <td className="px-4 py-3">{row.object_count}</td>
                <td className="px-4 py-3">
                  <a href={row.canonical_uri} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-mono text-xs text-primary hover:underline">
                    {row.canonical_uri}<ExternalLink className="size-3" />
                  </a>
                </td>
              </tr>
            )) : <tr><td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">{tr("لم يتم اعتماد أي مشروع بعد.", "No project has been promoted yet.")}</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ObjectsView({ tr }: { tr: (ar: string, en: string) => string }) {
  const load = useServerFn(listStorageObjectsRegistry);
  const query = useQuery({ queryKey: ["storage-domain", "objects"], queryFn: () => load() });
  const [search, setSearch] = useState("");
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return query.data ?? [];
    return (query.data ?? []).filter((row: any) =>
      [row.object_code, row.display_name, row.original_filename, row.origin_code, row.owner_code]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q)),
    );
  }, [query.data, search]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">{tr("سجل الكائنات", "Object Registry")}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{tr("الهوية ثابتة. الموقع الفيزيائي مجرد Location قابل للتغيير.", "Identity is stable. Physical placement is only a replaceable location.")}</p>
        </div>
        <div className="relative w-full sm:w-80">
          <Search className="absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="ps-9" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={tr("بحث بـ OBJ أو RQ أو PRJ...", "Search OBJ, RQ or PRJ...")} />
        </div>
      </div>
      {query.isLoading ? <LoadingPanel label={tr("جاري تحميل الكائنات...", "Loading objects...")} /> : null}
      {query.error ? <ErrorPanel message={(query.error as Error).message} /> : null}
      {query.data ? (
        <div className="panel overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-border text-xs text-muted-foreground">
              <th className="px-4 py-3 text-start font-medium">OBJ</th>
              <th className="px-4 py-3 text-start font-medium">{tr("الاسم", "Name")}</th>
              <th className="px-4 py-3 text-start font-medium">{tr("الأصل", "Origin")}</th>
              <th className="px-4 py-3 text-start font-medium">{tr("المالك الحالي", "Current Owner")}</th>
              <th className="px-4 py-3 text-start font-medium">{tr("الحجم", "Size")}</th>
              <th className="px-4 py-3 text-start font-medium">{tr("الموقع المحلول", "Resolved Location")}</th>
              <th className="px-4 py-3 text-start font-medium">{tr("النسخ", "Locations")}</th>
            </tr></thead>
            <tbody className="divide-y divide-border">
              {filtered.length ? filtered.map((row: any) => (
                <tr key={row.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3 font-mono text-xs">{row.object_code}</td>
                  <td className="px-4 py-3"><p className="font-medium">{row.display_name}</p><p className="text-xs text-muted-foreground">{row.original_filename || row.mime_type || "—"}</p></td>
                  <td className="px-4 py-3 font-mono text-xs">{row.origin_code || "—"}</td>
                  <td className="px-4 py-3 font-mono text-xs">{row.owner_code || "—"}</td>
                  <td className="px-4 py-3 whitespace-nowrap">{formatBytes(row.size_bytes)}</td>
                  <td className="px-4 py-3"><ResolvedLocation location={row.resolved_location} tr={tr} /></td>
                  <td className="px-4 py-3">{row.location_count}</td>
                </tr>
              )) : <tr><td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">{tr("لا توجد كائنات مطابقة.", "No matching objects.")}</td></tr>}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}

function InfrastructureView({ tr, isAdmin }: { tr: (ar: string, en: string) => string; isAdmin: boolean }) {
  const check = useServerFn(checkStorageEndpoint);
  const listBuckets = useServerFn(listStorageBuckets);
  const [health, setHealth] = useState<Record<string, { ok: boolean; message: string }>>({});
  const [selected, setSelected] = useState<string | null>(null);
  const endpoints = useQuery({
    queryKey: ["storage-endpoints"],
    queryFn: async (): Promise<EndpointRow[]> => {
      const { data, error } = await supabase
        .from("storage_endpoints")
        .select("id,key,label,provider,endpoint_url,region,default_bucket,is_active")
        .order("label");
      if (error) throw error;
      return (data ?? []) as EndpointRow[];
    },
  });
  const buckets = useQuery({
    queryKey: ["storage-infrastructure-buckets", selected],
    enabled: !!selected,
    queryFn: () => listBuckets({ data: { endpoint: selected! } }),
  });

  async function handleCheck(key: string) {
    setHealth((h) => ({ ...h, [key]: { ok: true, message: tr("جاري الفحص...", "Checking...") } }));
    try {
      const result = await check({ data: { endpoint: key } });
      setHealth((h) => ({
        ...h,
        [key]: {
          ok: result.ok,
          message: result.ok ? `${result.buckets} buckets · ${result.latencyMs}ms` : result.error || "error",
        },
      }));
    } catch (error) {
      setHealth((h) => ({ ...h, [key]: { ok: false, message: (error as Error).message } }));
    }
  }

  return (
    <div className="space-y-4">
      <div className="panel p-4">
        <div className="flex items-start gap-3">
          <Boxes className="mt-0.5 size-5 text-primary" />
          <div>
            <h2 className="font-medium">{tr("طبقة البنية التحتية فقط", "Infrastructure Layer Only")}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{tr("المزود وBucket وPath ليست هوية أعمال. هذه الشاشة للفحص والتشغيل فقط، بينما الوصول الطبيعي يبدأ من RQ / PRJ / OBJ.", "Provider, bucket and path are not business identity. This screen is operational only; normal access begins with RQ / PRJ / OBJ.")}</p>
          </div>
        </div>
      </div>

      {endpoints.isLoading ? <LoadingPanel label={tr("جاري تحميل الوجهات...", "Loading storage targets...")} /> : null}
      {endpoints.error ? <ErrorPanel message={(endpoints.error as Error).message} /> : null}
      <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
        {(endpoints.data ?? []).map((ep) => (
          <div key={ep.id} className={cn("panel p-4", selected === ep.key && "ring-1 ring-primary/50") }>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-medium">{ep.label}</p>
                <p className="mt-1 truncate font-mono text-[11px] text-muted-foreground">{ep.endpoint_url}</p>
                <p className="mt-1 text-xs text-muted-foreground">{ep.provider} · {ep.region}</p>
              </div>
              <Cloud className="size-5 text-primary" />
            </div>
            {health[ep.key] ? (
              <p className={cn("mt-3 text-xs", health[ep.key]!.ok ? "text-success" : "text-destructive")}>{health[ep.key]!.message}</p>
            ) : null}
            <div className="mt-4 flex gap-2">
              <Button size="sm" variant="outline" onClick={() => void handleCheck(ep.key)}>
                <RefreshCw className="size-4" />{tr("فحص", "Check")}
              </Button>
              <Button size="sm" variant={selected === ep.key ? "default" : "outline"} onClick={() => setSelected(selected === ep.key ? null : ep.key)}>
                <HardDrive className="size-4" />Buckets
              </Button>
            </div>
          </div>
        ))}
      </div>

      {selected ? (
        <div className="panel p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h3 className="font-medium">{tr("المعاينة الفيزيائية", "Physical Inspection")}</h3>
              <p className="text-xs text-muted-foreground">{selected} · {isAdmin ? tr("إدارة", "Admin") : tr("قراءة", "Read only")}</p>
            </div>
          </div>
          {buckets.isLoading ? <p className="text-sm text-muted-foreground">{tr("جاري التحميل...", "Loading...")}</p> : null}
          {buckets.data?.error ? <ErrorPanel message={buckets.data.error} /> : null}
          {buckets.data?.buckets?.length ? (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {buckets.data.buckets.map((bucket: any) => (
                <div key={bucket.name} className="rounded-md border border-border p-3">
                  <div className="flex items-center gap-2"><HardDrive className="size-4 text-primary" /><span className="truncate font-mono text-xs">{bucket.name}</span></div>
                </div>
              ))}
            </div>
          ) : buckets.data && !buckets.data.error ? <p className="text-sm text-muted-foreground">{tr("لا توجد Buckets مرئية.", "No visible buckets.")}</p> : null}
        </div>
      ) : null}
    </div>
  );
}

function ResolvedLocation({ location, tr }: { location: any; tr: (ar: string, en: string) => string }) {
  if (!location) return <span className="text-xs text-warning">{tr("غير محلول", "Unresolved")}</span>;
  const server = location.location_kind === "server";
  return (
    <div className="flex items-center gap-2">
      {server ? <HardDrive className="size-4 text-success" /> : <Cloud className="size-4 text-muted-foreground" />}
      <span className="text-xs">{server ? tr("السيرفر", "Server") : location.location_kind}</span>
      <span className={cn("size-2 rounded-full", location.availability === "available" ? "bg-success" : location.availability === "unavailable" ? "bg-destructive" : "bg-muted-foreground") } />
    </div>
  );
}

function Status({ value }: { value: string }) {
  return <span className="rounded-full border border-border bg-muted px-2 py-1 font-mono text-[10px] uppercase">{value}</span>;
}

function LoadingPanel({ label }: { label: string }) {
  return <div className="panel flex items-center gap-2 p-5 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" />{label}</div>;
}

function ErrorPanel({ message }: { message: string }) {
  return <div className="rounded-md border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">{message}</div>;
}
