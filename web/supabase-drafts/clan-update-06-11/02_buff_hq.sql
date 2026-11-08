-- CLAN UPDATE, part 2 of 3 — the clan buff «Выход», the headquarters and the siege.
-- DRAFT. Not applied. Needs part 1 (01_treasury.sql) applied first. See README.md for the dry-run.
--
--   clan_buffs / clan_buff_rsvp   the planned 2-hour window and who said «иду»
--   clan_hq                       one row per clan; UNIQUE(territory_id) is the rule «one headquarters per sector»
--   clan_sieges                   an open siege: the attacker took the last defence of an HQ sector
--   RPCs                          clan_buff_launch, clan_buff_rsvp, clan_hq_place, clan_hq_attack (called from confirm_catch), clan_hq_tick
--   clan_buff_bonus trigger       during the window a «иду» member's catch pays one more species price (funded by the game)
--   clan_rent_tick                replaced: the HQ sector pays double rent

create or replace function public._clan_treasury_spend(p_clan_id bigint, p_amount int, p_kind text, p_user uuid, p_label text)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.clan_treasury set balance = balance - p_amount where clan_id = p_clan_id and balance >= p_amount;
  if not found then raise exception 'CLAN:no_funds'; end if;
  insert into public.clan_treasury_log (clan_id, kind, amount, user_id, label) values (p_clan_id, p_kind, -p_amount, p_user, p_label);
end $$;

-- ───────────── the buff ─────────────

create table public.clan_buffs (
  id bigint generated always as identity primary key,
  clan_id bigint not null references public.clans(id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);
create index clan_buffs_clan_idx on public.clan_buffs (clan_id, starts_at desc);
create table public.clan_buff_rsvp (
  buff_id bigint not null references public.clan_buffs(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (buff_id, user_id)
);

create table public.clan_hq (
  clan_id bigint primary key references public.clans(id) on delete cascade,
  territory_id text not null unique references public.territories(id),
  placed_at timestamptz not null default now(),
  moved_at timestamptz
);
create table public.clan_sieges (
  territory_id text primary key references public.clan_hq(territory_id) on delete cascade,
  clan_id bigint not null references public.clans(id) on delete cascade,
  attacker_id uuid references public.profiles(id) on delete set null,
  started_at timestamptz not null default now(),
  ends_at timestamptz not null
);

alter table public.clan_buffs enable row level security;
alter table public.clan_buff_rsvp enable row level security;
alter table public.clan_hq enable row level security;
alter table public.clan_sieges enable row level security;
create policy "buffs: members read" on public.clan_buffs for select to authenticated
  using (exists (select 1 from public.clan_members cm where cm.clan_id = clan_buffs.clan_id and cm.user_id = auth.uid() and cm.left_at is null));
create policy "rsvp: members read" on public.clan_buff_rsvp for select to authenticated
  using (exists (select 1 from public.clan_buffs b join public.clan_members cm on cm.clan_id = b.clan_id and cm.user_id = auth.uid() and cm.left_at is null where b.id = clan_buff_rsvp.buff_id));
-- A headquarters is on the public map (every player sees which clan's it is); sieges too (the map shows the ring).
create policy "hq: all read" on public.clan_hq for select to authenticated using (true);
create policy "sieges: all read" on public.clan_sieges for select to authenticated using (true);
grant select on public.clan_buffs, public.clan_buff_rsvp, public.clan_hq, public.clan_sieges to authenticated;

-- A leader / co-leader launches the buff: it starts in 5…180 minutes, lasts 2 hours, costs buff_price from the treasury.
create or replace function public.clan_buff_launch(p_start_in_minutes int)
returns bigint language plpgsql security definer set search_path = public as $$
declare v_clan bigint; v_e public.clan_economy; v_id bigint; v_last timestamptz;
begin
  select clan_id into v_clan from public._my_clan_membership(auth.uid());
  perform public._clan_leader_check(v_clan);
  select * into v_e from public.clan_economy where id = 1;
  if not public._clan_econ_on(v_clan) then raise exception 'CLAN:treasury_off'; end if;
  if p_start_in_minutes is null or p_start_in_minutes not between 5 and 180 then raise exception 'CLAN:bad_start'; end if;
  if exists (select 1 from public.clan_buffs where clan_id = v_clan and ends_at > now()) then raise exception 'CLAN:buff_busy'; end if;
  select max(ends_at) into v_last from public.clan_buffs where clan_id = v_clan;
  if v_last is not null and v_last + make_interval(hours => v_e.buff_cooldown_hours) > now() then raise exception 'CLAN:buff_cooldown'; end if;
  perform public._clan_treasury_spend(v_clan, v_e.buff_price, 'spend_buff', auth.uid(), 'Баф «Выход»');
  insert into public.clan_buffs (clan_id, starts_at, ends_at, created_by)
  values (v_clan, now() + make_interval(mins => p_start_in_minutes), now() + make_interval(mins => p_start_in_minutes + 120), auth.uid())
  returning id into v_id;
  insert into public.clan_buff_rsvp (buff_id, user_id) values (v_id, auth.uid());
  -- Everybody in the clan hears about it.
  perform public._clan_notify(cm.user_id, 'clan_buff_planned', auth.uid(), v_clan, jsonb_build_object('starts_at', now() + make_interval(mins => p_start_in_minutes)))
    from public.clan_members cm where cm.clan_id = v_clan and cm.left_at is null and cm.user_id <> auth.uid();
  return v_id;
end $$;

create or replace function public.clan_buff_rsvp(p_buff_id bigint, p_going boolean)
returns void language plpgsql security definer set search_path = public as $$
declare v_clan bigint;
begin
  select b.clan_id into v_clan from public.clan_buffs b where b.id = p_buff_id and b.ends_at > now();
  if v_clan is null then raise exception 'CLAN:buff_gone'; end if;
  if not exists (select 1 from public.clan_members cm where cm.clan_id = v_clan and cm.user_id = auth.uid() and cm.left_at is null) then raise exception 'CLAN:not_member'; end if;
  if p_going then
    insert into public.clan_buff_rsvp (buff_id, user_id) values (p_buff_id, auth.uid()) on conflict do nothing;
  else
    delete from public.clan_buff_rsvp where buff_id = p_buff_id and user_id = auth.uid();
  end if;
end $$;

-- During the window, a catch of a member who said «иду» pays one more species price. The buff counts only
-- when at least buff_min_rsvp members said «иду» (a buff for one person would be a personal «двойные монеты» again).
create or replace function public._clan_buff_bonus()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_m public.clan_members; v_b public.clan_buffs; v_bonus int; v_min int;
begin
  if NEW.reason <> 'catch_reward' or NEW.amount <= 0 or NEW.catch_id is null then return NEW; end if;
  select * into v_m from public._my_clan_membership(NEW.user_id);
  if v_m.id is null then return NEW; end if;
  select b.* into v_b from public.clan_buffs b
    where b.clan_id = v_m.clan_id and now() between b.starts_at and b.ends_at
      and exists (select 1 from public.clan_buff_rsvp r where r.buff_id = b.id and r.user_id = NEW.user_id) limit 1;
  if v_b.id is null then return NEW; end if;
  select buff_min_rsvp into v_min from public.clan_economy where id = 1;
  if (select count(*) from public.clan_buff_rsvp r where r.buff_id = v_b.id) < v_min then return NEW; end if;
  select s.coin_value into v_bonus from public.catches c join public.species s on s.key = c.species where c.id = NEW.catch_id;
  if coalesce(v_bonus, 0) < 1 then return NEW; end if;
  update public.profiles set coins = coins + v_bonus where id = NEW.user_id;
  -- Without catch_id: a takedown of the catch reverses only what the catch itself paid.
  insert into public.coin_transactions (user_id, amount, reason, label) values (NEW.user_id, v_bonus, 'clan_buff', 'Баф клана «Выход»');
  return NEW;
end $$;
create trigger clan_buff_bonus after insert on public.coin_transactions
  for each row when (NEW.reason = 'catch_reward') execute function public._clan_buff_bonus();

-- ───────────── the headquarters ─────────────

-- Put or move the headquarters on a sector held by a member of the clan. One headquarters per sector:
-- UNIQUE(territory_id) enforces it for every clan. Moving costs more and is allowed once per 3 days.
create or replace function public.clan_hq_place(p_territory_id text)
returns void language plpgsql security definer set search_path = public as $$
declare v_clan bigint; v_e public.clan_economy; v_cur public.clan_hq; v_cost int;
begin
  select clan_id into v_clan from public._my_clan_membership(auth.uid());
  perform public._clan_leader_check(v_clan);
  select * into v_e from public.clan_economy where id = 1;
  if not public._clan_econ_on(v_clan) then raise exception 'CLAN:treasury_off'; end if;
  if not exists (select 1 from public.territories t join public.clan_members cm on cm.user_id = t.owner_id and cm.clan_id = v_clan and cm.left_at is null
                 where t.id = p_territory_id and not t.is_deleted) then raise exception 'CLAN:hq_not_ours'; end if;
  if exists (select 1 from public.clan_hq h where h.territory_id = p_territory_id) then raise exception 'CLAN:hq_taken'; end if;
  select * into v_cur from public.clan_hq where clan_id = v_clan for update;
  if v_cur.clan_id is not null and coalesce(v_cur.moved_at, v_cur.placed_at) + interval '3 days' > now() then raise exception 'CLAN:hq_cooldown'; end if;
  v_cost := case when v_cur.clan_id is null then v_e.hq_place_cost else v_e.hq_move_cost end;
  perform public._clan_treasury_spend(v_clan, v_cost, 'spend_hq', auth.uid(), 'Штаб-квартира · ' || p_territory_id);
  delete from public.clan_sieges where clan_id = v_clan;
  if v_cur.clan_id is null then
    insert into public.clan_hq (clan_id, territory_id) values (v_clan, p_territory_id);
  else
    update public.clan_hq set territory_id = p_territory_id, moved_at = now() where clan_id = v_clan;
  end if;
end $$;

-- confirm_catch calls this (the one line added there, see README.md) when somebody else catches on a sector with a headquarters.
-- Returns true when the catch must NOT take the sector (a siege starts / is running); false = the sector falls as usual.
create or replace function public.clan_hq_attack(p_territory_id text, p_attacker uuid, p_defense_left int)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_hq public.clan_hq; v_s public.clan_sieges;
begin
  select * into v_hq from public.clan_hq where territory_id = p_territory_id;
  if v_hq.clan_id is null then return false; end if;
  if exists (select 1 from public.clan_members cm where cm.clan_id = v_hq.clan_id and cm.user_id = p_attacker and cm.left_at is null) then return false; end if;
  if p_defense_left > 0 then return false; end if;      -- the defence still holds: the usual defence rules apply
  select * into v_s from public.clan_sieges where territory_id = p_territory_id;
  if v_s.territory_id is not null then return true; end if;   -- a siege is on, further outsider catches do not take it
  insert into public.clan_sieges (territory_id, clan_id, attacker_id, ends_at) values (p_territory_id, v_hq.clan_id, p_attacker, now() + interval '90 minutes');
  perform public._clan_notify(cm.user_id, 'clan_hq_siege', p_attacker, v_hq.clan_id, jsonb_build_object('territory_id', p_territory_id))
    from public.clan_members cm where cm.clan_id = v_hq.clan_id and cm.left_at is null;
  return true;
end $$;

-- A clan member's catch on the besieged sector breaks the siege (called by confirm_catch in the same hook).
create or replace function public.clan_hq_defend(p_territory_id text, p_defender uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_clan bigint;
begin
  select s.clan_id into v_clan from public.clan_sieges s where s.territory_id = p_territory_id;
  if v_clan is null then return false; end if;
  if not exists (select 1 from public.clan_members cm where cm.clan_id = v_clan and cm.user_id = p_defender and cm.left_at is null) then return false; end if;
  delete from public.clan_sieges where territory_id = p_territory_id;
  update public.profiles set coins = coins + 150 where id = p_defender;
  insert into public.coin_transactions (user_id, amount, reason, label) values (p_defender, 150, 'clan_siege_break', 'Осада штаба снята');
  -- Всему клану: кто снял осаду (момент «Осада снята» и строка в «Активности»; _clan_notify_many из 04 — функция ищется при вызове).
  perform public._clan_notify_many(v_clan, 'clan_hq_saved', p_defender, jsonb_build_object('territory_id', p_territory_id), 'all', null);
  return true;
end $$;

-- Every minute: a siege that nobody broke ends — the headquarters falls (the row goes; the sector itself changes hands
-- with the attacker's next catch, as usual).
create or replace function public.clan_hq_tick()
returns int language plpgsql security definer set search_path = public as $$
declare r record; n int := 0;
begin
  for r in select s.territory_id, s.clan_id from public.clan_sieges s where s.ends_at <= now() loop
    delete from public.clan_hq where territory_id = r.territory_id;   -- cascades the siege row
    perform public._clan_notify(cm.user_id, 'clan_hq_fell', null, r.clan_id, jsonb_build_object('territory_id', r.territory_id))
      from public.clan_members cm where cm.clan_id = r.clan_id and cm.left_at is null;
    n := n + 1;
  end loop;
  return n;
end $$;

-- The rent with the HQ sector paying double (replaces part 1's version).
create or replace function public.clan_rent_tick()
returns int language plpgsql security definer set search_path = public as $$
declare v_e public.clan_economy; r record; v_days int; v_plain int; v_shared int; v_hq int; v_sum int; v_paid int := 0;
begin
  select * into v_e from public.clan_economy where id = 1;
  for r in select c.id from public.clans c where c.disbanded_at is null and public._clan_econ_on(c.id) loop
    insert into public.clan_treasury (clan_id) values (r.id) on conflict do nothing;
    select greatest(0, floor(extract(epoch from (now() - last_rent_at)) / 86400))::int into v_days
      from public.clan_treasury where clan_id = r.id for update;
    continue when v_days < 1;
    select count(*) filter (where not exists (select 1 from public.territory_shares s where s.territory_id = t.id)),
           count(*) filter (where exists (select 1 from public.territory_shares s where s.territory_id = t.id))
      into v_plain, v_shared
    from public.territories t
    join public.clan_members cm on cm.user_id = t.owner_id and cm.clan_id = r.id and cm.left_at is null
    where not t.is_deleted;
    select count(*) into v_hq from public.clan_hq h join public.territories t on t.id = h.territory_id
      join public.clan_members cm on cm.user_id = t.owner_id and cm.clan_id = r.id and cm.left_at is null
      where h.clan_id = r.id and not t.is_deleted;
    v_sum := round(v_days * (v_plain * v_e.rent_per_sector_day + v_shared * v_e.rent_per_sector_day * v_e.shared_rent_factor + v_hq * v_e.rent_per_sector_day))::int;
    if v_sum > 0 then
      perform public._clan_treasury_add(r.id, v_sum, 'rent', null, v_plain || '+' || v_shared || ' сект. × ' || v_days || ' дн.');
      v_paid := v_paid + v_sum;
    end if;
    update public.clan_treasury set last_rent_at = last_rent_at + make_interval(days => v_days) where clan_id = r.id;
  end loop;
  return v_paid;
end $$;

revoke execute on function public._clan_treasury_spend(bigint, int, text, uuid, text), public._clan_buff_bonus(), public.clan_hq_tick(), public.clan_rent_tick() from public, anon, authenticated;
revoke execute on function public.clan_buff_launch(int), public.clan_buff_rsvp(bigint, boolean), public.clan_hq_place(text) from public, anon;
grant execute on function public.clan_buff_launch(int), public.clan_buff_rsvp(bigint, boolean), public.clan_hq_place(text) to authenticated;
-- clan_hq_attack / clan_hq_defend are called only from confirm_catch (a definer function): closed to everyone else.
revoke execute on function public.clan_hq_attack(text, uuid, int), public.clan_hq_defend(text, uuid) from public, anon, authenticated;
