export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      audit_logs: {
        Row: {
          action: string
          actor_email: string | null
          actor_id: string | null
          after_data: Json | null
          before_data: Json | null
          created_at: string
          entity_id: string | null
          entity_label: string | null
          entity_type: string
          id: string
          result: string
        }
        Insert: {
          action: string
          actor_email?: string | null
          actor_id?: string | null
          after_data?: Json | null
          before_data?: Json | null
          created_at?: string
          entity_id?: string | null
          entity_label?: string | null
          entity_type: string
          id?: string
          result?: string
        }
        Update: {
          action?: string
          actor_email?: string | null
          actor_id?: string | null
          after_data?: Json | null
          before_data?: Json | null
          created_at?: string
          entity_id?: string | null
          entity_label?: string | null
          entity_type?: string
          id?: string
          result?: string
        }
        Relationships: []
      }
      data_sources: {
        Row: {
          business_owner: string | null
          code: string
          connection_reference: string | null
          created_at: string
          criticality: Database["public"]["Enums"]["criticality_level"]
          data_format: string | null
          environment_id: string | null
          health: Database["public"]["Enums"]["health_status"]
          id: string
          kind: Database["public"]["Enums"]["datasource_kind"]
          location: string | null
          name: string
          notes: string | null
          provider: string | null
          status: Database["public"]["Enums"]["lifecycle_status"]
          system_id: string | null
          technical_owner: string | null
          updated_at: string
        }
        Insert: {
          business_owner?: string | null
          code: string
          connection_reference?: string | null
          created_at?: string
          criticality?: Database["public"]["Enums"]["criticality_level"]
          data_format?: string | null
          environment_id?: string | null
          health?: Database["public"]["Enums"]["health_status"]
          id?: string
          kind?: Database["public"]["Enums"]["datasource_kind"]
          location?: string | null
          name: string
          notes?: string | null
          provider?: string | null
          status?: Database["public"]["Enums"]["lifecycle_status"]
          system_id?: string | null
          technical_owner?: string | null
          updated_at?: string
        }
        Update: {
          business_owner?: string | null
          code?: string
          connection_reference?: string | null
          created_at?: string
          criticality?: Database["public"]["Enums"]["criticality_level"]
          data_format?: string | null
          environment_id?: string | null
          health?: Database["public"]["Enums"]["health_status"]
          id?: string
          kind?: Database["public"]["Enums"]["datasource_kind"]
          location?: string | null
          name?: string
          notes?: string | null
          provider?: string | null
          status?: Database["public"]["Enums"]["lifecycle_status"]
          system_id?: string | null
          technical_owner?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "data_sources_environment_id_fkey"
            columns: ["environment_id"]
            isOneToOne: false
            referencedRelation: "environments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "data_sources_system_id_fkey"
            columns: ["system_id"]
            isOneToOne: false
            referencedRelation: "systems"
            referencedColumns: ["id"]
          },
        ]
      }
      databases: {
        Row: {
          backup_policy: string | null
          backup_required: boolean
          business_owner: string | null
          code: string
          connection_reference: string | null
          created_at: string
          criticality: Database["public"]["Enums"]["criticality_level"]
          database_name: string | null
          dependencies: string | null
          engine: string | null
          engine_version: string | null
          environment_id: string | null
          health: Database["public"]["Enums"]["health_status"]
          health_reason: string | null
          host: string | null
          id: string
          last_backup_at: string | null
          last_health_check_at: string | null
          last_restore_test_at: string | null
          migration_version: string | null
          monitoring_policy: string | null
          name: string
          notes: string | null
          operations_owner: string | null
          port: number | null
          provider: string | null
          region: string | null
          restore_verified: boolean
          schema_version: string | null
          status: Database["public"]["Enums"]["lifecycle_status"]
          system_id: string | null
          target_version: string | null
          technical_owner: string | null
          updated_at: string
        }
        Insert: {
          backup_policy?: string | null
          backup_required?: boolean
          business_owner?: string | null
          code: string
          connection_reference?: string | null
          created_at?: string
          criticality?: Database["public"]["Enums"]["criticality_level"]
          database_name?: string | null
          dependencies?: string | null
          engine?: string | null
          engine_version?: string | null
          environment_id?: string | null
          health?: Database["public"]["Enums"]["health_status"]
          health_reason?: string | null
          host?: string | null
          id?: string
          last_backup_at?: string | null
          last_health_check_at?: string | null
          last_restore_test_at?: string | null
          migration_version?: string | null
          monitoring_policy?: string | null
          name: string
          notes?: string | null
          operations_owner?: string | null
          port?: number | null
          provider?: string | null
          region?: string | null
          restore_verified?: boolean
          schema_version?: string | null
          status?: Database["public"]["Enums"]["lifecycle_status"]
          system_id?: string | null
          target_version?: string | null
          technical_owner?: string | null
          updated_at?: string
        }
        Update: {
          backup_policy?: string | null
          backup_required?: boolean
          business_owner?: string | null
          code?: string
          connection_reference?: string | null
          created_at?: string
          criticality?: Database["public"]["Enums"]["criticality_level"]
          database_name?: string | null
          dependencies?: string | null
          engine?: string | null
          engine_version?: string | null
          environment_id?: string | null
          health?: Database["public"]["Enums"]["health_status"]
          health_reason?: string | null
          host?: string | null
          id?: string
          last_backup_at?: string | null
          last_health_check_at?: string | null
          last_restore_test_at?: string | null
          migration_version?: string | null
          monitoring_policy?: string | null
          name?: string
          notes?: string | null
          operations_owner?: string | null
          port?: number | null
          provider?: string | null
          region?: string | null
          restore_verified?: boolean
          schema_version?: string | null
          status?: Database["public"]["Enums"]["lifecycle_status"]
          system_id?: string | null
          target_version?: string | null
          technical_owner?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "databases_environment_id_fkey"
            columns: ["environment_id"]
            isOneToOne: false
            referencedRelation: "environments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "databases_system_id_fkey"
            columns: ["system_id"]
            isOneToOne: false
            referencedRelation: "systems"
            referencedColumns: ["id"]
          },
        ]
      }
      environments: {
        Row: {
          created_at: string
          description: string | null
          id: string
          kind: Database["public"]["Enums"]["environment_kind"]
          name: string
          notes: string | null
          status: Database["public"]["Enums"]["lifecycle_status"]
          system_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["environment_kind"]
          name: string
          notes?: string | null
          status?: Database["public"]["Enums"]["lifecycle_status"]
          system_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["environment_kind"]
          name?: string
          notes?: string | null
          status?: Database["public"]["Enums"]["lifecycle_status"]
          system_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "environments_system_id_fkey"
            columns: ["system_id"]
            isOneToOne: false
            referencedRelation: "systems"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      systems: {
        Row: {
          business_owner: string | null
          code: string
          created_at: string
          criticality: Database["public"]["Enums"]["criticality_level"]
          description: string | null
          id: string
          last_reviewed_at: string | null
          name: string
          operational_notes: string | null
          purpose: string | null
          status: Database["public"]["Enums"]["lifecycle_status"]
          technical_owner: string | null
          updated_at: string
        }
        Insert: {
          business_owner?: string | null
          code: string
          created_at?: string
          criticality?: Database["public"]["Enums"]["criticality_level"]
          description?: string | null
          id?: string
          last_reviewed_at?: string | null
          name: string
          operational_notes?: string | null
          purpose?: string | null
          status?: Database["public"]["Enums"]["lifecycle_status"]
          technical_owner?: string | null
          updated_at?: string
        }
        Update: {
          business_owner?: string | null
          code?: string
          created_at?: string
          criticality?: Database["public"]["Enums"]["criticality_level"]
          description?: string | null
          id?: string
          last_reviewed_at?: string | null
          name?: string
          operational_notes?: string | null
          purpose?: string | null
          status?: Database["public"]["Enums"]["lifecycle_status"]
          technical_owner?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_write_registry: { Args: { _user_id: string }; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role:
        | "platform_owner"
        | "platform_admin"
        | "database_administrator"
        | "data_engineer"
        | "application_owner"
        | "integration_manager"
        | "analyst"
        | "read_only"
      criticality_level: "critical" | "high" | "medium" | "low" | "unknown"
      datasource_kind:
        | "api"
        | "file_store"
        | "object_storage"
        | "queue"
        | "cache"
        | "warehouse"
        | "vector_store"
        | "spreadsheet"
        | "other"
      environment_kind:
        | "production"
        | "staging"
        | "development"
        | "testing"
        | "sandbox"
        | "dr"
        | "other"
      health_status: "healthy" | "warning" | "critical" | "unknown"
      lifecycle_status:
        | "active"
        | "inactive"
        | "maintenance"
        | "deprecated"
        | "archived"
        | "unknown"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: [
        "platform_owner",
        "platform_admin",
        "database_administrator",
        "data_engineer",
        "application_owner",
        "integration_manager",
        "analyst",
        "read_only",
      ],
      criticality_level: ["critical", "high", "medium", "low", "unknown"],
      datasource_kind: [
        "api",
        "file_store",
        "object_storage",
        "queue",
        "cache",
        "warehouse",
        "vector_store",
        "spreadsheet",
        "other",
      ],
      environment_kind: [
        "production",
        "staging",
        "development",
        "testing",
        "sandbox",
        "dr",
        "other",
      ],
      health_status: ["healthy", "warning", "critical", "unknown"],
      lifecycle_status: [
        "active",
        "inactive",
        "maintenance",
        "deprecated",
        "archived",
        "unknown",
      ],
    },
  },
} as const
