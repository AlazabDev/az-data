import type { Database } from "@/integrations/supabase/types";

type Tables = Database["public"]["Tables"];
type Enums = Database["public"]["Enums"];

export type AppRole = Enums["app_role"];
export type LifecycleStatus = Enums["lifecycle_status"];
export type HealthStatus = Enums["health_status"];
export type CriticalityLevel = Enums["criticality_level"];
export type EnvironmentKind = Enums["environment_kind"];
export type DatasourceKind = Enums["datasource_kind"];

export type SystemRow = Tables["systems"]["Row"];
export type EnvironmentRow = Tables["environments"]["Row"];
export type DatabaseRow = Tables["databases"]["Row"];
export type DataSourceRow = Tables["data_sources"]["Row"];
export type AuditRow = Tables["audit_logs"]["Row"];

export const LIFECYCLE_STATUSES: LifecycleStatus[] = [
  "active",
  "inactive",
  "maintenance",
  "deprecated",
  "archived",
  "unknown",
];

export const HEALTH_STATUSES: HealthStatus[] = ["healthy", "warning", "critical", "unknown"];

export const CRITICALITY_LEVELS: CriticalityLevel[] = [
  "critical",
  "high",
  "medium",
  "low",
  "unknown",
];

export const ENVIRONMENT_KINDS: EnvironmentKind[] = [
  "production",
  "staging",
  "development",
  "testing",
  "sandbox",
  "dr",
  "other",
];

export const DATASOURCE_KINDS: DatasourceKind[] = [
  "api",
  "file_store",
  "object_storage",
  "queue",
  "cache",
  "warehouse",
  "vector_store",
  "spreadsheet",
  "other",
];

/** Approved engine baselines — Target Version per platform standard §40. */
export const ENGINE_BASELINES: Record<string, string> = {
  PostgreSQL: "17.x",
  MariaDB: "11.8.x",
  Redis: "8.8.x",
  MySQL: "unknown",
  MongoDB: "unknown",
  SQLite: "unknown",
  "SQL Server": "unknown",
  Other: "unknown",
};

export const ENGINE_OPTIONS = Object.keys(ENGINE_BASELINES);

export function formatDate(value: string | null | undefined, lang: string) {
  if (!value) return null;
  return new Date(value).toLocaleString(lang === "ar" ? "ar-EG" : "en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}
