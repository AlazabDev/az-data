type RpcClient = { rpc: (fn: string, args: Record<string, unknown>) => Promise<{ error: unknown }> };

/**
 * Server-side security audit trail writer. Never throws — logging must not
 * break the operation it observes.
 */
export async function recordSecurityEvent(
  supabase: RpcClient,
  input: {
    category: "auth" | "storage";
    eventType: string;
    status?: "success" | "failure";
    actorEmail?: string | null;
    description?: string | null;
    detail?: Record<string, unknown>;
    ipAddress?: string | null;
    userAgent?: string | null;
  },
) {
  try {
    const { error } = await supabase.rpc("log_security_event", {
      _category: input.category,
      _event_type: input.eventType,
      _status: input.status ?? "success",
      _actor_email: input.actorEmail ?? null,
      _description: input.description ?? null,
      _detail: input.detail ?? {},
      _ip_address: input.ipAddress ?? null,
      _user_agent: input.userAgent ?? null,
    });
    if (error) console.warn("[security-log] rpc error", error);
  } catch (e) {
    console.warn("[security-log] failed to record event", e);
  }
}
