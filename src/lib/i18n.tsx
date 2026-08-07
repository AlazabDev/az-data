import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type Lang = "ar" | "en";

type Dict = Record<string, { ar: string; en: string }>;

export const dict: Dict = {
  platform_name: { ar: "منصة بيانات العزب", en: "Alazab Data Platform" },
  platform_tagline: {
    ar: "نقطة تحكم واحدة لبنية بيانات العزب — وليست قاعدة بيانات واحدة",
    en: "A single control point for Alazab data infrastructure — not a single database",
  },
  nav_overview: { ar: "نظرة عامة", en: "Overview" },
  nav_systems: { ar: "الأنظمة", en: "Systems" },
  nav_environments: { ar: "البيئات", en: "Environments" },
  nav_databases: { ar: "قواعد البيانات", en: "Databases" },
  nav_data_sources: { ar: "مصادر البيانات", en: "Data Sources" },
  nav_audit: { ar: "سجل المراجعة", en: "Audit Log" },
  nav_access: { ar: "الصلاحيات", en: "Access Control" },
  sign_in: { ar: "تسجيل الدخول", en: "Sign in" },
  sign_up: { ar: "إنشاء حساب", en: "Sign up" },
  sign_out: { ar: "تسجيل الخروج", en: "Sign out" },
  email: { ar: "البريد الإلكتروني", en: "Email" },
  password: { ar: "كلمة المرور", en: "Password" },
  full_name: { ar: "الاسم الكامل", en: "Full name" },
  continue_google: { ar: "المتابعة بحساب Google", en: "Continue with Google" },
  auth_intro: {
    ar: "هذه المنصة مخصصة لفريق بيانات العزب. سجّل الدخول للاطلاع على السجلات.",
    en: "This platform is for the Alazab data team. Sign in to view the registries.",
  },
  check_email: {
    ar: "تحقق من بريدك الإلكتروني لتأكيد الحساب.",
    en: "Check your email to confirm your account.",
  },
  loading: { ar: "جارٍ التحميل…", en: "Loading…" },
  total_systems: { ar: "إجمالي الأنظمة", en: "Total systems" },
  total_databases: { ar: "قواعد البيانات", en: "Databases" },
  total_data_sources: { ar: "مصادر البيانات", en: "Data sources" },
  production_envs: { ar: "بيئات الإنتاج", en: "Production environments" },
  health_breakdown: { ar: "حالة قواعد البيانات", en: "Database health" },
  backup_governance: { ar: "حوكمة النسخ الاحتياطي", en: "Backup governance" },
  restore_verification: { ar: "التحقق من الاستعادة", en: "Restore verification" },
  unknown_coverage: { ar: "الفجوات المعرفية", en: "Knowledge gaps" },
  recent_activity: { ar: "آخر الأحداث", en: "Recent activity" },
  needs_attention: { ar: "يحتاج تدخل", en: "Needs attention" },
  backup_missing: { ar: "بدون نسخة احتياطية مسجلة", en: "No recorded backup" },
  restore_untested: { ar: "استعادة غير مختبرة", en: "Restore not verified" },
  never_health_checked: { ar: "لم يتم فحصها", en: "Never health-checked" },
  unknown_owner: { ar: "بدون مالك مسجل", en: "No registered owner" },
  view_source: { ar: "عرض المصدر", en: "View source" },
  add: { ar: "إضافة", en: "Add" },
  edit: { ar: "تعديل", en: "Edit" },
  delete: { ar: "حذف", en: "Delete" },
  save: { ar: "حفظ", en: "Save" },
  cancel: { ar: "إلغاء", en: "Cancel" },
  search: { ar: "بحث…", en: "Search…" },
  no_records: { ar: "لا توجد سجلات بعد.", en: "No records yet." },
  read_only_notice: {
    ar: "لديك صلاحية قراءة فقط. تواصل مع مالك المنصة للحصول على صلاحية التعديل.",
    en: "You have read-only access. Ask a platform owner for write access.",
  },
  name: { ar: "الاسم", en: "Name" },
  code: { ar: "الكود", en: "Code" },
  description: { ar: "الوصف", en: "Description" },
  purpose: { ar: "الوظيفة", en: "Purpose" },
  status: { ar: "الحالة", en: "Status" },
  health: { ar: "الصحة", en: "Health" },
  criticality: { ar: "الأهمية", en: "Criticality" },
  business_owner: { ar: "المالك التجاري", en: "Business owner" },
  technical_owner: { ar: "المالك التقني", en: "Technical owner" },
  operations_owner: { ar: "مسؤول التشغيل", en: "Operations owner" },
  system: { ar: "النظام", en: "System" },
  environment: { ar: "البيئة", en: "Environment" },
  environment_kind: { ar: "نوع البيئة", en: "Environment kind" },
  engine: { ar: "نوع قاعدة البيانات", en: "Engine" },
  engine_version: { ar: "الإصدار الحالي", en: "Current version" },
  target_version: { ar: "الإصدار المعتمد", en: "Target version" },
  provider: { ar: "المزود", en: "Provider" },
  region: { ar: "المنطقة", en: "Region" },
  host: { ar: "الخادم", en: "Host" },
  port: { ar: "المنفذ", en: "Port" },
  database_name: { ar: "اسم قاعدة البيانات", en: "Database name" },
  backup_policy: { ar: "سياسة النسخ الاحتياطي", en: "Backup policy" },
  backup_required: { ar: "النسخ الاحتياطي مطلوب", en: "Backup required" },
  last_backup: { ar: "آخر نسخة احتياطية", en: "Last backup" },
  last_restore_test: { ar: "آخر اختبار استعادة", en: "Last restore test" },
  restore_verified: { ar: "الاستعادة مُتحقق منها", en: "Restore verified" },
  monitoring_policy: { ar: "سياسة المراقبة", en: "Monitoring policy" },
  last_health_check: { ar: "آخر فحص", en: "Last health check" },
  schema_version: { ar: "إصدار الـSchema", en: "Schema version" },
  migration_version: { ar: "إصدار الـMigration", en: "Migration version" },
  connection_reference: { ar: "مرجع الاتصال", en: "Connection reference" },
  dependencies: { ar: "التبعيات", en: "Dependencies" },
  notes: { ar: "ملاحظات", en: "Notes" },
  location: { ar: "الموقع", en: "Location" },
  data_format: { ar: "الصيغة", en: "Format" },
  kind: { ar: "النوع", en: "Kind" },
  last_reviewed: { ar: "آخر مراجعة", en: "Last reviewed" },
  operational_notes: { ar: "ملاحظات تشغيلية", en: "Operational notes" },
  never: { ar: "لم يحدث", en: "Never" },
  yes: { ar: "نعم", en: "Yes" },
  no: { ar: "لا", en: "No" },
  actor: { ar: "المنفّذ", en: "Actor" },
  action: { ar: "العملية", en: "Action" },
  entity: { ar: "الكيان", en: "Entity" },
  when: { ar: "الوقت", en: "When" },
  role: { ar: "الدور", en: "Role" },
  user: { ar: "المستخدم", en: "User" },
  your_roles: { ar: "أدوارك", en: "Your roles" },
  discovery_note: {
    ar: "المنصة سجل ومعرفة وحوكمة. لا يتم تعديل أو نقل أي نظام قائم من هنا، وكل معلومة غير مؤكدة تُسجل كـUnknown.",
    en: "This platform is a registry, knowledge and governance layer. It never modifies or migrates a running system, and anything unconfirmed is recorded as Unknown.",
  },
  save_failed: { ar: "فشل الحفظ", en: "Save failed" },
  saved: { ar: "تم الحفظ", en: "Saved" },
  deleted: { ar: "تم الحذف", en: "Deleted" },
  confirm_delete: { ar: "تأكيد الحذف؟", en: "Confirm delete?" },
  back: { ar: "رجوع", en: "Back" },
  details: { ar: "التفاصيل", en: "Details" },
  none: { ar: "غير محدد", en: "Not set" },
  select: { ar: "اختر…", en: "Select…" },
};

export const enumLabels: Record<string, { ar: string; en: string }> = {
  active: { ar: "نشط", en: "Active" },
  inactive: { ar: "غير نشط", en: "Inactive" },
  maintenance: { ar: "صيانة", en: "Maintenance" },
  deprecated: { ar: "مهجور", en: "Deprecated" },
  archived: { ar: "مؤرشف", en: "Archived" },
  unknown: { ar: "غير معروف", en: "Unknown" },
  healthy: { ar: "سليم", en: "Healthy" },
  warning: { ar: "تحذير", en: "Warning" },
  critical: { ar: "حرج", en: "Critical" },
  high: { ar: "مرتفع", en: "High" },
  medium: { ar: "متوسط", en: "Medium" },
  low: { ar: "منخفض", en: "Low" },
  production: { ar: "إنتاج", en: "Production" },
  staging: { ar: "تجريبي", en: "Staging" },
  development: { ar: "تطوير", en: "Development" },
  testing: { ar: "اختبار", en: "Testing" },
  sandbox: { ar: "معزول", en: "Sandbox" },
  dr: { ar: "تعافي الكوارث", en: "Disaster recovery" },
  other: { ar: "أخرى", en: "Other" },
  api: { ar: "واجهة برمجية", en: "API" },
  file_store: { ar: "مخزن ملفات", en: "File store" },
  object_storage: { ar: "تخزين كائنات", en: "Object storage" },
  queue: { ar: "طابور رسائل", en: "Queue" },
  cache: { ar: "ذاكرة مؤقتة", en: "Cache" },
  warehouse: { ar: "مستودع بيانات", en: "Warehouse" },
  vector_store: { ar: "مخزن متجهات", en: "Vector store" },
  spreadsheet: { ar: "جداول", en: "Spreadsheet" },
  platform_owner: { ar: "مالك المنصة", en: "Platform owner" },
  platform_admin: { ar: "مدير المنصة", en: "Platform administrator" },
  database_administrator: { ar: "مدير قواعد بيانات", en: "Database administrator" },
  data_engineer: { ar: "مهندس بيانات", en: "Data engineer" },
  application_owner: { ar: "مالك تطبيق", en: "Application owner" },
  integration_manager: { ar: "مسؤول التكاملات", en: "Integration manager" },
  analyst: { ar: "محلل", en: "Analyst" },
  read_only: { ar: "قراءة فقط", en: "Read only" },
  insert: { ar: "إنشاء", en: "Created" },
  update: { ar: "تعديل", en: "Updated" },
  delete: { ar: "حذف", en: "Deleted" },
  systems: { ar: "الأنظمة", en: "Systems" },
  environments: { ar: "البيئات", en: "Environments" },
  databases: { ar: "قواعد البيانات", en: "Databases" },
  data_sources: { ar: "مصادر البيانات", en: "Data sources" },
};

type I18nValue = {
  lang: Lang;
  dir: "rtl" | "ltr";
  setLang: (l: Lang) => void;
  t: (key: keyof typeof dict | string) => string;
  te: (value: string | null | undefined) => string;
};

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("ar");

  useEffect(() => {
    const stored = window.localStorage.getItem("adp_lang");
    if (stored === "ar" || stored === "en") setLangState(stored);
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
  }, [lang]);

  const value = useMemo<I18nValue>(
    () => ({
      lang,
      dir: lang === "ar" ? "rtl" : "ltr",
      setLang: (l) => {
        setLangState(l);
        window.localStorage.setItem("adp_lang", l);
      },
      t: (key) => dict[key as string]?.[lang] ?? (key as string),
      te: (value) => (value ? (enumLabels[value]?.[lang] ?? value) : (dict["none"]?.[lang] ?? "-")),
    }),
    [lang],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used inside I18nProvider");
  return ctx;
}
