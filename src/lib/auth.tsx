import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { logSecurityEvent } from "@/lib/security-log";
import type { AppRole } from "@/lib/registry-types";


type AuthValue = {
  user: User | null;
  session: Session | null;
  roles: AppRole[];
  canWrite: boolean;
  loading: boolean;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthValue | null>(null);

const WRITE_ROLES: AppRole[] = [
  "platform_owner",
  "platform_admin",
  "database_administrator",
  "data_engineer",
];

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
    });
    void supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const uid = session?.user.id;
    if (!uid) {
      setRoles([]);
      return;
    }
    let cancelled = false;
    void supabase
      .from("adp_user_roles")
      .select("role")
      .eq("user_id", uid)
      .then(({ data }) => {
        if (!cancelled) setRoles((data ?? []).map((r) => r.role as AppRole));
      });
    return () => {
      cancelled = true;
    };
  }, [session?.user.id]);

  const value: AuthValue = {
    user: session?.user ?? null,
    session,
    roles,
    canWrite: roles.some((r) => WRITE_ROLES.includes(r)),
    loading,
    signOut: async () => {
      await logSecurityEvent({
        category: "auth",
        eventType: "sign_out",
        ...(session?.user.email ? { actorEmail: session.user.email } : {}),
      });
      await supabase.auth.signOut();
      setRoles([]);
    },

  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
