-- 08 · Клан и улов, расписание (08.11.2026). ЧЕРНОВИК, применять только после «применяй».
-- Зависит от 01–04 (clan_economy, clan_treasury, clan_hq, clan_sieges, clan_buffs, clan_hq_attack/defend/tick,
-- clan_build_tick, _clan_notify_many). Порядок: 01 → … → 07 → 08.
--
--   1. _clan_hq_decay_days     защита сектора штаба тает по 1 в 1/2/3/5 дней («Крепость» 0–3), у остальных по 1 в день
--   2. confirm_catch           правка по якорям (каждый ровно один раз, иначе ошибка и ничего не меняется):
--        • защита на сейчас с учётом «Крепости»;
--        • чужой улов на штабе с защитой 0 — не захват, а осада (clan_hq_attack); сектор не переходит, монеты за вид
--          платятся, за захват — нет; клиенту возвращается attacked = true;
--        • чужой улов на штабе с защитой — обычная атака, плюс всему клану «штаб атакуют» (не чаще раза в 30 минут, 04);
--        • улов хозяина или соклановца на осаждённом штабе снимает осаду (clan_hq_defend, +150 снявшему).
--      Всё это работает, только пока общак включён (clan_economy.enabled).
--   3. clan_buff_tick          «Выход», к началу которого «иду» сказали меньше buff_min_rsvp, отменяется, цена — обратно в общак
--   4. clan_rent_tick          рента раз в 3 часа (rent_per_sector_day / 8 за период), общий сектор ×shared_rent_factor,
--                              сектор штаба ×2, «Рынок» +5/10/15 %, горячий сектор ещё +2 ренты; копейки не теряются (last_rent_at двигается по периодам)
--   5. расписание              рента — каждый час в :05, осада, стройка и «Выход» — каждую минуту
-- Числа — из web/lib/clan2/rules.ts (PROJECT_EFFECTS: fort.decayDays 1/2/3/5, market.rentPct 5/10/15).

-- 1. Сколько дней тает одна единица защиты сектора.
create or replace function public._clan_hq_decay_days(p_territory_id text)
returns int language sql stable security definer set search_path = public as $$
  select coalesce((
    select case public._clan_project_level(h.clan_id, 'fort') when 1 then 2 when 2 then 3 when 3 then 5 else 1 end
    from public.clan_hq h
    where h.territory_id = p_territory_id and public._clan_econ_on(h.clan_id)
  ), 1);
$$;
revoke all on function public._clan_hq_decay_days(text) from public, anon, authenticated;

-- 2. confirm_catch: точечные вставки. CREATE OR REPLACE из pg_get_functiondef сохраняет DEFAULT у параметров.
do $migration$
declare
  v_def text := pg_get_functiondef('public.confirm_catch(text,text,text,integer,numeric,text,text,timestamptz)'::regprocedure);
  a_decl constant text := $a$  v_hot boolean := false;
begin$a$;
  a_decay constant text := $a$v_def_now := greatest(0, v_defense - floor(extract(epoch from (now() - coalesce(v_defense_at, now()))) / 86400)::int);$a$;
  a_attack constant text := $a$  v_attack := not v_late and v_prev_owner is not null and v_prev_owner <> v_uid and not v_clan_mate and v_def_now > 0;$a$;
  a_branch constant text := $a$  elsif not v_clan_mate then
    -- Захват (защита 1)$a$;
  a_log constant text := $a$  insert into public.activity_log (user_id, territory_id, kind, catch_id) values (v_uid, p_territory_id, 'catch', v_catch.id);$a$;
  a_claim constant text := $a$  if v_prev_owner is distinct from v_uid and not v_clan_mate and not v_late and not v_attack then$a$;
  a_return constant text := $a$  return query select v_species_coins, v_capture_coins, v_clan_mate, v_late, v_attack, v_def_after;$a$;
  a text;
begin
  foreach a in array array[a_decl, a_decay, a_attack, a_branch, a_log, a_claim, a_return] loop
    if (length(v_def) - length(replace(v_def, a, ''))) / length(a) <> 1 then
      raise exception 'confirm_catch: anchor not found exactly once: %', left(a, 60);
    end if;
  end loop;

  v_def := replace(v_def, a_decl, $b$  v_hot boolean := false;
  -- Клан (08): штаб клана на этом секторе, осада вместо захвата.
  v_hq_clan bigint;
  v_siege boolean := false;
begin$b$);

  v_def := replace(v_def, a_decay, $b$v_def_now := greatest(0, v_defense - floor(extract(epoch from (now() - coalesce(v_defense_at, now()))) / (86400 * public._clan_hq_decay_days(p_territory_id)))::int);$b$);

  v_def := replace(v_def, a_attack, a_attack || $b$
  -- Штаб клана (общак у клана работает): чужой улов при защите 0 начинает осаду, сектор не переходит.
  select h.clan_id into v_hq_clan from public.clan_hq h
   where h.territory_id = p_territory_id and public._clan_econ_on(h.clan_id);
  if v_hq_clan is not null and not v_late and not v_attack and v_prev_owner is not null and v_prev_owner <> v_uid and not v_clan_mate then
    v_siege := public.clan_hq_attack(p_territory_id, v_uid, v_def_now);
  end if;$b$);

  v_def := replace(v_def, a_branch, $b$  elsif v_siege then
    v_def_after := 0; -- осада штаба: сектор остаётся за кланом
$b$ || a_branch);

  v_def := replace(v_def, a_log, $b$  -- Улов хозяина или соклановца на осаждённом штабе снимает осаду; чужой улов по защите штаба — тревога всему клану.
  if v_hq_clan is not null and not v_late then
    if v_prev_owner = v_uid or v_clan_mate then
      perform public.clan_hq_defend(p_territory_id, v_uid);
    elsif v_attack then
      perform public._clan_notify_many(v_hq_clan, 'clan_hq_attacked', v_uid, jsonb_build_object('territory_id', p_territory_id, 'defense', v_def_after), 'all', null);
    end if;
  end if;
$b$ || a_log);

  v_def := replace(v_def, a_claim, $b$  if v_prev_owner is distinct from v_uid and not v_clan_mate and not v_late and not v_attack and not v_siege then$b$);

  v_def := replace(v_def, a_return, $b$  return query select v_species_coins, v_capture_coins, v_clan_mate, v_late, v_attack or v_siege, v_def_after;$b$);

  execute v_def;
end
$migration$;

-- 3. «Выход», к началу которого мало «иду»: отменяется, монеты обратно в общак.
create or replace function public.clan_buff_tick()
returns int language plpgsql security definer set search_path = public as $$
declare b record; v_min int; v_price int; n int := 0;
begin
  select buff_min_rsvp, buff_price into v_min, v_price from public.clan_economy where id = 1;
  for b in
    select cb.* from public.clan_buffs cb
     where cb.starts_at <= now() and cb.ends_at > now()
       and (select count(*) from public.clan_buff_rsvp r where r.buff_id = cb.id) < v_min
  loop
    delete from public.clan_buffs where id = b.id;
    perform public._clan_treasury_add(b.clan_id, v_price, 'refund_buff', b.created_by, 'Выход отменён: мало «иду»');
    n := n + 1;
  end loop;
  return n;
end $$;
revoke all on function public.clan_buff_tick() from public, anon, authenticated;

-- 4. Рента раз в 3 часа (заменяет версию из 02).
create or replace function public.clan_rent_tick()
returns int language plpgsql security definer set search_path = public as $$
declare v_e public.clan_economy; r record; v_periods int; v_plain int; v_shared int; v_hq int; v_hot int; v_market int; v_per numeric; v_sum int; v_paid int := 0;
begin
  select * into v_e from public.clan_economy where id = 1;
  v_per := v_e.rent_per_sector_day / 8.0;
  for r in select c.id from public.clans c where c.disbanded_at is null and public._clan_econ_on(c.id) loop
    insert into public.clan_treasury (clan_id) values (r.id) on conflict do nothing;
    select greatest(0, floor(extract(epoch from (now() - last_rent_at)) / 10800))::int into v_periods
      from public.clan_treasury where clan_id = r.id for update;
    continue when v_periods < 1;
    select count(*) filter (where not exists (select 1 from public.territory_shares s where s.territory_id = t.id)),
           count(*) filter (where exists (select 1 from public.territory_shares s where s.territory_id = t.id))
      into v_plain, v_shared
    from public.territories t
    join public.clan_members cm on cm.user_id = t.owner_id and cm.clan_id = r.id and cm.left_at is null
    where not t.is_deleted;
    select count(*) into v_hq from public.clan_hq h join public.territories t on t.id = h.territory_id
      join public.clan_members cm on cm.user_id = t.owner_id and cm.clan_id = r.id and cm.left_at is null
      where h.clan_id = r.id and not t.is_deleted;
    -- Горячий сектор участника платит ещё две ренты сверху (как в предпросмотре: rentPerDay в demoStore).
    select count(*) into v_hot from public.hot_sectors hs join public.territories t on t.id = hs.territory_id
      join public.clan_members cm on cm.user_id = t.owner_id and cm.clan_id = r.id and cm.left_at is null
      where now() >= hs.starts_at and now() < hs.ends_at and not t.is_deleted;
    v_market := case public._clan_project_level(r.id, 'market') when 1 then 5 when 2 then 10 when 3 then 15 else 0 end;
    v_sum := round(v_periods * v_per * ((v_plain + v_shared * v_e.shared_rent_factor + v_hq) * (100 + v_market) / 100.0 + v_hot * 2))::int;
    if v_sum > 0 then
      perform public._clan_treasury_add(r.id, v_sum, 'rent', null,
        v_plain || '+' || v_shared || ' сект. × ' || v_periods || ' × 3 ч' || case when v_market > 0 then ' · рынок +' || v_market || '%' else '' end);
      v_paid := v_paid + v_sum;
    end if;
    update public.clan_treasury set last_rent_at = last_rent_at + make_interval(hours => v_periods * 3) where clan_id = r.id;
  end loop;
  return v_paid;
end $$;
revoke all on function public.clan_rent_tick() from public, anon, authenticated;

-- 5. Расписание. Сами функции ничего не делают, пока общак выключен (кроме стройки и осады, которых тогда и нет).
select cron.schedule('clan-rent-tick', '5 * * * *', $$select public.clan_rent_tick()$$);
select cron.schedule('clan-minute-tick', '* * * * *', $$select public.clan_hq_tick(); select public.clan_build_tick(); select public.clan_buff_tick();$$);
