import { supabase } from "@/integrations/supabase/client";

export type SecurityCategory = "auth" | "storage";
export type SecurityStatus = "success" | "failure";

/**
 * Client-side security audit trail writer.
 * Writes through the SECURITY DEFINER RPC so no direct table grants are needed
 * (failed sign-in attempts happen before a session exists).
 */
export async function logSecurityEvent(input: {
  category: SecurityCategory;
  eventType: string;
  status?: SecurityStatus;
  actorEmail?: string | null;
  description?: string | null;
  detail?: Record<string, unknown>;
}) {
  try {
    await supabase.rpc("log_security_event", {
      _category: input.category,
      _event_type: input.eventType,
      _status: input.status ?? "success",
      _actor_email: input.actorEmail ?? null,
      _description: input.description ?? null,
      _detail: (input.detail ?? {}) as never,
      _ip_address: null,
      _user_agent: typeof navigator === "undefined" ? null : navigator.userAgent,
    });
  } catch (e) {
    console.warn("[security-log] failed to record event", e);
  }
}
