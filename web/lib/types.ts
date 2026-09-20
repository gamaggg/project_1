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
      coin_transactions: {
        Row: {
          amount: number
          created_at: string
          id: number
          label: string
          reason: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: never
          label: string
          reason: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: never
          label?: string
          reason?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "coin_transactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coin_transactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles_with_stats"
            referencedColumns: ["id"]
          },
        ]
      }
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
      announcements: {
        Row: {
          author_id: string | null
          body: string
          broadcast_telegram: boolean
          button_label: string | null
          button_url: string | null
          created_at: string
          id: number
          photo_url: string | null
        }
        Insert: {
          author_id?: string | null
          body: string
          broadcast_telegram?: boolean
          button_label?: string | null
          button_url?: string | null
          created_at?: string
          id?: never
          photo_url?: string | null
        }
        Update: {
          author_id?: string | null
          body?: string
          broadcast_telegram?: boolean
          button_label?: string | null
          button_url?: string | null
          created_at?: string
          id?: never
          photo_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "announcements_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "announcements_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles_with_stats"
            referencedColumns: ["id"]
          },
        ]
      }
      catch_likes: {
        Row: {
          catch_id: number
          created_at: string
          user_id: string
        }
        Insert: {
          catch_id: number
          created_at?: string
          user_id: string
        }
        Update: {
          catch_id?: number
          created_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "catch_likes_catch_id_fkey"
            columns: ["catch_id"]
            isOneToOne: false
            referencedRelation: "catches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "catch_likes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "catch_likes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles_with_stats"
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
          echo: boolean
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
          echo?: boolean
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
          echo?: boolean
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
      notifications: {
        Row: {
          actor_id: string | null
          catch_id: number | null
          created_at: string
          id: number
          kind: string
          payload: Json | null
          read_at: string | null
          telegram_digested_at: string | null
          territory_id: string | null
          user_id: string
        }
        Insert: {
          actor_id?: string | null
          catch_id?: number | null
          created_at?: string
          id?: never
          kind: string
          payload?: Json | null
          read_at?: string | null
          telegram_digested_at?: string | null
          territory_id?: string | null
          user_id: string
        }
        Update: {
          actor_id?: string | null
          catch_id?: number | null
          created_at?: string
          id?: never
          kind?: string
          payload?: Json | null
          read_at?: string | null
          telegram_digested_at?: string | null
          territory_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles_with_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_catch_id_fkey"
            columns: ["catch_id"]
            isOneToOne: false
            referencedRelation: "catches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_territory_id_fkey"
            columns: ["territory_id"]
            isOneToOne: false
            referencedRelation: "territories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_territory_id_fkey"
            columns: ["territory_id"]
            isOneToOne: false
            referencedRelation: "territories_with_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
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
          can_add_catch_from_gallery: boolean
          can_add_catch_manually: boolean
          can_block_users: boolean
          can_moderate_reports: boolean
          can_view_all_users: boolean
          city: string
          coins: number
          created_at: string
          display_name: string
          equipped_frame: string | null
          equipped_name_style: string | null
          equipped_skin: string | null
          gender: string | null
          height_cm: number | null
          hero_bg: string | null
          id: string
          is_admin: boolean
          is_blocked: boolean
          is_super_admin: boolean
          location: string | null
          onboarding_completed: boolean
          public_id: string
          telegram_id: number | null
          territory_color: string | null
          tg_notifications_enabled: boolean
          tg_unreachable_at: string | null
          weight_kg: number | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          birth_date?: string | null
          can_add_catch_from_gallery?: boolean
          can_add_catch_manually?: boolean
          can_block_users?: boolean
          can_moderate_reports?: boolean
          can_view_all_users?: boolean
          city?: string
          coins?: number
          created_at?: string
          display_name?: string
          equipped_frame?: string | null
          equipped_name_style?: string | null
          equipped_skin?: string | null
          gender?: string | null
          height_cm?: number | null
          hero_bg?: string | null
          id: string
          is_admin?: boolean
          is_blocked?: boolean
          is_super_admin?: boolean
          location?: string | null
          onboarding_completed?: boolean
          public_id: string
          telegram_id?: number | null
          territory_color?: string | null
          tg_notifications_enabled?: boolean
          tg_unreachable_at?: string | null
          weight_kg?: number | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          birth_date?: string | null
          can_add_catch_from_gallery?: boolean
          can_add_catch_manually?: boolean
          can_block_users?: boolean
          can_moderate_reports?: boolean
          can_view_all_users?: boolean
          city?: string
          coins?: number
          created_at?: string
          display_name?: string
          equipped_frame?: string | null
          equipped_name_style?: string | null
          equipped_skin?: string | null
          gender?: string | null
          height_cm?: number | null
          hero_bg?: string | null
          id?: string
          is_admin?: boolean
          is_blocked?: boolean
          is_super_admin?: boolean
          location?: string | null
          onboarding_completed?: boolean
          public_id?: string
          telegram_id?: number | null
          territory_color?: string | null
          tg_notifications_enabled?: boolean
          tg_unreachable_at?: string | null
          weight_kg?: number | null
        }
        Relationships: []
      }
      buffs: {
        Row: {
          description: string
          duration_hours: number | null
          id: string
          name: string
          price: number
          sort_order: number
        }
        Insert: {
          description: string
          duration_hours?: number | null
          id: string
          name: string
          price: number
          sort_order?: number
        }
        Update: {
          description?: string
          duration_hours?: number | null
          id?: string
          name?: string
          price?: number
          sort_order?: number
        }
        Relationships: []
      }
      active_buffs: {
        Row: {
          activated_at: string
          buff_id: string
          consumed: boolean
          expires_at: string
          id: number
          user_id: string
        }
        Insert: {
          activated_at?: string
          buff_id: string
          consumed?: boolean
          expires_at: string
          id?: number
          user_id: string
        }
        Update: {
          activated_at?: string
          buff_id?: string
          consumed?: boolean
          expires_at?: string
          id?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "active_buffs_buff_id_fkey"
            columns: ["buff_id"]
            isOneToOne: false
            referencedRelation: "buffs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "active_buffs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_challenge_weeks: {
        Row: {
          extra_slot_bought: boolean
          swap_used: boolean
          user_id: string
          week_start: string
        }
        Insert: {
          extra_slot_bought?: boolean
          swap_used?: boolean
          user_id: string
          week_start: string
        }
        Update: {
          extra_slot_bought?: boolean
          swap_used?: boolean
          user_id?: string
          week_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_challenge_weeks_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      challenges: {
        Row: {
          city_scope: string | null
          coin_reward: number
          description: string
          id: string
          metric: string
          name: string
          params: Json
          sort_order: number
          target: number
          tier: string
        }
        Insert: {
          city_scope?: string | null
          coin_reward?: number
          description: string
          id: string
          metric: string
          name: string
          params?: Json
          sort_order?: number
          target?: number
          tier: string
        }
        Update: {
          city_scope?: string | null
          coin_reward?: number
          description?: string
          id?: string
          metric?: string
          name?: string
          params?: Json
          sort_order?: number
          target?: number
          tier?: string
        }
        Relationships: []
      }
      challenge_events: {
        Row: {
          catch_id: number | null
          created_at: string
          event_type: string
          id: number
          territory_id: string | null
          user_id: string
        }
        Insert: {
          catch_id?: number | null
          created_at?: string
          event_type: string
          id?: number
          territory_id?: string | null
          user_id: string
        }
        Update: {
          catch_id?: number | null
          created_at?: string
          event_type?: string
          id?: number
          territory_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_challenges: {
        Row: {
          challenge_id: string
          coin_reward: number
          completed_at: string | null
          created_at: string
          id: number
          settled: boolean
          target: number
          user_id: string
          week_start: string
        }
        Insert: {
          challenge_id: string
          coin_reward: number
          completed_at?: string | null
          created_at?: string
          id?: number
          settled?: boolean
          target: number
          user_id: string
          week_start: string
        }
        Update: {
          challenge_id?: string
          coin_reward?: number
          completed_at?: string | null
          created_at?: string
          id?: number
          settled?: boolean
          target?: number
          user_id?: string
          week_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_challenges_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "challenges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_challenges_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      shop_items: {
        Row: {
          category: string
          id: string
          name: string
          price: number
          sort_order: number
        }
        Insert: {
          category: string
          id: string
          name: string
          price: number
          sort_order?: number
        }
        Update: {
          category?: string
          id?: string
          name?: string
          price?: number
          sort_order?: number
        }
        Relationships: []
      }
      user_inventory: {
        Row: {
          item_id: string
          purchased_at: string
          user_id: string
        }
        Insert: {
          item_id: string
          purchased_at?: string
          user_id: string
        }
        Update: {
          item_id?: string
          purchased_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_inventory_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "shop_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_inventory_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_inventory_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles_with_stats"
            referencedColumns: ["id"]
          },
        ]
      }
      species: {
        Row: {
          category: string
          key: string
          name: string
          sort_order: number
        }
        Insert: {
          category: string
          key: string
          name: string
          sort_order?: number
        }
        Update: {
          category?: string
          key?: string
          name?: string
          sort_order?: number
        }
        Relationships: []
      }
      telegram_bot_starts: {
        Row: {
          chat_id: number
          followup_sent_at: string | null
          started_at: string
        }
        Insert: {
          chat_id: number
          followup_sent_at?: string | null
          started_at?: string
        }
        Update: {
          chat_id?: number
          followup_sent_at?: string | null
          started_at?: string
        }
        Relationships: []
      }
      telegram_broadcast_queue: {
        Row: {
          announcement_id: number
          chat_id: number
          id: number
          sent_at: string | null
        }
        Insert: {
          announcement_id: number
          chat_id: number
          id?: never
          sent_at?: string | null
        }
        Update: {
          announcement_id?: number
          chat_id?: number
          id?: never
          sent_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "telegram_broadcast_queue_announcement_id_fkey"
            columns: ["announcement_id"]
            isOneToOne: false
            referencedRelation: "announcements"
            referencedColumns: ["id"]
          },
        ]
      }
      telegram_link_tokens: {
        Row: {
          created_at: string
          expires_at: string
          token: string
          used_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string
          token: string
          used_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          token?: string
          used_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "telegram_link_tokens_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "telegram_link_tokens_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles_with_stats"
            referencedColumns: ["id"]
          },
        ]
      }
      telegram_outbox: {
        Row: {
          attempts: number
          chat_id: number
          created_at: string
          deliver_after: string
          id: number
          last_error: string | null
          notification_id: number
          sent_at: string | null
        }
        Insert: {
          attempts?: number
          chat_id: number
          created_at?: string
          deliver_after?: string
          id?: never
          last_error?: string | null
          notification_id: number
          sent_at?: string | null
        }
        Update: {
          attempts?: number
          chat_id?: number
          created_at?: string
          deliver_after?: string
          id?: never
          last_error?: string | null
          notification_id?: number
          sent_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "telegram_outbox_notification_id_fkey"
            columns: ["notification_id"]
            isOneToOne: false
            referencedRelation: "notifications"
            referencedColumns: ["id"]
          },
        ]
      }
      territories: {
        Row: {
          claimed_at: string | null
          corners: Json | null
          created_at: string
          id: string
          is_deleted: boolean
          kind: Database["public"]["Enums"]["territory_kind"] | null
          lat: number | null
          lng: number | null
          owner_id: string | null
          shield_until: string | null
        }
        Insert: {
          claimed_at?: string | null
          corners?: Json | null
          created_at?: string
          id: string
          is_deleted?: boolean
          kind?: Database["public"]["Enums"]["territory_kind"] | null
          lat?: number | null
          lng?: number | null
          owner_id?: string | null
          shield_until?: string | null
        }
        Update: {
          claimed_at?: string | null
          corners?: Json | null
          created_at?: string
          id?: string
          is_deleted?: boolean
          kind?: Database["public"]["Enums"]["territory_kind"] | null
          lat?: number | null
          lng?: number | null
          owner_id?: string | null
          shield_until?: string | null
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
      user_awards: {
        Row: {
          description: string
          earned_at: string
          id: number
          kind: string
          subtitle: string
          title: string
          user_id: string
        }
        Insert: {
          description: string
          earned_at?: string
          id?: never
          kind: string
          subtitle: string
          title: string
          user_id: string
        }
        Update: {
          description?: string
          earned_at?: string
          id?: never
          kind?: string
          subtitle?: string
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_awards_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_awards_user_id_fkey"
            columns: ["user_id"]
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
          can_add_catch_from_gallery: boolean | null
          can_add_catch_manually: boolean | null
          can_block_users: boolean | null
          can_moderate_reports: boolean | null
          can_view_all_users: boolean | null
          catches_count: number | null
          city: string | null
          coins: number | null
          created_at: string | null
          display_name: string | null
          equipped_frame: string | null
          equipped_name_style: string | null
          equipped_skin: string | null
          followers_count: number | null
          following_count: number | null
          gender: string | null
          height_cm: number | null
          hero_bg: string | null
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
          can_add_catch_from_gallery?: never
          can_add_catch_manually?: never
          can_block_users?: never
          can_moderate_reports?: never
          can_view_all_users?: never
          catches_count?: never
          city?: string | null
          coins?: never
          created_at?: string | null
          display_name?: string | null
          equipped_frame?: string | null
          equipped_name_style?: string | null
          equipped_skin?: string | null
          followers_count?: never
          following_count?: never
          gender?: never
          height_cm?: never
          hero_bg?: string | null
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
          can_add_catch_from_gallery?: never
          can_add_catch_manually?: never
          can_block_users?: never
          can_moderate_reports?: never
          can_view_all_users?: never
          catches_count?: never
          city?: string | null
          coins?: never
          created_at?: string | null
          display_name?: string | null
          equipped_frame?: string | null
          equipped_name_style?: string | null
          equipped_skin?: string | null
          followers_count?: never
          following_count?: never
          gender?: never
          height_cm?: never
          hero_bg?: string | null
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
          corners: Json | null
          created_at: string | null
          id: string | null
          is_deleted: boolean | null
          kind: Database["public"]["Enums"]["territory_kind"] | null
          last_catch_at: string | null
          lat: number | null
          lng: number | null
          owner_avatar_url: string | null
          owner_display_name: string | null
          owner_id: string | null
          shield_until: string | null
          owner_equipped_skin: string | null
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
      admin_add_territory: {
        Args: {
          p_corners: Json
          p_id: string
          p_kind: string
          p_lat: number
          p_lng: number
        }
        Returns: undefined
      }
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
      admin_post_announcement: {
        Args: {
          p_body: string
          p_broadcast_telegram?: boolean
          p_button_label?: string
          p_button_url?: string
          p_photo_url?: string
        }
        Returns: undefined
      }
      admin_set_admin: {
        Args: {
          p_can_add_catch_from_gallery?: boolean
          p_can_add_catch_manually?: boolean
          p_can_block_users?: boolean
          p_can_moderate_reports?: boolean
          p_can_view_all_users?: boolean
          p_is_admin: boolean
          p_user_id: string
        }
        Returns: undefined
      }
      admin_set_blocked: {
        Args: { p_blocked: boolean; p_user_id: string }
        Returns: undefined
      }
      admin_set_public_id: {
        Args: { p_public_id: string; p_user_id: string }
        Returns: undefined
      }
      admin_grant_coins: {
        Args: { p_user_id: string; p_amount: number }
        Returns: undefined
      }
      admin_get_user_inventory: {
        Args: { p_user_id: string }
        Returns: {
          kind: string
          item_id: string
          active_buff_id: number | null
          label: string
          price: number
          expires_at: string | null
        }[]
      }
      admin_refund_shop_item: {
        Args: { p_user_id: string; p_item_id: string }
        Returns: undefined
      }
      admin_refund_buff: {
        Args: { p_user_id: string; p_active_buff_id: number }
        Returns: undefined
      }
      buy_shop_item: { Args: { p_item_id: string }; Returns: undefined }
      equip_shop_item: { Args: { p_item_id: string | null; p_category?: string }; Returns: undefined }
      log_challenge_event: {
        Args: { p_catch_id?: number | null; p_event_type: string; p_territory_id?: string | null }
        Returns: undefined
      }
      sync_my_challenges: {
        Args: { p_city: string; p_timezone: string }
        Returns: {
          id: number
          challenge_id: string
          name: string
          description: string
          tier: string
          coin_reward: number
          target: number
          progress: number
          completed_at: string | null
        }[]
      }
      get_my_challenge_week_state: {
        Args: { p_timezone: string }
        Returns: { swap_used: boolean; extra_slot_bought: boolean; slot_count: number; week_ends_at: string }[]
      }
      swap_challenge: { Args: { p_user_challenge_id: number; p_city: string }; Returns: undefined }
      buy_extra_challenge: { Args: { p_city: string; p_timezone: string }; Returns: undefined }
      buy_shield: { Args: { p_territory_id: string }; Returns: undefined }
      activate_buff: { Args: { p_buff_id: string }; Returns: undefined }
      spin_wheel: {
        Args: { p_bet: number }
        Returns: { segment_index: number; multiplier: number; payout: number; new_balance: number }[]
      }
      create_telegram_link_token: { Args: Record<string, never>; Returns: string }
      mark_notifications_read: { Args: Record<string, never>; Returns: undefined }
      notification_deliver_after_from: { Args: { p_city: string; p_from: string }; Returns: string }
      my_telegram_notification_state: {
        Args: Record<string, never>
        Returns: {
          linked: boolean
          bot_started: boolean
          enabled: boolean
          unreachable: boolean
        }[]
      }
      set_telegram_notifications: { Args: { p_enabled: boolean }; Returns: undefined }
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
        Returns: { species_coins: number; capture_coins: number }[]
      }
      get_admin_permissions: {
        Args: { p_user_id: string }
        Returns: {
          can_add_catch_from_gallery: boolean
          can_add_catch_manually: boolean
          can_block_users: boolean
          can_moderate_reports: boolean
          can_view_all_users: boolean
          is_admin: boolean
        }[]
      }
      get_report_deletion_count: {
        Args: { p_user_id: string }
        Returns: number
      }
      get_weekly_leaderboard: {
        Args: {
          p_city_prefix?: string
          p_friends_only?: boolean
          p_limit?: number
          p_timezone?: string
          p_week_offset?: number
        }
        Returns: {
          avatar_url: string
          catches_this_week: number
          display_name: string
          rank: number
          sectors_this_week: number
          user_id: string
        }[]
      }
    }
    Enums: {
      territory_kind: "sea" | "river" | "stream" | "lake" | "pond"
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
      territory_kind: ["sea", "river", "stream", "lake", "pond"],
    },
  },
} as const
