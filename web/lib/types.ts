// Generated via Supabase MCP `generate_typescript_types` (project yhgdcdkfkerzuhnzjzrz).
// Regenerate after schema changes rather than hand-editing.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
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
          territory_id: string
          user_id: string
        }
        Insert: {
          catch_id?: number | null
          created_at?: string
          id?: never
          kind: string
          territory_id: string
          user_id: string
        }
        Update: {
          catch_id?: number | null
          created_at?: string
          id?: never
          kind?: string
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
        ]
      }
      catches: {
        Row: {
          bait: string | null
          caught_at: string
          id: number
          length_cm: number | null
          method: string | null
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
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string
          followers_count: number
          id: string
          location: string | null
        }
        Insert: {
          created_at?: string
          display_name?: string
          followers_count?: number
          id: string
          location?: string | null
        }
        Update: {
          created_at?: string
          display_name?: string
          followers_count?: number
          id?: string
          location?: string | null
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
          kind: Database["public"]["Enums"]["territory_kind"]
          lat: number
          lng: number
          owner_id: string | null
        }
        Insert: {
          claimed_at?: string | null
          created_at?: string
          id: string
          kind: Database["public"]["Enums"]["territory_kind"]
          lat: number
          lng: number
          owner_id?: string | null
        }
        Update: {
          claimed_at?: string | null
          created_at?: string
          id?: string
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
        ]
      }
    }
    Views: {
      territories_with_stats: {
        Row: {
          catch_count: number | null
          claimed_at: string | null
          created_at: string | null
          id: string | null
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
        ]
      }
    }
    Functions: {
      confirm_catch: {
        Args: {
          p_bait?: string
          p_length_cm?: number
          p_method?: string
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
          species: string
          territory_id: string
          user_id: string
          weight_kg: number | null
        }
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

export const Constants = {
  public: {
    Enums: {
      territory_kind: ["sea", "river", "stream", "lake"],
    },
  },
} as const
