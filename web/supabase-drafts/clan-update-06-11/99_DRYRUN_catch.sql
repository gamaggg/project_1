-- Только улов: шаги 1 и 4–7 сквозной проверки (собирается с 01–04 и 08).
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

  raise exception 'DRYRUN RESULT: %', out;
end $dry$;
