-- Нагрузка на бесплатный Supabase, блок Б, шаг 3 (13.11.2026): auth.uid() в правилах доступа — один раз на запрос.
--
-- В 33 правилах (28 таблиц) auth.uid() вызывается для каждой строки (Supabase → Advisors → Performance →
-- «Auth RLS Initialization Plan», 33 замечания). Обёрнутый в (select auth.uid()) он считается один раз на запрос.
-- Смысл правил не меняется: те же условия, те же роли и команды (ALTER POLICY меняет только выражения).
-- Тексты взяты из живой базы (pg_policies) 13.11; в прогоне проверено, что после замены выражения совпадают
-- с исходными с точностью до обёртки, а каждый из трёх реальных игроков видит в каждой таблице ровно столько же строк.
--
-- ALTER POLICY ненадолго блокирует таблицу целиком: lock_timeout, чтобы не встать в очередь за долгим запросом
-- и не задержать за собой всех игроков (тогда миграция упадёт целиком — просто повторить позже).
-- Откат: 03_rls_select_auth_uid_ROLLBACK.sql (исходные выражения).

set local lock_timeout = '3s';
set local search_path = public, extensions;

alter policy "user reads own buffs" on public.active_buffs using (((select auth.uid()) = user_id));
alter policy "super admins read admin actions" on public.admin_actions using ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = (select auth.uid())) AND profiles.is_super_admin))));
alter policy "delete own like" on public.catch_likes using (((select auth.uid()) = user_id));
alter policy "insert own like" on public.catch_likes with check (((select auth.uid()) = user_id));
alter policy "users report catches" on public.catch_reports with check ((((select auth.uid()) = reporter_id) AND _may_report()));
alter policy "user inserts own events" on public.challenge_events with check (((select auth.uid()) = user_id));
alter policy "user reads own events" on public.challenge_events using (((select auth.uid()) = user_id));
alter policy "rsvp: members read" on public.clan_buff_rsvp using ((EXISTS ( SELECT 1
   FROM (clan_buffs b
     JOIN clan_members cm ON (((cm.clan_id = b.clan_id) AND (cm.user_id = (select auth.uid())) AND (cm.left_at IS NULL))))
  WHERE (b.id = clan_buff_rsvp.buff_id))));
alter policy "buffs: members read" on public.clan_buffs using ((EXISTS ( SELECT 1
   FROM clan_members cm
  WHERE ((cm.clan_id = clan_buffs.clan_id) AND (cm.user_id = (select auth.uid())) AND (cm.left_at IS NULL)))));
alter policy "builds: members read" on public.clan_builds using ((EXISTS ( SELECT 1
   FROM clan_members cm
  WHERE ((cm.clan_id = clan_builds.clan_id) AND (cm.user_id = (select auth.uid())) AND (cm.left_at IS NULL)))));
alter policy "own clan invites readable" on public.clan_invites using (((select auth.uid()) = user_id));
alter policy "items: members read" on public.clan_items using ((EXISTS ( SELECT 1
   FROM clan_members cm
  WHERE ((cm.clan_id = clan_items.clan_id) AND (cm.user_id = (select auth.uid())) AND (cm.left_at IS NULL)))));
alter policy "own join requests readable" on public.clan_join_requests using (((select auth.uid()) = user_id));
alter policy "clan members read chat" on public.clan_messages using ((EXISTS ( SELECT 1
   FROM clan_members m
  WHERE ((m.clan_id = clan_messages.clan_id) AND (m.user_id = (select auth.uid())) AND (m.left_at IS NULL)))));
alter policy "quests: members read" on public.clan_quests using ((EXISTS ( SELECT 1
   FROM clan_members cm
  WHERE ((cm.clan_id = clan_quests.clan_id) AND (cm.user_id = (select auth.uid())) AND (cm.left_at IS NULL)))));
alter policy "treasury: members read" on public.clan_treasury using ((EXISTS ( SELECT 1
   FROM clan_members cm
  WHERE ((cm.clan_id = clan_treasury.clan_id) AND (cm.user_id = (select auth.uid())) AND (cm.left_at IS NULL)))));
alter policy "treasury log: members read" on public.clan_treasury_log using ((EXISTS ( SELECT 1
   FROM clan_members cm
  WHERE ((cm.clan_id = clan_treasury_log.clan_id) AND (cm.user_id = (select auth.uid())) AND (cm.left_at IS NULL)))));
alter policy "own coin transactions" on public.coin_transactions using (((select auth.uid()) = user_id));
alter policy fishing_sessions_own_select on public.fishing_sessions using ((user_id = (select auth.uid())));
alter policy "users create own follows" on public.follows with check (((select auth.uid()) = follower_id));
alter policy "users delete own follows" on public.follows using (((select auth.uid()) = follower_id));
alter policy "read own notifications" on public.notifications using (((select auth.uid()) = user_id));
alter policy "users update own profile" on public.profiles using (((select auth.uid()) = id));
alter policy support_messages_own_select on public.support_messages using ((EXISTS ( SELECT 1
   FROM support_tickets t
  WHERE ((t.id = support_messages.ticket_id) AND (t.user_id = (select auth.uid()))))));
alter policy support_replies_own_select on public.support_replies using ((EXISTS ( SELECT 1
   FROM support_tickets t
  WHERE ((t.id = support_replies.ticket_id) AND (t.user_id = (select auth.uid()))))));
alter policy support_tickets_own_select on public.support_tickets using ((user_id = (select auth.uid())));
alter policy "own achievements" on public.user_achievements using (((select auth.uid()) = user_id));
alter policy "user reads own challenge week" on public.user_challenge_weeks using (((select auth.uid()) = user_id));
alter policy "user reads own challenges" on public.user_challenges using (((select auth.uid()) = user_id));
alter policy "read own inventory" on public.user_inventory using (((select auth.uid()) = user_id));
alter policy "own ui state: add" on public.user_ui_state with check ((user_id = (select auth.uid())));
alter policy "own ui state: change" on public.user_ui_state using ((user_id = (select auth.uid()))) with check ((user_id = (select auth.uid())));
alter policy "own ui state: read" on public.user_ui_state using ((user_id = (select auth.uid())));
