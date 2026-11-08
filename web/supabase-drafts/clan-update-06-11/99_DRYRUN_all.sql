-- Сквозная проверка 01–10 (08.11.2026): запускается ПОСЛЕ текста 01…10 в той же транзакции и кончается raise exception,
-- поэтому всё откатывается. Собирается скриптом в один запрос (см. README, «Прогон»). Каждый шаг в своём блоке:
-- ошибка шага пишется в отчёт и не мешает остальным.
do $dry$
declare
  out text := '';
  v_clan bigint;
  v_city text;
  v_lead uuid;
  v_mem uuid;
  v_out uuid;
  v_sec text;
  v_owner uuid;
  v_n int;
  v_j jsonb;
  v_r record;
  v_bal int;

begin
  -- Клан с главой, ещё одним участником в том же городе и сектором главы.
  select c.id, c.city into v_clan, v_city from public.clans c
   where c.disbanded_at is null
     and exists (select 1 from public.clan_members cm where cm.clan_id = c.id and cm.role = 'leader' and cm.left_at is null)
     and (select count(*) from public.clan_members cm where cm.clan_id = c.id and cm.left_at is null) >= 3
     and exists (select 1 from public.territories t join public.clan_members cm on cm.user_id = t.owner_id and cm.clan_id = c.id and cm.left_at is null and cm.role = 'leader' where not t.is_deleted)
   order by c.id limit 1;
  select user_id into v_lead from public.clan_members where clan_id = v_clan and role = 'leader' and left_at is null;
  select user_id into v_mem from public.clan_members where clan_id = v_clan and role <> 'leader' and left_at is null and city = v_city order by joined_at limit 1;
  select t.id into v_sec from public.territories t where t.owner_id = v_lead and not t.is_deleted order by t.id limit 1;
  select p.id into v_out from public.profiles p
   where not exists (select 1 from public.clan_members cm where cm.user_id = p.id and cm.left_at is null)
     and not coalesce(p.is_blocked, false) and not coalesce(p.is_admin, false) and not coalesce(p.is_super_admin, false)
     and (p.frozen_until is null or p.frozen_until < now())
   order by p.id limit 1;
  out := 'clan=' || v_clan || ' city=' || v_city || ' sector=' || v_sec;

  -- Скрытый запуск: общак выключен для всех, работает только у пробного клана.
  update public.clan_economy set enabled = false, pilot_clans = array[v_clan] where id = 1;
  update public.clans set xp = 3200 where id = v_clan;               -- уровень 10: всё открыто
  update public.territories set shield_until = null where id = v_sec;
  -- Чистые кулдауны уловов для участников проверки.
  update public.catches set caught_at = caught_at - interval '1 day' where user_id in (v_lead, v_mem, v_out) and caught_at > now() - interval '1 day';

  perform set_config('request.jwt.claims', json_build_object('sub', v_lead, 'role', 'authenticated')::text, true);

  begin
    perform public._clan_treasury_add(v_clan, 20000, 'rent', null, 'dry-run');
    perform public.clan_set_tax(10);
    perform public.clan_hq_place(v_sec);
    select balance into v_bal from public.clan_treasury where clan_id = v_clan;
    out := out || E'\n1 hq placed, treasury=' || v_bal;
  exception when others then out := out || E'\n1 hq ERR ' || sqlerrm; end;

  begin
    perform public.clan_shop_buy('boat_coral');
    perform public.clan_set_goal('frame_gold');
    begin perform public.clan_set_goal('boat_coral'); out := out || E'\n2 goal owned ALLOWED(bad)'; exception when others then out := out || E'\n2 goal owned refused: ' || sqlerrm; end;
    select to_jsonb(e) into v_j from public.clan_equipped e where e.clan_id = v_clan;
    out := out || E'\n2 shop: equipped boat=' || coalesce(v_j->>'boat', '-') || ' items=' || (select count(*) from public.clan_items where clan_id = v_clan)
               || ' notif item_bought=' || (select count(*) from public.notifications where kind = 'clan_item_bought' and (payload->>'clan_id')::bigint = v_clan);
  exception when others then out := out || E'\n2 shop ERR ' || sqlerrm; end;

  begin
    perform public.clan_upgrade_project('fort');
    perform public.clan_speedup_build();
    select projects into v_j from public.clan_treasury where clan_id = v_clan;
    out := out || E'\n3 build: fort=' || coalesce(v_j->>'fort', '0') || ' build row left=' || (select count(*) from public.clan_builds where clan_id = v_clan)
               || ' notif project_done=' || (select count(*) from public.notifications where kind = 'clan_project_done' and (payload->>'clan_id')::bigint = v_clan)
               || ' log built=' || (select count(*) from public.clan_treasury_log where clan_id = v_clan and kind = 'built')
               || ' decay days=' || public._clan_hq_decay_days(v_sec);
  exception when others then out := out || E'\n3 build ERR ' || sqlerrm; end;

  -- Чужой улов по защите 1: атака, сектор остаётся, тревога клану.
  begin
    update public.territories set defense = 1, defense_at = now() where id = v_sec;
    perform set_config('request.jwt.claims', json_build_object('sub', v_out, 'role', 'authenticated')::text, true);
    select * into v_r from public.confirm_catch(v_sec, 'stavrida', 'https://yhgdcdkfkerzuhnzjzrz.supabase.co/storage/v1/object/public/catch-photos/' || auth.uid()::text || '/dry-run.jpg');
    select owner_id into v_owner from public.territories where id = v_sec;
    out := out || E'\n4 attack: attacked=' || v_r.attacked || ' defense=' || v_r.defense || ' owner kept=' || (v_owner = v_lead)
               || ' notif hq_attacked=' || (select count(*) from public.notifications where kind = 'clan_hq_attacked' and (payload->>'clan_id')::bigint = v_clan);
  exception when others then out := out || E'\n4 attack ERR ' || sqlerrm; end;

  -- Второй чужой улов при защите 0: осада, сектор остаётся.
  begin
    update public.catches set caught_at = caught_at - interval '10 minutes' where user_id = v_out and caught_at > now() - interval '1 hour';
    select * into v_r from public.confirm_catch(v_sec, 'stavrida', 'https://yhgdcdkfkerzuhnzjzrz.supabase.co/storage/v1/object/public/catch-photos/' || auth.uid()::text || '/dry-run.jpg');
    select owner_id into v_owner from public.territories where id = v_sec;
    out := out || E'\n5 siege: attacked=' || v_r.attacked || ' capture_coins=' || v_r.capture_coins || ' owner kept=' || (v_owner = v_lead)
               || ' siege rows=' || (select count(*) from public.clan_sieges where territory_id = v_sec)
               || ' notif siege=' || (select count(*) from public.notifications where kind = 'clan_hq_siege' and (payload->>'clan_id')::bigint = v_clan);
  exception when others then out := out || E'\n5 siege ERR ' || sqlerrm; end;

  -- Улов соклановца снимает осаду.
  begin
    perform set_config('request.jwt.claims', json_build_object('sub', v_mem, 'role', 'authenticated')::text, true);
    select * into v_r from public.confirm_catch(v_sec, 'stavrida', 'https://yhgdcdkfkerzuhnzjzrz.supabase.co/storage/v1/object/public/catch-photos/' || auth.uid()::text || '/dry-run.jpg');
    out := out || E'\n6 defend: clan_support=' || v_r.clan_support || ' siege rows=' || (select count(*) from public.clan_sieges where territory_id = v_sec)
               || ' reward tx=' || (select count(*) from public.coin_transactions where user_id = v_mem and reason = 'clan_siege_break' and created_at > now() - interval '1 minute')
               || ' tax tx=' || (select count(*) from public.coin_transactions where user_id = v_mem and reason = 'clan_tax' and created_at > now() - interval '1 minute');
  exception when others then out := out || E'\n6 defend ERR ' || sqlerrm; end;

  -- Снова осада, никто не снял: штаб падает.
  begin
    update public.territories set defense = 0, defense_at = now() where id = v_sec;
    perform set_config('request.jwt.claims', json_build_object('sub', v_out, 'role', 'authenticated')::text, true);
    update public.catches set caught_at = caught_at - interval '10 minutes' where user_id = v_out and caught_at > now() - interval '1 hour';
    select * into v_r from public.confirm_catch(v_sec, 'stavrida', 'https://yhgdcdkfkerzuhnzjzrz.supabase.co/storage/v1/object/public/catch-photos/' || auth.uid()::text || '/dry-run.jpg');
    update public.clan_sieges set ends_at = now() - interval '1 second' where territory_id = v_sec;
    v_n := public.clan_hq_tick();
    select owner_id into v_owner from public.territories where id = v_sec;
    out := out || E'\n7 fall: ticked=' || v_n || ' hq left=' || (select count(*) from public.clan_hq where clan_id = v_clan)
               || ' ruins=' || (select count(*) from public.clan_hq_ruins where clan_id = v_clan) || ' owner now outsider=' || (v_owner = v_out)
               || ' loot=' || coalesce((select loot from public.clan_hq_ruins where clan_id = v_clan), -1)
               || ' notif fell=' || (select count(*) from public.notifications where kind = 'clan_hq_fell' and (payload->>'clan_id')::bigint = v_clan);
  exception when others then out := out || E'\n7 fall ERR ' || sqlerrm; end;

  begin
    update public.clan_treasury set last_rent_at = now() - interval '7 hours' where clan_id = v_clan;
    select balance into v_bal from public.clan_treasury where clan_id = v_clan;
    v_n := public.clan_rent_tick();
    out := out || E'\n8 rent: paid all clans=' || v_n || ' other clans with treasury rows=' || (select count(*) from public.clan_treasury where clan_id <> v_clan) || ' this clan +' || ((select balance from public.clan_treasury where clan_id = v_clan) - v_bal)
               || ' label=' || coalesce((select label from public.clan_treasury_log where clan_id = v_clan and kind = 'rent' order by id desc limit 1), '-');
  exception when others then out := out || E'\n8 rent ERR ' || sqlerrm; end;

  begin
    perform set_config('request.jwt.claims', json_build_object('sub', v_lead, 'role', 'authenticated')::text, true);
    perform public.clan_buff_launch(5);
    update public.clan_buffs set starts_at = now() - interval '1 minute' where clan_id = v_clan;
    select balance into v_bal from public.clan_treasury where clan_id = v_clan;
    v_n := public.clan_buff_tick();
    out := out || E'\n9 buff: cancelled=' || v_n || ' refunded +' || ((select balance from public.clan_treasury where clan_id = v_clan) - v_bal);
  exception when others then out := out || E'\n9 buff ERR ' || sqlerrm; end;

  begin
    v_j := public.get_clan_state(v_clan);
    out := out || E'\n10 state: quest=' || coalesce(v_j->'quest'->>'kind', '-') || ' ' || coalesce(v_j->'quest'->>'progress', '-') || '/' || coalesce(v_j->'quest'->>'target', '-')
               || ' items=' || (v_j->'items')::text || ' equipped=' || coalesce((v_j->'equipped')::text, '-') || ' ruins=' || (jsonb_typeof(v_j->'ruins') = 'object')
               || ' log=' || jsonb_array_length(v_j->'log');
    update public.clan_quests set kind = 'catches', target = 1 where clan_id = v_clan;
    v_n := public.clan_quest_claim();
    out := out || E'\n10 quest claim reward=' || v_n || ' notif quest_done=' || (select count(*) from public.notifications where kind = 'clan_quest_done' and (payload->>'clan_id')::bigint = v_clan);
  exception when others then out := out || E'\n10 state/quest ERR ' || sqlerrm; end;

  begin
    perform public.clan_nudge(v_mem);
    begin perform public.clan_nudge(v_mem); out := out || E'\n11 nudge twice ALLOWED(bad)'; exception when others then out := out || E'\n11 nudge: once, second refused: ' || sqlerrm; end;
  exception when others then out := out || E'\n11 nudge ERR ' || sqlerrm; end;

  begin
    v_n := public.clan_week_digest_tick();
    out := out || E'\n12 digest rows=' || v_n || ' sample=' || coalesce((select left(payload::text, 160) from public.notifications where kind = 'clan_week_digest' and (payload->>'clan_id')::bigint = v_clan limit 1), '-');
  exception when others then out := out || E'\n12 digest ERR ' || sqlerrm; end;

  begin
    out := out || E'\n13 bases: ' || coalesce((select count(*) from public.get_clan_bases(v_city))::text, '-')
               || ' settle patched=' || (position('v_chest_pool' in pg_get_functiondef('public._settle_clan_week_at(text,timestamptz)'::regprocedure)) > 0)
               || ' telegram kinds=' || (position('clan_nudge' in pg_get_functiondef('public.queue_telegram_notification()'::regprocedure)) > 0);
    v_n := public.clan_leader_away_tick();
    out := out || ' leader_away moved=' || v_n;
  exception when others then out := out || E'\n13 misc ERR ' || sqlerrm; end;

  begin
    perform public.admin_clan_reverse_entry((select id from public.clan_treasury_log where clan_id = v_clan and amount > 0 order by id desc limit 1));
    out := out || E'\n14 reverse ok (non-admin should fail? ran as leader)';
  exception when others then out := out || E'\n14 reverse as leader refused: ' || sqlerrm; end;

  begin
    perform set_config('request.jwt.claims', '', true);
    v_j := public.retire_personal_treasury();
    out := out || E'\n15 retire: ' || v_j::text;
    perform set_config('request.jwt.claims', json_build_object('sub', v_lead, 'role', 'authenticated')::text, true);
    begin perform public.collect_treasury(); out := out || ' collect ALLOWED(bad)'; exception when others then out := out || ' collect: ' || sqlerrm; end;
    begin perform public.activate_buff('double_coins'); out := out || ' double ALLOWED(bad)'; exception when others then out := out || ' double: ' || sqlerrm; end;
  exception when others then out := out || E'\n15 retire ERR ' || sqlerrm; end;

  -- 16. Новичок без уловов вступил: главе и заместителям «новичок вступил»; осада снята — «Осада снята» всем (шаг 6).
  begin
    perform set_config('request.jwt.claims', json_build_object('sub', v_lead, 'role', 'authenticated')::text, true);
    insert into public.clan_members (clan_id, user_id, role, joined_at, city)
    select v_clan, p.id, 'member', now(), v_city from public.profiles p
     where not exists (select 1 from public.catches c where c.user_id = p.id)
       and not exists (select 1 from public.clan_members cm where cm.user_id = p.id and cm.left_at is null)
     order by p.id limit 1;
    out := out || E'\n16 recruit joined notif=' || (select count(*) from public.notifications where kind = 'clan_recruit_joined' and (payload->>'clan_id')::bigint = v_clan)
               || ' hq_saved notif=' || (select count(*) from public.notifications where kind = 'clan_hq_saved' and (payload->>'clan_id')::bigint = v_clan)
               || ' pilot on=' || public._clan_econ_on(v_clan) || ' other clan on=' || public._clan_econ_on((select id from public.clans where id <> v_clan order by id limit 1));
  exception when others then out := out || E'\n16 recruit ERR ' || sqlerrm; end;

  raise exception 'DRYRUN RESULT: %', out;
end $dry$;
