-- CLAN UPDATE, part 3 of 4 — what happens when the headquarters falls, and the buildings with real perks.
-- DRAFT. Not applied and NOT yet dry-run (parts 01 and 02 were, on 06.11.2026; this one was written after the
-- owner's review of the demo and must go through a rolled-back dry-run before «применяй»). Needs 01 and 02 first.
--
--   clan_hq.defense_at        when the defence of the HQ sector last changed (the «Крепость» wears it down slower)
--   clan_hq_ruins             a fallen HQ: who took it, what was carried off, until when a new one cannot be set
--   clan_hq_place             replaced: refuses while the ruins stand
--   clan_hq_attack            replaced: the siege lasts 90 minutes + «Маяк» (owner, 08.11.2026; was 30)
--   clan_hq_tick              replaced: a siege that nobody broke -> the HQ falls: loot, the sector goes to the attacker, ruins
--   _clan_treasury_cap        replaced: «Склад» counts only while an HQ stands
--   clan_builds, clan_upgrade_project, clan_speedup_build, clan_build_tick   six buildings (dock, beacon, fort, board, storage, market) with build time, clan-level gates and a speed-up — only with an HQ standing, paid from the treasury
-- The numbers are those of web/lib/clan2/rules.ts (HQ_LOOT_SHARE 20 %, HQ_LOOT_MAX 1000, HQ_RUINS_HOURS 24, PROJECT_EFFECTS, PROJECTS costs).

alter table public.clan_hq add column defense_at timestamptz not null default now();

create table public.clan_hq_ruins (
  clan_id bigint primary key references public.clans(id) on delete cascade,
  territory_id text not null,
  by_clan_id bigint references public.clans(id) on delete set null,
  by_user uuid references public.profiles(id) on delete set null,
  loot int not null default 0,
  fell_at timestamptz not null default now(),
  until timestamptz not null
);
alter table public.clan_hq_ruins enable row level security;
create policy "ruins: all read" on public.clan_hq_ruins for select to authenticated using (true);
grant select on public.clan_hq_ruins to authenticated;

-- A building's level (0 = not built) while it works: only with an HQ standing.
create or replace function public._clan_project_level(p_clan_id bigint, p_id text)
returns int language sql stable security definer set search_path = public as $$
  select case when exists (select 1 from public.clan_hq h where h.clan_id = p_clan_id)
              then coalesce((select (t.projects->>p_id)::int from public.clan_treasury t where t.clan_id = p_clan_id), 0)
              else 0 end;
$$;

create or replace function public._clan_treasury_cap(p_clan_id bigint)
returns int language sql stable security definer set search_path = public as $$
  select (case when public._clan_level(c.xp) >= 9 then 20000 when public._clan_level(c.xp) >= 7 then 12000
               when public._clan_level(c.xp) >= 5 then 8000 when public._clan_level(c.xp) >= 3 then 5000 else 3000 end)
       + (case public._clan_project_level(p_clan_id, 'storage') when 1 then 1000 when 2 then 2500 when 3 then 5000 else 0 end)
  from public.clans c where c.id = p_clan_id;
$$;

-- A building under construction: paid at once, ready at ends_at, one per clan at a time.
create table public.clan_builds (
  clan_id bigint primary key references public.clans(id) on delete cascade,
  project text not null,
  to_level int not null check (to_level between 1 and 3),
  cost int not null,
  started_at timestamptz not null default now(),
  ends_at timestamptz not null
);
alter table public.clan_builds enable row level security;
create policy "builds: members read" on public.clan_builds for select to authenticated
  using (exists (select 1 from public.clan_members cm where cm.clan_id = clan_builds.clan_id and cm.user_id = auth.uid() and cm.left_at is null));
grant select on public.clan_builds to authenticated;

-- Numbers of web/lib/clan2/rules.ts: PROJECTS, BUILD_CLAN_LEVEL (2/4/6), BUILD_HOURS.
create or replace function public._clan_project_cost(p_id text, p_level int)
returns int language sql immutable as $$
  select (case p_id when 'storage' then array[500, 1200, 2800] when 'board' then array[400, 900, 2100] when 'beacon' then array[600, 1500, 3300]
                    when 'fort' then array[700, 1800, 3900] when 'dock' then array[900, 2100, 4500] when 'market' then array[900, 2100, 4800] end)[p_level];
$$;
create or replace function public._clan_project_hours(p_id text, p_level int)
returns int language sql immutable as $$
  select (case p_id when 'storage' then array[12, 36, 72] when 'board' then array[12, 36, 72] when 'beacon' then array[14, 42, 86]
                    when 'fort' then array[20, 58, 115] when 'dock' then array[16, 50, 100] when 'market' then array[16, 50, 100] end)[p_level];
$$;

create or replace function public.clan_upgrade_project(p_id text)
returns timestamptz language plpgsql security definer set search_path = public as $$
declare v_clan bigint; v_level int; v_cost int; v_ends timestamptz; v_clan_level int;
begin
  select clan_id into v_clan from public._my_clan_membership(auth.uid());
  perform public._clan_leader_check(v_clan);
  if not public._clan_econ_on(v_clan) then raise exception 'CLAN:treasury_off'; end if;
  if p_id not in ('dock', 'beacon', 'fort', 'board', 'storage', 'market') then raise exception 'CLAN:bad_project'; end if;
  if not exists (select 1 from public.clan_hq h where h.clan_id = v_clan) then raise exception 'CLAN:no_hq_build'; end if;
  if exists (select 1 from public.clan_builds where clan_id = v_clan) then raise exception 'CLAN:build_busy'; end if;
  insert into public.clan_treasury (clan_id) values (v_clan) on conflict do nothing;
  select coalesce((projects->>p_id)::int, 0) into v_level from public.clan_treasury where clan_id = v_clan for update;
  if v_level >= 3 then raise exception 'CLAN:max_level'; end if;
  select public._clan_level(xp) into v_clan_level from public.clans where id = v_clan;
  if v_clan_level < (array[2, 4, 6])[v_level + 1] then raise exception 'CLAN:level_low'; end if;
  v_cost := public._clan_project_cost(p_id, v_level + 1);
  perform public._clan_treasury_spend(v_clan, v_cost, 'spend_project', auth.uid(), p_id || ':' || (v_level + 1));
  v_ends := now() + make_interval(hours => public._clan_project_hours(p_id, v_level + 1));
  insert into public.clan_builds (clan_id, project, to_level, cost, ends_at) values (v_clan, p_id, v_level + 1, v_cost, v_ends);
  return v_ends;
end $$;

-- Finish a build at once: speedup_share % of the building's price, in proportion to the time left (min 20).
create or replace function public.clan_speedup_build()
returns int language plpgsql security definer set search_path = public as $$
declare v_clan bigint; b public.clan_builds; v_share int; v_price int;
begin
  select clan_id into v_clan from public._my_clan_membership(auth.uid());
  perform public._clan_leader_check(v_clan);
  select * into b from public.clan_builds where clan_id = v_clan for update;
  if b.clan_id is null then raise exception 'CLAN:build_none'; end if;
  select speedup_share into v_share from public.clan_economy where id = 1;
  v_price := greatest(20, ceil(b.cost * v_share / 100.0 * greatest(0, extract(epoch from (b.ends_at - now()))) / greatest(1, extract(epoch from (b.ends_at - b.started_at))))::int);
  perform public._clan_treasury_spend(v_clan, v_price, 'spend_project', auth.uid(), 'speedup:' || b.project || ':' || b.to_level);
  update public.clan_builds set ends_at = now() where clan_id = v_clan;
  perform public.clan_build_tick();
  return v_price;
end $$;

-- Every minute: ready builds raise the level (the dock also adds its +2 places through clans.extra_slots).
create or replace function public.clan_build_tick()
returns int language plpgsql security definer set search_path = public as $$
declare b record; n int := 0;
begin
  for b in select * from public.clan_builds where ends_at <= now() loop
    update public.clan_treasury set projects = jsonb_set(projects, array[b.project], to_jsonb(b.to_level)) where clan_id = b.clan_id;
    if b.project = 'dock' then update public.clans set extra_slots = extra_slots + 2 where id = b.clan_id; end if;
    delete from public.clan_builds where clan_id = b.clan_id;
    n := n + 1;
  end loop;
  return n;
end $$;

create or replace function public.clan_hq_place(p_territory_id text)
returns void language plpgsql security definer set search_path = public as $$
declare v_clan bigint; v_e public.clan_economy; v_cur public.clan_hq; v_cost int;
begin
  select clan_id into v_clan from public._my_clan_membership(auth.uid());
  perform public._clan_leader_check(v_clan);
  select * into v_e from public.clan_economy where id = 1;
  if not public._clan_econ_on(v_clan) then raise exception 'CLAN:treasury_off'; end if;
  if exists (select 1 from public.clan_hq_ruins r where r.clan_id = v_clan and r.until > now()) then raise exception 'CLAN:hq_ruins'; end if;
  if not exists (select 1 from public.territories t join public.clan_members cm on cm.user_id = t.owner_id and cm.clan_id = v_clan and cm.left_at is null
                 where t.id = p_territory_id and not t.is_deleted) then raise exception 'CLAN:hq_not_ours'; end if;
  if exists (select 1 from public.clan_hq h where h.territory_id = p_territory_id) then raise exception 'CLAN:hq_taken'; end if;
  select * into v_cur from public.clan_hq where clan_id = v_clan for update;
  if v_cur.clan_id is not null and coalesce(v_cur.moved_at, v_cur.placed_at) + interval '3 days' > now() then raise exception 'CLAN:hq_cooldown'; end if;
  v_cost := case when v_cur.clan_id is null then v_e.hq_place_cost else v_e.hq_move_cost end;
  perform public._clan_treasury_spend(v_clan, v_cost, 'spend_hq', auth.uid(), 'Штаб-квартира · ' || p_territory_id);
  delete from public.clan_sieges where clan_id = v_clan;
  delete from public.clan_hq_ruins where clan_id = v_clan;
  if v_cur.clan_id is null then
    insert into public.clan_hq (clan_id, territory_id) values (v_clan, p_territory_id);
  else
    update public.clan_hq set territory_id = p_territory_id, moved_at = now(), defense_at = now() where clan_id = v_clan;
  end if;
end $$;

create or replace function public.clan_hq_attack(p_territory_id text, p_attacker uuid, p_defense_left int)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_hq public.clan_hq; v_s public.clan_sieges;
begin
  select * into v_hq from public.clan_hq where territory_id = p_territory_id;
  if v_hq.clan_id is null then return false; end if;
  if exists (select 1 from public.clan_members cm where cm.clan_id = v_hq.clan_id and cm.user_id = p_attacker and cm.left_at is null) then return false; end if;
  if p_defense_left > 0 then return false; end if;
  select * into v_s from public.clan_sieges where territory_id = p_territory_id;
  if v_s.territory_id is not null then return true; end if;
  insert into public.clan_sieges (territory_id, clan_id, attacker_id, ends_at)
  values (p_territory_id, v_hq.clan_id, p_attacker,
          now() + make_interval(mins => 90 + (case public._clan_project_level(v_hq.clan_id, 'beacon') when 1 then 10 when 2 then 20 when 3 then 30 else 0 end)));
  perform public._clan_notify(cm.user_id, 'clan_hq_siege', p_attacker, v_hq.clan_id, jsonb_build_object('territory_id', p_territory_id))
    from public.clan_members cm where cm.clan_id = v_hq.clan_id and cm.left_at is null;
  return true;
end $$;

-- A siege nobody broke: the HQ falls. The attackers carry off a fifth of the treasury (at most 1500): three quarters
-- go to the attacker's clan treasury (or to the attacker himself with no clan), the rest is gone. The sector is the attacker's.
create or replace function public.clan_hq_tick()
returns int language plpgsql security definer set search_path = public as $$
declare r record; n int := 0; v_loot int; v_att_clan bigint;
begin
  for r in select s.territory_id, s.clan_id, s.attacker_id from public.clan_sieges s where s.ends_at <= now() loop
    select least(1500, floor(coalesce(t.balance, 0) * 0.2))::int into v_loot from public.clan_treasury t where t.clan_id = r.clan_id for update;
    v_loot := coalesce(v_loot, 0);
    select clan_id into v_att_clan from public._my_clan_membership(r.attacker_id);
    if v_loot > 0 then
      perform public._clan_treasury_spend(r.clan_id, v_loot, 'looted', r.attacker_id, r.territory_id);
      if v_att_clan is not null then
        perform public._clan_treasury_add(v_att_clan, floor(v_loot * 0.75)::int, 'loot', r.attacker_id, r.territory_id);
      elsif r.attacker_id is not null then
        update public.profiles set coins = coins + floor(v_loot * 0.75)::int where id = r.attacker_id;
        insert into public.coin_transactions (user_id, amount, reason, label) values (r.attacker_id, floor(v_loot * 0.75)::int, 'clan_hq_loot', 'Добыча при взятии штаба');
      end if;
    end if;
    insert into public.clan_hq_ruins (clan_id, territory_id, by_clan_id, by_user, loot, until)
    values (r.clan_id, r.territory_id, v_att_clan, r.attacker_id, v_loot, now() + interval '24 hours')
    on conflict (clan_id) do update set territory_id = excluded.territory_id, by_clan_id = excluded.by_clan_id, by_user = excluded.by_user,
      loot = excluded.loot, fell_at = now(), until = excluded.until;
    -- The sector goes to the attacker (the same fields a capture sets, with defence 1).
    if r.attacker_id is not null then
      update public.territories set owner_id = r.attacker_id, claimed_at = now(), defense = 1, defense_at = now() where id = r.territory_id;
    end if;
    delete from public.clan_hq where territory_id = r.territory_id;   -- cascades the siege row
    perform public._clan_notify(cm.user_id, 'clan_hq_fell', r.attacker_id, r.clan_id, jsonb_build_object('territory_id', r.territory_id, 'loot', v_loot))
      from public.clan_members cm where cm.clan_id = r.clan_id and cm.left_at is null;
    n := n + 1;
  end loop;
  return n;
end $$;

revoke execute on function public._clan_project_level(bigint, text), public._clan_treasury_cap(bigint), public.clan_hq_tick(), public.clan_hq_attack(text, uuid, int), public.clan_build_tick(), public._clan_project_cost(text, int), public._clan_project_hours(text, int) from public, anon, authenticated;
revoke execute on function public.clan_upgrade_project(text), public.clan_speedup_build(), public.clan_hq_place(text) from public, anon;
grant execute on function public.clan_upgrade_project(text), public.clan_speedup_build(), public.clan_hq_place(text) to authenticated;
