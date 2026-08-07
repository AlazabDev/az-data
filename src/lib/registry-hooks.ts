import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type RegistryTable =
  | "systems"
  | "environments"
  | "databases"
  | "data_sources"
  | "audit_logs"
  | "adp_user_roles"
  | "adp_profiles";

export function useRows<T>(table: RegistryTable, orderBy = "created_at", ascending = false) {
  return useQuery({
    queryKey: [table, orderBy, ascending],
    queryFn: async (): Promise<T[]> => {
      const { data, error } = await supabase
        .from(table)
        .select("*")
        .order(orderBy, { ascending })
        .limit(1000);
      if (error) throw error;
      return (data ?? []) as T[];
    },
  });
}

export function useSaveRow(table: RegistryTable) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (values: Record<string, unknown>) => {
      const payload = { ...values };
      const id = payload["id"] as string | undefined;
      if (id) {
        delete payload["id"];
        const { error } = await supabase
          .from(table)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .update(payload as any)
          .eq("id", id);
        if (error) throw error;
      } else {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await supabase.from(table).insert(payload as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      void qc.invalidateQueries();
    },
  });
}

export function useDeleteRow(table: RegistryTable) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from(table).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      void qc.invalidateQueries();
    },
  });
}
