-- CLAN UPDATE, part 1 of 3 — the clan treasury («Общак»).
-- DRAFT. Not applied. Needs the owner's «применяй» (and a green dry-run: see README.md).
--
-- What it adds (nothing existing is edited):
--   clan_economy       one row of the numbers the admin screen edits (switch `enabled` is OFF by default)
--   clan_treasury      one row per clan: balance, tax rate, saved-up goal, buildings
--   clan_treasury_log  every coin in and out, with who and why
--   RPCs               get_clan_treasury, clan_treasury_donate, clan_set_tax, clan_set_goal, admin_set_clan_economy
--   clan_rent_tick()   the daily rent of the clan's sectors (called by cron — added in part 3, after the launch)
--   trigger            clan_tax_on_catch: the catch tax, taken from the catcher's reward
-- Numbers are the ones in web/lib/clan2/rules.ts (checked against the database on 06.11.2026).

create table public.clan_economy (
  id int primary key default 1 check (id = 1),
  enabled boolean not null default false,
  rent_per_sector_day int not null default 8 check (rent_per_sector_day between 0 and 100),
  shared_rent_factor numeric not null default 1.5 check (shared_rent_factor between 1 and 5),
  buff_price int not null default 300 check (buff_price between 0 and 5000),
  buff_cooldown_hours int not null default 12 check (buff_cooldown_hours between 0 and 72),
  buff_min_rsvp int not null default 3 check (buff_min_rsvp between 1 and 20),
  tax_max int not null default 10 check (tax_max in (0, 5, 10)),
  chest_share int not null default 25 check (chest_share between 0 and 100),
  recruit_reward int not null default 100 check (recruit_reward between 0 and 1000),
  hq_place_cost int not null default 400 check (hq_place_cost between 0 and 5000),
  hq_move_cost int not null default 600 check (hq_move_cost between 0 and 5000),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id) on delete set null
);
insert into public.clan_economy (id) values (1);

create table public.clan_treasury (
  clan_id bigint primary key references public.clans(id) on delete cascade,
  balance int not null default 0 check (balance >= 0),
  tax_rate smallint not null default 0 check (tax_rate in (0, 5, 10)),
  goal_id text check (goal_id is null or char_length(goal_id) <= 40),
  projects jsonb not null default '{}'::jsonb,
  last_rent_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table public.clan_treasury_log (
  id bigint generated always as identity primary key,
  clan_id bigint not null references public.clans(id) on delete cascade,
  kind text not null check (char_length(kind) <= 24),
  amount int not null,
  user_id uuid references public.profiles(id) on delete set null,
  label text check (label is null or char_length(label) <= 120),
  created_at timestamptz not null default now()
);
create index clan_treasury_log_clan_idx on public.clan_treasury_log (clan_id, id desc);

alter table public.clan_economy enable row level security;
alter table public.clan_treasury enable row level security;
alter table public.clan_treasury_log enable row level security;

-- Members of the clan read their own treasury and its log; writing goes only through the RPCs below.
create policy "economy: read" on public.clan_economy for select to authenticated using (true);
create policy "treasury: members read" on public.clan_treasury for select to authenticated
  using (exists (select 1 from public.clan_members cm where cm.clan_id = clan_treasury.clan_id and cm.user_id = auth.uid() and cm.left_at is null));
create policy "treasury log: members read" on public.clan_treasury_log for select to authenticated
  using (exists (select 1 from public.clan_members cm where cm.clan_id = clan_treasury_log.clan_id and cm.user_id = auth.uid() and cm.left_at is null));

-- New public tables need their grants spelled out (see project notes).
grant select on public.clan_economy, public.clan_treasury, public.clan_treasury_log to authenticated;

-- ───────────── helpers (not callable from the client) ─────────────

-- The treasury holds only so much, by clan level (same table as lib/clan2/rules.ts: treasuryCap); «Склад» adds to it.
create or replace function public._clan_treasury_cap(p_clan_id bigint)
returns int language sql stable security definer set search_path = public as $$
  select (case when lvl >= 9 then 20000 when lvl >= 7 then 12000 when lvl >= 5 then 8000 when lvl >= 3 then 5000 else 3000 end)
       + (case coalesce((t.projects->>'storage')::int, 0) when 1 then 1000 when 2 then 2500 when 3 then 5000 else 0 end)
  from (select public._clan_level(c.xp) as lvl from public.clans c where c.id = p_clan_id) x
  left join public.clan_treasury t on t.clan_id = p_clan_id;
$$;

-- Puts coins in: up to the cap; the rest is lost, and the entry says how much. Returns what went in.
create or replace function public._clan_treasury_add(p_clan_id bigint, p_amount int, p_kind text, p_user uuid, p_label text default null)
returns int language plpgsql security definer set search_path = public as $$
declare v_bal int; v_cap int; v_add int;
begin
  insert into public.clan_treasury (clan_id) values (p_clan_id) on conflict do nothing;
  select balance into v_bal from public.clan_treasury where clan_id = p_clan_id for update;
  v_cap := public._clan_treasury_cap(p_clan_id);
  v_add := greatest(0, least(p_amount, v_cap - v_bal));
  if v_add > 0 then
    update public.clan_treasury set balance = balance + v_add where clan_id = p_clan_id;
  end if;
  insert into public.clan_treasury_log (clan_id, kind, amount, user_id, label)
  values (p_clan_id, p_kind, v_add, p_user,
          nullif(trim(coalesce(p_label, '') || case when v_add < p_amount then ' · не влезло: ' || (p_amount - v_add) else '' end), ''));
  return v_add;
end $$;

create or replace function public._clan_leader_check(p_clan_id bigint)
returns void language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if not exists (select 1 from public.clan_members cm where cm.clan_id = p_clan_id and cm.user_id = auth.uid()
                 and cm.left_at is null and cm.role in ('leader', 'co_leader')) then
    raise exception 'CLAN:not_manager';
  end if;
end $$;

-- ───────────── reading ─────────────

create or replace function public.get_clan_treasury(p_clan_id bigint)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_t public.clan_treasury; v_e public.clan_economy;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  if not exists (select 1 from public.clan_members cm where cm.clan_id = p_clan_id and cm.user_id = v_uid and cm.left_at is null) then
    raise exception 'CLAN:not_member';
  end if;
  select * into v_e from public.clan_economy where id = 1;
  select * into v_t from public.clan_treasury where clan_id = p_clan_id;
  return jsonb_build_object(
    'enabled', v_e.enabled,
    'balance', coalesce(v_t.balance, 0),
    'cap', public._clan_treasury_cap(p_clan_id),
    'tax_rate', coalesce(v_t.tax_rate, 0),
    'goal_id', v_t.goal_id,
    'projects', coalesce(v_t.projects, '{}'::jsonb),
    'log', coalesce((select jsonb_agg(jsonb_build_object('id', l.id, 'kind', l.kind, 'amount', l.amount, 'user_id', l.user_id,
                       'name', p.display_name, 'label', l.label, 'at', l.created_at) order by l.id desc)
                     from (select * from public.clan_treasury_log where clan_id = p_clan_id order by id desc limit 50) l
                     left join public.profiles p on p.id = l.user_id), '[]'::jsonb),
    -- Who gave how much in the last 7 days: the visible contribution («Меценат недели»).
    'week_givers', coalesce((select jsonb_agg(jsonb_build_object('user_id', g.user_id, 'name', p.display_name, 'amount', g.s) order by g.s desc)
                     from (select user_id, sum(amount)::int s from public.clan_treasury_log
                           where clan_id = p_clan_id and kind in ('donation', 'tax') and created_at > now() - interval '7 days' and user_id is not null
                           group by user_id) g join public.profiles p on p.id = g.user_id), '[]'::jsonb)
  );
end $$;

-- ───────────── actions of the members ─────────────

-- A member gives his own coins to the treasury.
create or replace function public.clan_treasury_donate(p_amount int)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_m public.clan_members; v_e public.clan_economy; v_added int; v_bal int;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  select * into v_e from public.clan_economy where id = 1;
  if not v_e.enabled then raise exception 'CLAN:treasury_off'; end if;
  if p_amount is null or p_amount < 1 or p_amount > 5000 then raise exception 'CLAN:bad_amount'; end if;
  select * into v_m from public._my_clan_membership(v_uid);
  if v_m.id is null then raise exception 'CLAN:not_member'; end if;
  perform 1 from public.profiles where id = v_uid for update;
  update public.profiles set coins = coins - p_amount where id = v_uid and coins >= p_amount;
  if not found then raise exception 'not enough coins'; end if;
  v_added := public._clan_treasury_add(v_m.clan_id, p_amount, 'donation', v_uid, null);
  -- What does not fit comes back to the giver, not into thin air.
  if v_added < p_amount then
    update public.profiles set coins = coins + (p_amount - v_added) where id = v_uid;
  end if;
  insert into public.coin_transactions (user_id, amount, reason, label) values (v_uid, -v_added, 'clan_donation', 'Взнос в общак клана');
  select balance into v_bal from public.clan_treasury where clan_id = v_m.clan_id;
  return jsonb_build_object('added', v_added, 'returned', p_amount - v_added, 'balance', v_bal);
end $$;

-- ───────────── actions of the leader / co-leader ─────────────

create or replace function public.clan_set_tax(p_rate int)
returns void language plpgsql security definer set search_path = public as $$
declare v_clan bigint; v_e public.clan_economy;
begin
  select clan_id into v_clan from public._my_clan_membership(auth.uid());
  perform public._clan_leader_check(v_clan);
  select * into v_e from public.clan_economy where id = 1;
  if p_rate not in (0, 5, 10) or p_rate > v_e.tax_max then raise exception 'CLAN:bad_rate'; end if;
  insert into public.clan_treasury (clan_id) values (v_clan) on conflict do nothing;
  update public.clan_treasury set tax_rate = p_rate where clan_id = v_clan;
  insert into public.clan_treasury_log (clan_id, kind, amount, user_id, label) values (v_clan, 'setting', 0, auth.uid(), 'Ставка отчисления: ' || p_rate || '%');
end $$;

create or replace function public.clan_set_goal(p_goal text)
returns void language plpgsql security definer set search_path = public as $$
declare v_clan bigint;
begin
  select clan_id into v_clan from public._my_clan_membership(auth.uid());
  perform public._clan_leader_check(v_clan);
  if p_goal is not null and p_goal !~ '^[a-z0-9_]{1,40}$' then raise exception 'CLAN:bad_goal'; end if;
  insert into public.clan_treasury (clan_id) values (v_clan) on conflict do nothing;
  update public.clan_treasury set goal_id = p_goal where clan_id = v_clan;
end $$;

-- ───────────── the admin ─────────────

create or replace function public.admin_set_clan_economy(p jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and is_super_admin) then raise exception 'not allowed'; end if;
  update public.clan_economy set
    enabled = coalesce((p->>'enabled')::boolean, enabled),
    rent_per_sector_day = coalesce((p->>'rent_per_sector_day')::int, rent_per_sector_day),
    shared_rent_factor = coalesce((p->>'shared_rent_factor')::numeric, shared_rent_factor),
    buff_price = coalesce((p->>'buff_price')::int, buff_price),
    buff_cooldown_hours = coalesce((p->>'buff_cooldown_hours')::int, buff_cooldown_hours),
    buff_min_rsvp = coalesce((p->>'buff_min_rsvp')::int, buff_min_rsvp),
    tax_max = coalesce((p->>'tax_max')::int, tax_max),
    chest_share = coalesce((p->>'chest_share')::int, chest_share),
    recruit_reward = coalesce((p->>'recruit_reward')::int, recruit_reward),
    hq_place_cost = coalesce((p->>'hq_place_cost')::int, hq_place_cost),
    hq_move_cost = coalesce((p->>'hq_move_cost')::int, hq_move_cost),
    updated_at = now(), updated_by = auth.uid()
  where id = 1;
end $$;

-- ───────────── the daily rent of the clan's sectors ─────────────

-- Every whole day since the last time, each active clan gets rent for the sectors its members hold:
-- rent_per_sector_day per sector, a sector shared by several clan-mates pays shared_rent_factor times more,
-- the sector with the headquarters (part 2) pays double. Paid by the game, not taken from anybody.
create or replace function public.clan_rent_tick()
returns int language plpgsql security definer set search_path = public as $$
declare v_e public.clan_economy; r record; v_days int; v_plain int; v_shared int; v_sum int; v_paid int := 0;
begin
  select * into v_e from public.clan_economy where id = 1;
  if not v_e.enabled then return 0; end if;
  for r in select c.id from public.clans c where c.disbanded_at is null loop
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
    v_sum := round(v_days * (v_plain * v_e.rent_per_sector_day + v_shared * v_e.rent_per_sector_day * v_e.shared_rent_factor))::int;
    if v_sum > 0 then
      perform public._clan_treasury_add(r.id, v_sum, 'rent', null, v_plain || '+' || v_shared || ' сект. × ' || v_days || ' дн.');
      v_paid := v_paid + v_sum;
    end if;
    update public.clan_treasury set last_rent_at = last_rent_at + make_interval(days => v_days) where clan_id = r.id;
  end loop;
  return v_paid;
end $$;

-- ───────────── the catch tax ─────────────

-- confirm_catch writes the reward as a coin_transactions row with reason 'catch_reward'. This trigger
-- takes the clan's tax rate from it, so confirm_catch itself stays untouched. The tax is part of the
-- catcher's reward (it is not paid on top of it), and the catcher sees it as his own line.
create or replace function public._clan_tax_on_catch()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_m public.clan_members; v_rate smallint; v_tax int; v_taken int;
begin
  if NEW.reason <> 'catch_reward' or NEW.amount <= 0 then return NEW; end if;
  if not (select enabled from public.clan_economy where id = 1) then return NEW; end if;
  select * into v_m from public._my_clan_membership(NEW.user_id);
  if v_m.id is null then return NEW; end if;
  select tax_rate into v_rate from public.clan_treasury where clan_id = v_m.clan_id;
  if coalesce(v_rate, 0) = 0 then return NEW; end if;
  v_tax := floor(NEW.amount * v_rate / 100.0)::int;
  if v_tax < 1 then return NEW; end if;
  v_taken := public._clan_treasury_add(v_m.clan_id, v_tax, 'tax', NEW.user_id, coalesce(NEW.label, ''));
  if v_taken > 0 then
    update public.profiles set coins = coins - v_taken where id = NEW.user_id;
    -- No catch_id here: a later takedown of the catch reverses exactly what the catch itself paid.
    insert into public.coin_transactions (user_id, amount, reason, label) values (NEW.user_id, -v_taken, 'clan_tax', 'Отчисление в общак клана ' || v_rate || '%');
  end if;
  return NEW;
end $$;

create trigger clan_tax_on_catch after insert on public.coin_transactions
  for each row when (NEW.reason = 'catch_reward') execute function public._clan_tax_on_catch();

-- ───────────── who may call what ─────────────

revoke execute on function public._clan_treasury_cap(bigint), public._clan_treasury_add(bigint, int, text, uuid, text),
  public._clan_leader_check(bigint), public.clan_rent_tick(), public._clan_tax_on_catch() from public, anon, authenticated;
revoke execute on function public.get_clan_treasury(bigint), public.clan_treasury_donate(int), public.clan_set_tax(int),
  public.clan_set_goal(text), public.admin_set_clan_economy(jsonb) from public, anon;
grant execute on function public.get_clan_treasury(bigint), public.clan_treasury_donate(int), public.clan_set_tax(int),
  public.clan_set_goal(text), public.admin_set_clan_economy(jsonb) to authenticated;
