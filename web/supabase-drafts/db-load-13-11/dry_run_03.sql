-- Прогон 03_rls_select_auth_uid.sql и его отката в одной транзакции, которая всегда откатывается (13.11.2026).
-- От имени трёх реальных игроков (суперадмин, участник клана с общаком и чатом, игрок с обращениями в поддержку)
-- считает видимые строки в 28 таблицах до замены и после; сверяет тексты правил после замены (та же формула с
-- обёрткой) и после отката (ровно исходные). Ответ — в тексте ошибки «ПРОГОН 03 …».
do $dry$
declare
  users uuid[] := array['eb34bf9e-090f-4942-a7e7-85db5cd43048', 'a44d3028-7f05-418e-82b8-84da341bd7ed', '77c8ade9-7df4-4f81-a32c-61153d9a859e']::uuid[];
  tabs text[] := array['active_buffs','admin_actions','catch_likes','catch_reports','challenge_events','clan_buff_rsvp','clan_buffs','clan_builds','clan_invites','clan_items','clan_join_requests','clan_messages','clan_quests','clan_treasury','clan_treasury_log','coin_transactions','fishing_sessions','follows','notifications','profiles','support_messages','support_replies','support_tickets','user_achievements','user_challenge_weeks','user_challenges','user_inventory','user_ui_state'];
  u uuid; t text; n bigint;
  orig jsonb; before jsonb := '{}'; after jsonb := '{}';
  t_lock timestamptz; locked_sec numeric;
  bad_fwd text; bad_back text; bare_left int; diff text; nonzero int;
begin
  set local lock_timeout = '500ms';
  set local search_path = public, extensions;
  select jsonb_object_agg(tablename || ' / ' || policyname, jsonb_build_array(qual, with_check)) into orig
  from pg_policies where schemaname = 'public'
    and (coalesce(qual, '') || ' ' || coalesce(with_check, '')) ~ '(?<!SELECT )auth\.uid\(\)';

  foreach u in array users loop
    perform set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true);
    set local role authenticated;
    foreach t in array tabs loop
      execute format('select count(*) from public.%I', t) into n;
      before := before || jsonb_build_object(u || ' ' || t, n);
    end loop;
    reset role;
  end loop;

  t_lock := clock_timestamp();
  -- ===== 03_rls_select_auth_uid.sql =====
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
  -- ===== проверки после замены =====
  select count(*) into bare_left from pg_policies where schemaname = 'public'
    and (coalesce(qual, '') || ' ' || coalesce(with_check, '')) ~ '(?<!SELECT )auth\.uid\(\)';
  select string_agg(k, '; ') into bad_fwd from jsonb_each(orig) o(k, v)
  join pg_policies p on p.tablename || ' / ' || p.policyname = o.k and p.schemaname = 'public'
  where p.qual is distinct from regexp_replace(o.v->>0, '(?<!SELECT )auth\.uid\(\)', '( SELECT auth.uid() AS uid)', 'g')
     or p.with_check is distinct from regexp_replace(o.v->>1, '(?<!SELECT )auth\.uid\(\)', '( SELECT auth.uid() AS uid)', 'g');

  foreach u in array users loop
    perform set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true);
    set local role authenticated;
    foreach t in array tabs loop
      execute format('select count(*) from public.%I', t) into n;
      after := after || jsonb_build_object(u || ' ' || t, n);
    end loop;
    reset role;
  end loop;

  -- ===== 03_rls_select_auth_uid_ROLLBACK.sql =====
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
  locked_sec := round(extract(epoch from clock_timestamp() - t_lock)::numeric, 3);
  select string_agg(k, '; ') into bad_back from jsonb_each(orig) o(k, v)
  left join pg_policies p on p.tablename || ' / ' || p.policyname = o.k and p.schemaname = 'public'
  where p.policyname is null or p.qual is distinct from (o.v->>0) or p.with_check is distinct from (o.v->>1);

  select string_agg(b.key || ' ' || b.value || '→' || coalesce(a.value::text, '?'), '; ') into diff
  from jsonb_each(before) b left join jsonb_each(after) a on a.key = b.key where a.value is distinct from b.value;
  select count(*) into nonzero from jsonb_each(before) b where (b.value)::bigint > 0;

  raise exception 'ПРОГОН 03 (всё откатано): %', json_build_object(
    'policies', (select count(*) from jsonb_object_keys(orig)),
    'bare_auth_uid_left_after_03', bare_left,
    'mismatch_after_03', coalesce(bad_fwd, 'нет'),
    'mismatch_after_rollback', coalesce(bad_back, 'нет'),
    'counts_checked', (select count(*) from jsonb_object_keys(before)),
    'counts_nonzero', nonzero,
    'counts_differ', coalesce(diff, 'нет'),
    'tables_locked_sec', locked_sec);
end
$dry$;
