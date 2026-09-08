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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      activity_log: {
        Row: {
          catch_id: number | null
          created_at: string
          id: number
          kind: string
          previous_owner_id: string | null
          territory_id: string
          user_id: string
        }
        Insert: {
          catch_id?: number | null
          created_at?: string
          id?: never
          kind: string
          previous_owner_id?: string | null
          territory_id: string
          user_id: string
        }
        Update: {
          catch_id?: number | null
          created_at?: string
          id?: never
          kind?: string
          previous_owner_id?: string | null
          territory_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_log_catch_id_fkey"
            columns: ["catch_id"]
            isOneToOne: false
            referencedRelation: "catches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_log_previous_owner_id_fkey"
            columns: ["previous_owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_log_previous_owner_id_fkey"
            columns: ["previous_owner_id"]
            isOneToOne: false
            referencedRelation: "profiles_with_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_log_territory_id_fkey"
            columns: ["territory_id"]
            isOneToOne: false
            referencedRelation: "territories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_log_territory_id_fkey"
            columns: ["territory_id"]
            isOneToOne: false
            referencedRelation: "territories_with_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles_with_stats"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_actions: {
        Row: {
          action: string
          admin_id: string
          created_at: string
          details: string
          id: number
          target_user_id: string | null
          territory_id: string | null
        }
        Insert: {
          action: string
          admin_id: string
          created_at?: string
          details: string
          id?: number
          target_user_id?: string | null
          territory_id?: string | null
        }
        Update: {
          action?: string
          admin_id?: string
          created_at?: string
          details?: string
          id?: number
          target_user_id?: string | null
          territory_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "admin_actions_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_actions_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "profiles_with_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_actions_target_user_id_fkey"
            columns: ["target_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_actions_target_user_id_fkey"
            columns: ["target_user_id"]
            isOneToOne: false
            referencedRelation: "profiles_with_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_actions_territory_id_fkey"
            columns: ["territory_id"]
            isOneToOne: false
            referencedRelation: "territories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_actions_territory_id_fkey"
            columns: ["territory_id"]
            isOneToOne: false
            referencedRelation: "territories_with_stats"
            referencedColumns: ["id"]
          },
        ]
      }
      catch_reports: {
        Row: {
          catch_id: number
          created_at: string
          id: number
          reason: string
          reporter_id: string
        }
        Insert: {
          catch_id: number
          created_at?: string
          id?: number
          reason: string
          reporter_id: string
        }
        Update: {
          catch_id?: number
          created_at?: string
          id?: number
          reason?: string
          reporter_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "catch_reports_catch_id_fkey"
            columns: ["catch_id"]
            isOneToOne: false
            referencedRelation: "catches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "catch_reports_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "catch_reports_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "profiles_with_stats"
            referencedColumns: ["id"]
          },
        ]
      }
      catches: {
        Row: {
          bait: string | null
          caught_at: string
          id: number
          length_cm: number | null
          method: string | null
          photo_url: string
          species: string
          territory_id: string
          user_id: string
          weight_kg: number | null
        }
        Insert: {
          bait?: string | null
          caught_at?: string
          id?: never
          length_cm?: number | null
          method?: string | null
          photo_url: string
          species: string
          territory_id: string
          user_id: string
          weight_kg?: number | null
        }
        Update: {
          bait?: string | null
          caught_at?: string
          id?: never
          length_cm?: number | null
          method?: string | null
          photo_url?: string
          species?: string
          territory_id?: string
          user_id?: string
          weight_kg?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "catches_species_fkey"
            columns: ["species"]
            isOneToOne: false
            referencedRelation: "species"
            referencedColumns: ["key"]
          },
          {
            foreignKeyName: "catches_territory_id_fkey"
            columns: ["territory_id"]
            isOneToOne: false
            referencedRelation: "territories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "catches_territory_id_fkey"
            columns: ["territory_id"]
            isOneToOne: false
            referencedRelation: "territories_with_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "catches_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "catches_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles_with_stats"
            referencedColumns: ["id"]
          },
        ]
      }
      follows: {
        Row: {
          created_at: string
          followee_id: string
          follower_id: string
        }
        Insert: {
          created_at?: string
          followee_id: string
          follower_id: string
        }
        Update: {
          created_at?: string
          followee_id?: string
          follower_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "follows_followee_id_fkey"
            columns: ["followee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "follows_followee_id_fkey"
            columns: ["followee_id"]
            isOneToOne: false
            referencedRelation: "profiles_with_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "follows_follower_id_fkey"
            columns: ["follower_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "follows_follower_id_fkey"
            columns: ["follower_id"]
            isOneToOne: false
            referencedRelation: "profiles_with_stats"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          birth_date: string | null
          created_at: string
          display_name: string
          gender: string | null
          height_cm: number | null
          id: string
          is_admin: boolean
          is_blocked: boolean
          is_super_admin: boolean
          location: string | null
          onboarding_completed: boolean
          public_id: string
          territory_color: string | null
          weight_kg: number | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          birth_date?: string | null
          created_at?: string
          display_name?: string
          gender?: string | null
          height_cm?: number | null
          id: string
          is_admin?: boolean
          is_blocked?: boolean
          is_super_admin?: boolean
          location?: string | null
          onboarding_completed?: boolean
          public_id: string
          territory_color?: string | null
          weight_kg?: number | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          birth_date?: string | null
          created_at?: string
          display_name?: string
          gender?: string | null
          height_cm?: number | null
          id?: string
          is_admin?: boolean
          is_blocked?: boolean
          is_super_admin?: boolean
          location?: string | null
          onboarding_completed?: boolean
          public_id?: string
          territory_color?: string | null
          weight_kg?: number | null
        }
        Relationships: []
      }
      species: {
        Row: {
          category: string
          key: string
          name: string
        }
        Insert: {
          category: string
          key: string
          name: string
        }
        Update: {
          category?: string
          key?: string
          name?: string
        }
        Relationships: []
      }
      territories: {
        Row: {
          claimed_at: string | null
          created_at: string
          id: string
          is_deleted: boolean
          kind: Database["public"]["Enums"]["territory_kind"]
          lat: number
          lng: number
          owner_id: string | null
        }
        Insert: {
          claimed_at?: string | null
          created_at?: string
          id: string
          is_deleted?: boolean
          kind: Database["public"]["Enums"]["territory_kind"]
          lat: number
          lng: number
          owner_id?: string | null
        }
        Update: {
          claimed_at?: string | null
          created_at?: string
          id?: string
          is_deleted?: boolean
          kind?: Database["public"]["Enums"]["territory_kind"]
          lat?: number
          lng?: number
          owner_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "territories_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "territories_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles_with_stats"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      profiles_with_stats: {
        Row: {
          avatar_url: string | null
          bio: string | null
          birth_date: string | null
          catches_count: number | null
          created_at: string | null
          display_name: string | null
          followers_count: number | null
          following_count: number | null
          gender: string | null
          height_cm: number | null
          id: string | null
          is_admin: boolean | null
          is_blocked: boolean | null
          is_super_admin: boolean | null
          location: string | null
          onboarding_completed: boolean | null
          public_id: string | null
          territories_count: number | null
          territory_color: string | null
          weight_kg: number | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          birth_date?: never
          catches_count?: never
          created_at?: string | null
          display_name?: string | null
          followers_count?: never
          following_count?: never
          gender?: never
          height_cm?: never
          id?: string | null
          is_admin?: boolean | null
          is_blocked?: boolean | null
          is_super_admin?: boolean | null
          location?: string | null
          onboarding_completed?: boolean | null
          public_id?: string | null
          territories_count?: never
          territory_color?: string | null
          weight_kg?: never
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          birth_date?: never
          catches_count?: never
          created_at?: string | null
          display_name?: string | null
          followers_count?: never
          following_count?: never
          gender?: never
          height_cm?: never
          id?: string | null
          is_admin?: boolean | null
          is_blocked?: boolean | null
          is_super_admin?: boolean | null
          location?: string | null
          onboarding_completed?: boolean | null
          public_id?: string | null
          territories_count?: never
          territory_color?: string | null
          weight_kg?: never
        }
        Relationships: []
      }
      territories_with_stats: {
        Row: {
          catch_count: number | null
          claimed_at: string | null
          created_at: string | null
          id: string | null
          is_deleted: boolean | null
          kind: Database["public"]["Enums"]["territory_kind"] | null
          last_catch_at: string | null
          lat: number | null
          lng: number | null
          owner_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "territories_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "territories_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles_with_stats"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      admin_delete_catch: { Args: { p_catch_id: number }; Returns: undefined }
      admin_delete_territory: {
        Args: { p_territory_id: string }
        Returns: undefined
      }
      admin_delete_user: { Args: { p_user_id: string }; Returns: undefined }
      admin_dismiss_report: {
        Args: { p_report_id: number }
        Returns: undefined
      }
      admin_set_admin: {
        Args: { p_is_admin: boolean; p_user_id: string }
        Returns: undefined
      }
      admin_set_blocked: {
        Args: { p_blocked: boolean; p_user_id: string }
        Returns: undefined
      }
      confirm_catch: {
        Args: {
          p_bait?: string
          p_length_cm?: number
          p_method?: string
          p_photo_url: string
          p_species: string
          p_territory_id: string
          p_weight_kg?: number
        }
        Returns: {
          bait: string | null
          caught_at: string
          id: number
          length_cm: number | null
          method: string | null
          photo_url: string
          species: string
          territory_id: string
          user_id: string
          weight_kg: number | null
        }
        SetofOptions: {
          from: "*"
          to: "catches"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      get_report_deletion_count: {
        Args: { p_user_id: string }
        Returns: number
      }
    }
    Enums: {
      territory_kind: "sea" | "river" | "stream" | "lake"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      territory_kind: ["sea", "river", "stream", "lake"],
    },
  },
} as const
