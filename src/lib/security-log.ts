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
    const args: Record<string, unknown> = {
      _category: input.category,
      _event_type: input.eventType,
      _status: input.status ?? "success",
      _detail: input.detail ?? {},
    };
    if (input.actorEmail) args["_actor_email"] = input.actorEmail;
    if (input.description) args["_description"] = input.description;
    if (typeof navigator !== "undefined") args["_user_agent"] = navigator.userAgent;
    await supabase.rpc("log_security_event", args as never);


  } catch (e) {
    console.warn("[security-log] failed to record event", e);
  }
}
