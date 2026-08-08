import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const requestIdSchema = z.string().uuid();
const objectCodeSchema = z.string().trim().min(1).max(80);

function db(context: { supabase: unknown }) {
  return context.supabase as any;
}

function aggregateCounts(rows: Array<Record<string, unknown>>, key: string) {
  const out: Record<string, number> = {};
  for (const row of rows) {
    const value = row[key];
    if (typeof value === "string" && value) out[value] = (out[value] ?? 0) + 1;
  }
  return out;
}

export const getStorageOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const supabase = db(context);
    const [requests, projects, objects, providers, localObjects, unresolved] = await Promise.all([
      supabase
        .from("storage_requests")
        .select("id", { count: "exact", head: true })
        .in("status", ["open", "on_hold"]),
      supabase.from("storage_projects").select("id", { count: "exact", head: true }),
      supabase.from("storage_objects").select("id", { count: "exact", head: true }),
      supabase
        .from("storage_endpoints")
        .select("id", { count: "exact", head: true })
        .eq("is_active", true),
      supabase
        .from("storage_object_resolution")
        .select("object_id", { count: "exact", head: true })
        .eq("location_kind", "server")
        .eq("availability", "available"),
      supabase
        .from("storage_object_resolution")
        .select("object_id", { count: "exact", head: true })
        .or("location_id.is.null,availability.neq.available"),
    ]);

    const errors = [requests, projects, objects, providers, localObjects, unresolved]
      .map((r) => r.error?.message)
      .filter(Boolean);
    if (errors.length) throw new Error(errors.join(" | "));

    return {
      preAssetRequests: requests.count ?? 0,
      officialProjects: projects.count ?? 0,
      objects: objects.count ?? 0,
      activeProviders: providers.count ?? 0,
      serverAvailableObjects: localObjects.count ?? 0,
      unresolvedObjects: unresolved.count ?? 0,
    };
  });

export const listStorageRequestsRegistry = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const supabase = db(context);
    const [{ data: requests, error }, { data: objects, error: objectError }] = await Promise.all([
      supabase
        .from("storage_requests")
        .select("id,request_code,name,client_name,status,notes,created_at,updated_at")
        .order("created_at", { ascending: false })
        .limit(250),
      supabase.from("storage_objects").select("current_request_id").not("current_request_id", "is", null),
    ]);
    if (error) throw new Error(error.message);
    if (objectError) throw new Error(objectError.message);
    const counts = aggregateCounts((objects ?? []) as Array<Record<string, unknown>>, "current_request_id");
    return (requests ?? []).map((row: any) => ({ ...row, object_count: counts[row.id] ?? 0 }));
  });

export const listStorageProjectsRegistry = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const supabase = db(context);
    const [{ data: projects, error }, { data: requests, error: requestError }, { data: objects, error: objectError }] =
      await Promise.all([
        supabase
          .from("storage_projects")
          .select("id,project_code,name,client_name,origin_request_id,canonical_uri,status,promoted_at,created_at")
          .order("promoted_at", { ascending: false })
          .limit(250),
        supabase.from("storage_requests").select("id,request_code"),
        supabase.from("storage_objects").select("current_project_id").not("current_project_id", "is", null),
      ]);
    if (error) throw new Error(error.message);
    if (requestError) throw new Error(requestError.message);
    if (objectError) throw new Error(objectError.message);

    const requestMap = new Map((requests ?? []).map((r: any) => [r.id, r.request_code]));
    const counts = aggregateCounts((objects ?? []) as Array<Record<string, unknown>>, "current_project_id");
    return (projects ?? []).map((row: any) => ({
      ...row,
      origin_request_code: requestMap.get(row.origin_request_id) ?? null,
      object_count: counts[row.id] ?? 0,
    }));
  });

export const listStorageObjectsRegistry = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const supabase = db(context);
    const [{ data: objects, error }, { data: requests }, { data: projects }, { data: locations, error: locationError }] =
      await Promise.all([
        supabase
          .from("storage_objects")
          .select(
            "id,object_code,display_name,original_filename,mime_type,content_class,size_bytes,sha256,origin_request_id,origin_project_id,current_request_id,current_project_id,status,created_at,updated_at",
          )
          .order("created_at", { ascending: false })
          .limit(500),
        supabase.from("storage_requests").select("id,request_code"),
        supabase.from("storage_projects").select("id,project_code"),
        supabase
          .from("storage_object_locations")
          .select("object_id,location_kind,location_role,is_primary,availability,last_verified_at"),
      ]);
    if (error) throw new Error(error.message);
    if (locationError) throw new Error(locationError.message);

    const requestMap = new Map((requests ?? []).map((r: any) => [r.id, r.request_code]));
    const projectMap = new Map((projects ?? []).map((p: any) => [p.id, p.project_code]));
    const byObject = new Map<string, any[]>();
    for (const loc of locations ?? []) {
      const list = byObject.get(loc.object_id) ?? [];
      list.push(loc);
      byObject.set(loc.object_id, list);
    }

    return (objects ?? []).map((row: any) => {
      const objectLocations = byObject.get(row.id) ?? [];
      const ordered = [...objectLocations].sort((a, b) => {
        const availabilityRank = (v: string) => (v === "available" ? 0 : v === "unknown" ? 1 : 2);
        const kindRank = (v: string) => (v === "server" ? 0 : 1);
        return (
          availabilityRank(a.availability) - availabilityRank(b.availability) ||
          kindRank(a.location_kind) - kindRank(b.location_kind) ||
          Number(b.is_primary) - Number(a.is_primary)
        );
      });
      return {
        ...row,
        origin_code: row.origin_request_id
          ? requestMap.get(row.origin_request_id)
          : projectMap.get(row.origin_project_id),
        owner_code: row.current_request_id
          ? requestMap.get(row.current_request_id)
          : projectMap.get(row.current_project_id),
        location_count: objectLocations.length,
        resolved_location: ordered[0] ?? null,
      };
    });
  });

export const createStorageRequestRecord = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        name: z.string().trim().min(2).max(240),
        clientName: z.string().trim().max(240).optional().default(""),
        notes: z.string().trim().max(4000).optional().default(""),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const supabase = db(context);
    const { data: row, error } = await supabase
      .from("storage_requests")
      .insert({
        name: data.name,
        client_name: data.clientName || null,
        notes: data.notes || null,
      })
      .select("id,request_code,name,client_name,status,created_at")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const promoteStorageRequestRecord = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        requestId: requestIdSchema,
        paymentReference: z.string().trim().min(1).max(240),
        paymentReceivedAt: z.string().datetime({ offset: true }),
        paymentAmount: z.number().positive().finite(),
        paymentCurrency: z.string().trim().min(3).max(8).default("EGP"),
        verificationSource: z.string().trim().min(1).max(120).default("manual_verified"),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const supabase = db(context);
    const { data: result, error } = await supabase.rpc("promote_storage_request", {
      _request_id: data.requestId,
      _payment_reference: data.paymentReference,
      _payment_received_at: data.paymentReceivedAt,
      _payment_amount: data.paymentAmount,
      _payment_currency: data.paymentCurrency,
      _verification_source: data.verificationSource,
    });
    if (error) throw new Error(error.message);
    return Array.isArray(result) ? result[0] : result;
  });

export const resolveStorageObjectRecord = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ objectCode: objectCodeSchema }).parse(input))
  .handler(async ({ data, context }) => {
    const supabase = db(context);
    const { data: row, error } = await supabase
      .from("storage_object_resolution")
      .select(
        "object_id,object_code,location_id,location_kind,endpoint_id,physical_locator,bucket,object_key,location_role,is_primary,availability,last_verified_at",
      )
      .eq("object_code", data.objectCode)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Storage object not found");
    return row;
  });
