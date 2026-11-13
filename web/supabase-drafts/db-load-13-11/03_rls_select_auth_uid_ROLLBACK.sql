-- Откат 03_rls_select_auth_uid.sql: исходные выражения 33 правил (из pg_policies живой базы, 13.11.2026).
set local lock_timeout = '3s';
set local search_path = public, extensions;

alter policy "user reads own buffs" on public.active_buffs using ((auth.uid() = user_id));
alter policy "super admins read admin actions" on public.admin_actions using ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND profiles.is_super_admin))));
alter policy "delete own like" on public.catch_likes using ((auth.uid() = user_id));
alter policy "insert own like" on public.catch_likes with check ((auth.uid() = user_id));
alter policy "users report catches" on public.catch_reports with check (((auth.uid() = reporter_id) AND _may_report()));
alter policy "user inserts own events" on public.challenge_events with check ((auth.uid() = user_id));
alter policy "user reads own events" on public.challenge_events using ((auth.uid() = user_id));
alter policy "rsvp: members read" on public.clan_buff_rsvp using ((EXISTS ( SELECT 1
   FROM (clan_buffs b
     JOIN clan_members cm ON (((cm.clan_id = b.clan_id) AND (cm.user_id = auth.uid()) AND (cm.left_at IS NULL))))
  WHERE (b.id = clan_buff_rsvp.buff_id))));
alter policy "buffs: members read" on public.clan_buffs using ((EXISTS ( SELECT 1
   FROM clan_members cm
  WHERE ((cm.clan_id = clan_buffs.clan_id) AND (cm.user_id = auth.uid()) AND (cm.left_at IS NULL)))));
alter policy "builds: members read" on public.clan_builds using ((EXISTS ( SELECT 1
   FROM clan_members cm
  WHERE ((cm.clan_id = clan_builds.clan_id) AND (cm.user_id = auth.uid()) AND (cm.left_at IS NULL)))));
alter policy "own clan invites readable" on public.clan_invites using ((auth.uid() = user_id));
alter policy "items: members read" on public.clan_items using ((EXISTS ( SELECT 1
   FROM clan_members cm
  WHERE ((cm.clan_id = clan_items.clan_id) AND (cm.user_id = auth.uid()) AND (cm.left_at IS NULL)))));
alter policy "own join requests readable" on public.clan_join_requests using ((auth.uid() = user_id));
alter policy "clan members read chat" on public.clan_messages using ((EXISTS ( SELECT 1
   FROM clan_members m
  WHERE ((m.clan_id = clan_messages.clan_id) AND (m.user_id = auth.uid()) AND (m.left_at IS NULL)))));
alter policy "quests: members read" on public.clan_quests using ((EXISTS ( SELECT 1
   FROM clan_members cm
  WHERE ((cm.clan_id = clan_quests.clan_id) AND (cm.user_id = auth.uid()) AND (cm.left_at IS NULL)))));
alter policy "treasury: members read" on public.clan_treasury using ((EXISTS ( SELECT 1
   FROM clan_members cm
  WHERE ((cm.clan_id = clan_treasury.clan_id) AND (cm.user_id = auth.uid()) AND (cm.left_at IS NULL)))));
alter policy "treasury log: members read" on public.clan_treasury_log using ((EXISTS ( SELECT 1
   FROM clan_members cm
  WHERE ((cm.clan_id = clan_treasury_log.clan_id) AND (cm.user_id = auth.uid()) AND (cm.left_at IS NULL)))));
alter policy "own coin transactions" on public.coin_transactions using ((auth.uid() = user_id));
alter policy fishing_sessions_own_select on public.fishing_sessions using ((user_id = auth.uid()));
alter policy "users create own follows" on public.follows with check ((auth.uid() = follower_id));
alter policy "users delete own follows" on public.follows using ((auth.uid() = follower_id));
alter policy "read own notifications" on public.notifications using ((auth.uid() = user_id));
alter policy "users update own profile" on public.profiles using ((auth.uid() = id));
alter policy support_messages_own_select on public.support_messages using ((EXISTS ( SELECT 1
   FROM support_tickets t
  WHERE ((t.id = support_messages.ticket_id) AND (t.user_id = auth.uid())))));
alter policy support_replies_own_select on public.support_replies using ((EXISTS ( SELECT 1
   FROM support_tickets t
  WHERE ((t.id = support_replies.ticket_id) AND (t.user_id = auth.uid())))));
alter policy support_tickets_own_select on public.support_tickets using ((user_id = auth.uid()));
alter policy "own achievements" on public.user_achievements using ((auth.uid() = user_id));
alter policy "user reads own challenge week" on public.user_challenge_weeks using ((auth.uid() = user_id));
alter policy "user reads own challenges" on public.user_challenges using ((auth.uid() = user_id));
alter policy "read own inventory" on public.user_inventory using ((auth.uid() = user_id));
alter policy "own ui state: add" on public.user_ui_state with check ((user_id = auth.uid()));
alter policy "own ui state: change" on public.user_ui_state using ((user_id = auth.uid())) with check ((user_id = auth.uid()));
alter policy "own ui state: read" on public.user_ui_state using ((user_id = auth.uid()));
