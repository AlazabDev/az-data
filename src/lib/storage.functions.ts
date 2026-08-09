import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { recordSecurityEvent } from "@/lib/security-log.server";

const keySchema = z.string().trim().min(1).max(120);
const bucketSchema = z.string().trim().min(1).max(255).regex(/^[a-zA-Z0-9._-]+$/);
const objectKeySchema = z.string().trim().min(1).max(1024);
const prefixSchema = z.string().max(1024).default("");

type EndpointRow = {
  key: string;
  label: string;
  provider: string;
  endpoint_url: string;
  region: string;
  path_style: boolean;
  signature_version: string;
  secret_prefix: string;
  default_bucket: string | null;
  is_active: boolean;
};

async function loadEndpoint(
  supabase: { from: (t: string) => any },
  key: string,
): Promise<EndpointRow> {
  const { data, error } = await supabase
    .from("storage_endpoints")
    .select("key,label,provider,endpoint_url,region,path_style,signature_version,secret_prefix,default_bucket,is_active")
    .eq("key", key)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Storage endpoint not found");
  if (!data.is_active) throw new Error("Storage endpoint is disabled");
  return data as EndpointRow;
}

async function requireAdmin(context: { supabase: any; userId: string }) {
  const { data, error } = await context.supabase.rpc("is_admin");
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden: admin role required");
}

export const listStorageBuckets = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ endpoint: keySchema }).parse(input))
  .handler(async ({ data, context }) => {
    const { listBuckets, readCredentials } = await import("@/lib/s3.server");
    const ep = await loadEndpoint(context.supabase, data.endpoint);
    try {
      return { buckets: await listBuckets(ep, readCredentials(ep.secret_prefix)), error: null };
    } catch (e) {
      console.error("[storage] listBuckets", e);
      return { buckets: [], error: (e as Error).message };
    }
  });

export const listStorageObjects = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        endpoint: keySchema,
        bucket: bucketSchema,
        prefix: prefixSchema,
        token: z.string().max(4096).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { listObjects, readCredentials } = await import("@/lib/s3.server");
    const ep = await loadEndpoint(context.supabase, data.endpoint);
    try {
      const result = await listObjects(
        ep,
        readCredentials(ep.secret_prefix),
        data.bucket,
        data.prefix,
        data.token,
      );
      return { ...result, error: null };
    } catch (e) {
      console.error("[storage] listObjects", e);
      return {
        folders: [] as string[],
        objects: [] as { key: string; size: number; lastModified: string | null; etag: string }[],
        isTruncated: false,
        nextToken: null,
        error: (e as Error).message,
      };
    }
  });

export const getStorageDownloadUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ endpoint: keySchema, bucket: bucketSchema, key: objectKeySchema }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { s3PresignUrl, readCredentials } = await import("@/lib/s3.server");
    const ep = await loadEndpoint(context.supabase, data.endpoint);
    const url = await s3PresignUrl(ep, readCredentials(ep.secret_prefix), {
      method: "GET",
      bucket: data.bucket,
      key: data.key,
      expiresIn: 900,
    });
    await recordSecurityEvent(context.supabase, {
      category: "storage",
      eventType: "object_download_url",
      description: `${data.endpoint}/${data.bucket}/${data.key}`,
      detail: { endpoint: data.endpoint, bucket: data.bucket, key: data.key },
    });
    return { url, expiresIn: 900 };
  });

export const getStorageUploadUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ endpoint: keySchema, bucket: bucketSchema, key: objectKeySchema }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const { s3PresignUrl, readCredentials } = await import("@/lib/s3.server");
    const ep = await loadEndpoint(context.supabase, data.endpoint);
    const url = await s3PresignUrl(ep, readCredentials(ep.secret_prefix), {
      method: "PUT",
      bucket: data.bucket,
      key: data.key,
      expiresIn: 900,
    });
    await recordSecurityEvent(context.supabase, {
      category: "storage",
      eventType: "object_upload_url",
      description: `${data.endpoint}/${data.bucket}/${data.key}`,
      detail: { endpoint: data.endpoint, bucket: data.bucket, key: data.key },
    });
    return { url, expiresIn: 900 };
  });

export const deleteStorageObject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ endpoint: keySchema, bucket: bucketSchema, key: objectKeySchema }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const { deleteObject, readCredentials } = await import("@/lib/s3.server");
    const ep = await loadEndpoint(context.supabase, data.endpoint);
    await deleteObject(ep, readCredentials(ep.secret_prefix), data.bucket, data.key);
    await recordSecurityEvent(context.supabase, {
      category: "storage",
      eventType: "object_delete",
      description: `${data.endpoint}/${data.bucket}/${data.key}`,
      detail: { endpoint: data.endpoint, bucket: data.bucket, key: data.key },
    });
    return { ok: true };
  });

export const checkStorageEndpoint = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ endpoint: keySchema }).parse(input))
  .handler(async ({ data, context }) => {
    const { listBuckets, readCredentials } = await import("@/lib/s3.server");
    const ep = await loadEndpoint(context.supabase, data.endpoint);
    const started = Date.now();
    try {
      const buckets = await listBuckets(ep, readCredentials(ep.secret_prefix));
      return { ok: true, buckets: buckets.length, latencyMs: Date.now() - started, error: null };
    } catch (e) {
      console.error("[storage] check", e);
      return { ok: false, buckets: 0, latencyMs: Date.now() - started, error: (e as Error).message };
    }
  });
