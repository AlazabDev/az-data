import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { recordSecurityEvent } from "@/lib/security-log.server";

const objectCodeSchema = z.string().regex(/^OBJ-[0-9]{4}-[0-9]{2}-[0-9]{6}$/);

function serverConfig() {
  const root = process.env["ADP_STORAGE_ROOT"]?.trim() || "";
  const parsedMax = Number(process.env["ADP_SERVER_UPLOAD_MAX_MB"] ?? "128");
  const maxUploadMb = Number.isFinite(parsedMax) && parsedMax > 0 ? Math.min(parsedMax, 2048) : 128;
  return { root, maxUploadMb };
}

function inferContentClass(mimeType: string) {
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("video/")) return "video";
  if (mimeType.startsWith("audio/")) return "audio";
  if (mimeType === "application/pdf") return "document";
  if (mimeType.includes("json") || mimeType.includes("xml") || mimeType.startsWith("text/")) return "data";
  return "file";
}

function toHex(buffer: ArrayBuffer) {
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function sha256(buffer: ArrayBuffer) {
  return toHex(await crypto.subtle.digest("SHA-256", buffer));
}

async function requireStorageManager(supabase: any) {
  const { data, error } = await supabase.rpc("can_manage_storage");
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden: storage manager role required");
}

function parseFormData(input: unknown) {
  if (!(input instanceof FormData)) throw new Error("Expected FormData");
  const contextType = String(input.get("context_type") ?? "").toLowerCase();
  const contextId = String(input.get("context_id") ?? "");
  const displayName = String(input.get("display_name") ?? "").trim();
  const requestedClass = String(input.get("content_class") ?? "").trim().toLowerCase();
  const fileValue = input.get("file");

  if (contextType !== "request" && contextType !== "project") throw new Error("Invalid storage context");
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(contextId)) {
    throw new Error("Invalid context ID");
  }
  if (!fileValue || typeof fileValue === "string" || typeof (fileValue as Blob).arrayBuffer !== "function") {
    throw new Error("File is required");
  }

  const file = fileValue as File;
  return {
    contextType,
    contextId,
    displayName: displayName || file.name || "Object",
    contentClass: requestedClass || inferContentClass(file.type || "application/octet-stream"),
    file,
  };
}

export const getServerStorageStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const config = serverConfig();
    return {
      configured: Boolean(config.root),
      maxUploadMb: config.maxUploadMb,
      authority: "server" as const,
    };
  });

export const uploadServerStorageObject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(parseFormData)
  .handler(async ({ data, context }) => {
    const config = serverConfig();
    if (!config.root) throw new Error("Server storage is not configured. Set ADP_STORAGE_ROOT on the Alazab server.");
    await requireStorageManager(context.supabase);

    const maxBytes = config.maxUploadMb * 1024 * 1024;
    if (data.file.size > maxBytes) throw new Error(`File exceeds server upload limit (${config.maxUploadMb} MB)`);

    const bytes = await data.file.arrayBuffer();
    const digest = await sha256(bytes);
    const { data: reserved, error: reserveError } = await context.supabase.rpc("reserve_storage_object_code");
    if (reserveError) throw new Error(reserveError.message);
    const objectCode = String(reserved ?? "");
    objectCodeSchema.parse(objectCode);

    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    const root = path.resolve(config.root);
    await fs.mkdir(root, { recursive: true });
    const target = path.join(root, objectCode);

    // The physical file name is the immutable OBJ identity, never the user filename.
    await fs.writeFile(target, new Uint8Array(bytes), { flag: "wx" });

    const extension = path.extname(data.file.name || "").replace(/^\./, "").toLowerCase();
    const { data: registered, error: registerError } = await context.supabase.rpc("register_storage_server_object", {
      _object_code: objectCode,
      _context_type: data.contextType,
      _context_id: data.contextId,
      _display_name: data.displayName,
      _original_filename: data.file.name || data.displayName,
      _extension: extension,
      _mime_type: data.file.type || "application/octet-stream",
      _content_class: data.contentClass,
      _size_bytes: data.file.size,
      _sha256: digest,
    });

    if (registerError) {
      await fs.rm(target, { force: true }).catch(() => undefined);
      await recordSecurityEvent(context.supabase, {
        category: "storage",
        eventType: "server_object_upload",
        status: "failure",
        description: registerError.message,
        detail: { objectCode, contextType: data.contextType, contextId: data.contextId },
      });
      throw new Error(registerError.message);
    }

    await recordSecurityEvent(context.supabase, {
      category: "storage",
      eventType: "server_object_upload",
      description: `${objectCode} · ${data.displayName}`,
      detail: {
        objectCode,
        contextType: data.contextType,
        contextId: data.contextId,
        sizeBytes: data.file.size,
        sha256: digest,
      },
    });

    const row = Array.isArray(registered) ? registered[0] : registered;
    return {
      objectId: row?.object_id as string,
      objectCode: row?.object_code as string,
      sizeBytes: data.file.size,
      sha256: digest,
      location: `server://primary/${objectCode}`,
    };
  });

export const downloadServerStorageObject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ objectCode: objectCodeSchema }).parse(input))
  .handler(async ({ data, context }) => {
    const config = serverConfig();
    if (!config.root) throw new Error("Server storage is not configured");

    const [{ data: object, error: objectError }, { data: location, error: locationError }] = await Promise.all([
      context.supabase
        .from("storage_objects")
        .select("id,object_code,display_name,original_filename,mime_type,size_bytes,sha256")
        .eq("object_code", data.objectCode)
        .maybeSingle(),
      context.supabase
        .from("storage_object_resolution")
        .select("location_kind,availability")
        .eq("object_code", data.objectCode)
        .maybeSingle(),
    ]);
    if (objectError) throw new Error(objectError.message);
    if (locationError) throw new Error(locationError.message);
    if (!object) throw new Error("Storage object not found");
    if (!location || location.location_kind !== "server" || location.availability !== "available") {
      throw new Error("No available direct server copy for this object");
    }

    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    const target = path.join(path.resolve(config.root), data.objectCode);
    const bytes = await fs.readFile(target);
    const responseBytes = Uint8Array.from(bytes);
    const digest = await sha256(responseBytes.buffer);
    if (object.sha256 && digest.toLowerCase() !== String(object.sha256).toLowerCase()) {
      await context.supabase
        .from("storage_object_locations")
        .update({ availability: "unavailable", last_verified_at: new Date().toISOString() })
        .eq("object_id", object.id)
        .eq("location_kind", "server");
      throw new Error("Object integrity verification failed");
    }

    await context.supabase
      .from("storage_object_locations")
      .update({ availability: "available", last_verified_at: new Date().toISOString(), sha256: digest })
      .eq("object_id", object.id)
      .eq("location_kind", "server");

    await recordSecurityEvent(context.supabase, {
      category: "storage",
      eventType: "server_object_download",
      description: String(object.object_code ?? data.objectCode),
      detail: { objectCode: data.objectCode, sizeBytes: object.size_bytes },
    });

    const filename = object.original_filename || object.display_name || data.objectCode;
    const encoded = encodeURIComponent(filename);
    return new Response(responseBytes, {
      status: 200,
      headers: {
        "content-type": object.mime_type || "application/octet-stream",
        "content-length": String(bytes.byteLength),
        "content-disposition": `attachment; filename*=UTF-8''${encoded}`,
        "x-alazab-object-id": data.objectCode,
        "x-content-sha256": digest,
        "cache-control": "private, no-store",
      },
    });
  });
