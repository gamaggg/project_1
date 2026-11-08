-- 09 · Магазин клана, задание недели и всё остальное из предпросмотра (08.11.2026). ЧЕРНОВИК, применять только после
-- «применяй». Зависит от 01–04 и 08. Порядок: 01 → … → 08 → 09.
--
--   1. магазин        clan_items (купленное), clan_equipped (надетое: видно всем — карта, битва, экран клана),
--                     _clan_shop_item (каталог = SHOP_ITEMS из web/lib/clan2/rules.ts), clan_shop_buy, clan_shop_equip;
--                     clan_set_goal теперь принимает только товар магазина, которого у клана ещё нет
--   2. задание недели clan_quests (одно на клан и неделю), вид — случайный, но не как на прошлой неделе; цель — от активных
--                     участников (questTarget); прогресс считается по уловам участников с начала недели (как lib/clan2/live/real.ts);
--                     clan_quest_claim — глава/заместитель забирает награду в общак (questReward × «Доска»), уведомление ловившим
--   3. новичок        вступил без уловов — главе и заместителям «новичок вступил»; первый в жизни улов игрока, вступившего в клан не больше 5 дней назад: общаку recruit_reward, главе и
--                     заместителям уведомление (один раз на игрока)
--   4. «позвать на воду» clan_nudge: глава/заместитель зовёт участника, не чаще раза в сутки на человека
--   5. доли в общак   сундук и битва недели: chest_share % того, что клан получил монетами (вставка в _settle_clan_week_at)
--   6. глава пропал   clan_leader_away_tick: глава 30 дней не заходил в приложение (уловы не важны) — руководство переходит к заместителю (или
--                     старейшине, или самому активному участнику), бывший глава становится заместителем
--   7. журнал         admin_clan_reverse_entry: суперадмин отменяет запись общака (обратная запись, баланс не ниже 0)
--   8. чтение         get_clan_state: всё состояние клана одним вызовом для экранов (только участникам и суперадмину)
-- Всё денежное работает только при включённом общаке (clan_economy.enabled).

-- ───────────── 1. магазин ─────────────

create or replace function public._clan_shop_item(p_id text)
returns table (kind text, cost int, min_level int) language sql immutable as $$
  select x.kind, x.cost, x.min_level from (values
    ('skin_stripes','clan_skin',1500,1), ('skin_horizon','clan_skin',1500,1), ('skin_diagonal','clan_skin',2000,1),
    ('skin_zigzag','clan_skin',2000,1), ('skin_herringbone','clan_skin',2000,1), ('skin_rain','clan_skin',2000,1),
    ('skin_wave','clan_skin',2500,1), ('skin_scribble','clan_skin',2500,1), ('skin_net','clan_skin',2500,1),
    ('skin_grass','clan_skin',3000,1), ('skin_scales','clan_skin',4000,3), ('skin_depth','clan_skin',5000,3),
    ('skin_compass','clan_skin',6500,5), ('skin_school','clan_skin',8000,5), ('skin_sonar','clan_skin',11000,7),
    ('skin_aquarium','clan_skin',12000,7), ('skin_lighthouse','clan_skin',13000,9), ('skin_lightning','clan_skin',15000,9),
    ('boat_coral','boat',3000,2), ('boat_night','boat',4500,4), ('boat_gold','boat',6000,5), ('boat_dragon','boat',9000,7),
    ('frame_bronze','frame',2000,2), ('frame_silver','frame',4000,4), ('frame_gold','frame',7000,6), ('frame_legend','frame',12000,8)
  ) as x(id, kind, cost, min_level) where x.id = p_id;
$$;

create table public.clan_items (
  clan_id bigint not null references public.clans(id) on delete cascade,
  item_id text not null check (char_length(item_id) <= 40),
  bought_at timestamptz not null default now(),
  bought_by uuid references public.profiles(id) on delete set null,
  primary key (clan_id, item_id)
);
create table public.clan_equipped (
  clan_id bigint primary key references public.clans(id) on delete cascade,
  skin text, boat text, frame text,
  updated_at timestamptz not null default now()
);
alter table public.clan_items enable row level security;
alter table public.clan_equipped enable row level security;
create policy "items: members read" on public.clan_items for select to authenticated
  using (exists (select 1 from public.clan_members cm where cm.clan_id = clan_items.clan_id and cm.user_id = auth.uid() and cm.left_at is null));
-- Надетое видят все: скин на карте, лодка в битве, рамка на экране клана (и гости — карта открыта всем).
create policy "equipped: all read" on public.clan_equipped for select to anon, authenticated using (true);
grant select on public.clan_items to authenticated;
grant select on public.clan_equipped to anon, authenticated;

create or replace function public.clan_shop_buy(p_item text)
returns void language plpgsql security definer set search_path = public as $$
declare v_clan bigint; i record; v_level int;
begin
  select clan_id into v_clan from public._my_clan_membership(auth.uid());
  perform public._clan_leader_check(v_clan);
  if not public._clan_econ_on(v_clan) then raise exception 'CLAN:treasury_off'; end if;
  select * into i from public._clan_shop_item(p_item);
  if i.kind is null then raise exception 'CLAN:bad_item'; end if;
  if exists (select 1 from public.clan_items where clan_id = v_clan and item_id = p_item) then raise exception 'CLAN:owned'; end if;
  select public._clan_level(xp) into v_level from public.clans where id = v_clan;
  if v_level < i.min_level then raise exception 'CLAN:level_low'; end if;
  perform public._clan_treasury_spend(v_clan, i.cost, case when i.kind = 'clan_skin' then 'spend_skin' else 'spend_goal' end, auth.uid(), p_item);
  insert into public.clan_items (clan_id, item_id, bought_by) values (v_clan, p_item, auth.uid());
  -- Купленное надевается сразу; если это была цель общака, цель выполнена.
  insert into public.clan_equipped (clan_id) values (v_clan) on conflict do nothing;
  update public.clan_equipped set
    skin = case when i.kind = 'clan_skin' then p_item else skin end,
    boat = case when i.kind = 'boat' then p_item else boat end,
    frame = case when i.kind = 'frame' then p_item else frame end,
    updated_at = now()
  where clan_id = v_clan;
  update public.clan_treasury set goal_id = null where clan_id = v_clan and goal_id = p_item;
  perform public._clan_notify_many(v_clan, 'clan_item_bought', auth.uid(), jsonb_build_object('item', p_item, 'kind', i.kind), 'managers', null);
end $$;

-- Надеть купленное или снять (p_item = null) вещь этого вида.
create or replace function public.clan_shop_equip(p_kind text, p_item text)
returns void language plpgsql security definer set search_path = public as $$
declare v_clan bigint;
begin
  select clan_id into v_clan from public._my_clan_membership(auth.uid());
  perform public._clan_leader_check(v_clan);
  if p_kind not in ('clan_skin', 'boat', 'frame') then raise exception 'CLAN:bad_item'; end if;
  if p_item is not null and not exists (
    select 1 from public.clan_items ci cross join lateral public._clan_shop_item(ci.item_id) s
     where ci.clan_id = v_clan and ci.item_id = p_item and s.kind = p_kind) then
    raise exception 'CLAN:not_owned';
  end if;
  insert into public.clan_equipped (clan_id) values (v_clan) on conflict do nothing;
  update public.clan_equipped set
    skin = case when p_kind = 'clan_skin' then p_item else skin end,
    boat = case when p_kind = 'boat' then p_item else boat end,
    frame = case when p_kind = 'frame' then p_item else frame end,
    updated_at = now()
  where clan_id = v_clan;
end $$;

-- Цель общака — только товар магазина, которого у клана нет (заменяет версию из 01).
create or replace function public.clan_set_goal(p_goal text)
returns void language plpgsql security definer set search_path = public as $$
declare v_clan bigint;
begin
  select clan_id into v_clan from public._my_clan_membership(auth.uid());
  perform public._clan_leader_check(v_clan);
  if p_goal is not null then
    if not exists (select 1 from public._clan_shop_item(p_goal)) then raise exception 'CLAN:bad_goal'; end if;
    if exists (select 1 from public.clan_items where clan_id = v_clan and item_id = p_goal) then raise exception 'CLAN:owned'; end if;
  end if;
  insert into public.clan_treasury (clan_id) values (v_clan) on conflict do nothing;
  update public.clan_treasury set goal_id = p_goal where clan_id = v_clan;
end $$;

-- ───────────── 2. задание недели ─────────────

create table public.clan_quests (
  clan_id bigint not null references public.clans(id) on delete cascade,
  week_start timestamptz not null,
  kind text not null check (kind in ('catches', 'species', 'rare', 'big', 'length', 'members', 'days', 'sectors')),
  target int not null check (target > 0),
  claimed_at timestamptz,
  claimed_by uuid references public.profiles(id) on delete set null,
  reward int,
  primary key (clan_id, week_start)
);
alter table public.clan_quests enable row level security;
create policy "quests: members read" on public.clan_quests for select to authenticated
  using (exists (select 1 from public.clan_members cm where cm.clan_id = clan_quests.clan_id and cm.user_id = auth.uid() and cm.left_at is null));
grant select on public.clan_quests to authenticated;

-- Понедельник 00:00 по времени города клана.
create or replace function public._clan_week_start(p_clan_id bigint)
returns timestamptz language sql stable security definer set search_path = public as $$
  select (date_trunc('week', now() at time zone public._city_tz(c.city)) at time zone public._city_tz(c.city))
  from public.clans c where c.id = p_clan_id;
$$;

-- Задание этой недели: создаётся при первом обращении. Цель — questTarget из rules.ts.
create or replace function public._clan_quest_ensure(p_clan_id bigint)
returns public.clan_quests language plpgsql security definer set search_path = public as $$
declare v_ws timestamptz := public._clan_week_start(p_clan_id); q public.clan_quests; v_prev text; v_kind text;
  v_active int; v_members int; v_kinds text[] := array['catches', 'species', 'rare', 'big', 'length', 'members', 'days', 'sectors']; v_i int;
begin
  select * into q from public.clan_quests where clan_id = p_clan_id and week_start = v_ws;
  if q.clan_id is not null then return q; end if;
  select kind into v_prev from public.clan_quests where clan_id = p_clan_id and week_start < v_ws order by week_start desc limit 1;
  v_i := abs(hashtext(p_clan_id::text || ':' || v_ws::text)) % 8 + 1;
  v_kind := v_kinds[v_i];
  if v_kind = v_prev then v_kind := v_kinds[v_i % 8 + 1]; end if;
  select count(*) into v_members from public.clan_members cm where cm.clan_id = p_clan_id and cm.left_at is null;
  select count(distinct c.user_id) into v_active from public.catches c
    join public.clan_members cm on cm.user_id = c.user_id and cm.clan_id = p_clan_id and cm.left_at is null
   where c.caught_at > now() - interval '7 days';
  v_active := greatest(1, v_active);
  insert into public.clan_quests (clan_id, week_start, kind, target) values (p_clan_id, v_ws, v_kind,
    case v_kind
      when 'catches' then greatest(20, round(5 * v_active))
      when 'species' then least(12, greatest(5, v_active))
      when 'rare' then greatest(3, round(0.6 * v_active))
      when 'big' then 1
      when 'length' then greatest(8, round(1.6 * v_active))
      when 'members' then greatest(3, ceil(v_members * 0.6))
      when 'days' then 4
      else greatest(4, v_active)
    end)
  on conflict do nothing
  returning * into q;
  if q.clan_id is null then select * into q from public.clan_quests where clan_id = p_clan_id and week_start = v_ws; end if;
  return q;
end $$;

-- Прогресс: уловы нынешних участников с начала недели (большая рыба — от 60 см, редкая — от 50 монет за вид, длина — в метрах).
create or replace function public._clan_quest_progress(p_clan_id bigint, p_kind text, p_ws timestamptz)
returns numeric language sql stable security definer set search_path = public as $$
  with w as (
    select c.* from public.catches c
      join public.clan_members cm on cm.user_id = c.user_id and cm.clan_id = p_clan_id and cm.left_at is null
     where c.caught_at >= p_ws
  )
  select case p_kind
    when 'catches' then (select count(*) from w)
    when 'species' then (select count(distinct species) from w)
    when 'rare' then (select count(*) from w join public.species s on s.key = w.species where s.coin_value >= 50)
    when 'big' then (select case when max(length_cm) >= 60 then 1 else 0 end from w)
    when 'length' then (select floor(coalesce(sum(length_cm), 0) / 100.0) from w)
    when 'members' then (select count(distinct user_id) from w)
    when 'days' then (select count(distinct (caught_at at time zone public._city_tz((select city from public.clans where id = p_clan_id)))::date) from w)
    when 'sectors' then (select count(distinct territory_id) from w)
  end::numeric;
$$;

create or replace function public.clan_quest_claim()
returns int language plpgsql security definer set search_path = public as $$
declare v_clan bigint; q public.clan_quests; v_reward int; v_board int; v_users uuid[];
begin
  select clan_id into v_clan from public._my_clan_membership(auth.uid());
  perform public._clan_leader_check(v_clan);
  if not public._clan_econ_on(v_clan) then raise exception 'CLAN:treasury_off'; end if;
  q := public._clan_quest_ensure(v_clan);
  perform 1 from public.clan_quests where clan_id = v_clan and week_start = q.week_start for update;
  select * into q from public.clan_quests where clan_id = v_clan and week_start = q.week_start;
  if q.claimed_at is not null then raise exception 'CLAN:quest_claimed'; end if;
  if public._clan_quest_progress(v_clan, q.kind, q.week_start) < q.target then raise exception 'CLAN:quest_open'; end if;
  v_board := case public._clan_project_level(v_clan, 'board') when 1 then 15 when 2 then 30 when 3 then 50 else 0 end;
  v_reward := round((case q.kind when 'catches' then 150 when 'species' then 200 when 'rare' then 220 when 'big' then 200
                      when 'length' then 150 when 'members' then 180 when 'days' then 150 else 170 end) * (100 + v_board) / 100.0);
  v_reward := public._clan_treasury_add(v_clan, v_reward, 'quest', auth.uid(), q.kind || ':' || q.target);
  update public.clan_quests set claimed_at = now(), claimed_by = auth.uid(), reward = v_reward where clan_id = v_clan and week_start = q.week_start;
  select array_agg(distinct c.user_id) into v_users from public.catches c
    join public.clan_members cm on cm.user_id = c.user_id and cm.clan_id = v_clan and cm.left_at is null
   where c.caught_at >= q.week_start;
  perform public._clan_notify_many(v_clan, 'clan_quest_done', auth.uid(), jsonb_build_object('reward', v_reward, 'kind', q.kind), 'users', v_users);
  return v_reward;
end $$;

-- ───────────── 3. новичок ─────────────

create table public.clan_recruits (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  clan_id bigint not null references public.clans(id) on delete cascade,
  amount int not null,
  paid_at timestamptz not null default now()
);
alter table public.clan_recruits enable row level security;
revoke all on table public.clan_recruits from public, anon, authenticated;
grant all on table public.clan_recruits to service_role;

create or replace function public._clan_recruit_on_catch()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_m public.clan_members; v_reward int; v_added int;
begin
  if exists (select 1 from public.catches c where c.user_id = NEW.user_id and c.id <> NEW.id) then return NEW; end if;
  if exists (select 1 from public.clan_recruits r where r.user_id = NEW.user_id) then return NEW; end if;
  select * into v_m from public._my_clan_membership(NEW.user_id);
  if v_m.id is null or v_m.joined_at < now() - interval '5 days' or not public._clan_econ_on(v_m.clan_id) then return NEW; end if;
  select recruit_reward into v_reward from public.clan_economy where id = 1;
  v_added := public._clan_treasury_add(v_m.clan_id, v_reward, 'recruit', NEW.user_id, null);
  insert into public.clan_recruits (user_id, clan_id, amount) values (NEW.user_id, v_m.clan_id, v_added);
  perform public._clan_notify_many(v_m.clan_id, 'clan_recruit_paid', NEW.user_id, jsonb_build_object('amount', v_added), 'managers', null);
  return NEW;
end $$;
create trigger clan_recruit_on_catch after insert on public.catches for each row execute function public._clan_recruit_on_catch();

-- «Новичок вступил»: в клан пришёл игрок без единого улова — главе и заместителям (дальше его первый улов принесёт
-- общаку награду). Ловится на самой записи участника: так и прямое вступление, и одобренная заявка, и приглашение.
create or replace function public._clan_recruit_on_join()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if NEW.left_at is not null or not public._clan_econ_on(NEW.clan_id) then return NEW; end if;
  if exists (select 1 from public.catches c where c.user_id = NEW.user_id) then return NEW; end if;
  perform public._clan_notify_many(NEW.clan_id, 'clan_recruit_joined', NEW.user_id, '{}'::jsonb, 'managers', null);
  return NEW;
end $$;
create trigger clan_recruit_on_join after insert on public.clan_members for each row execute function public._clan_recruit_on_join();

-- ───────────── 4. «позвать на воду» ─────────────

create or replace function public.clan_nudge(p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_clan bigint;
begin
  select clan_id into v_clan from public._my_clan_membership(auth.uid());
  perform public._clan_leader_check(v_clan);
  if p_user = auth.uid() or not exists (select 1 from public.clan_members cm where cm.clan_id = v_clan and cm.user_id = p_user and cm.left_at is null) then
    raise exception 'CLAN:not_member';
  end if;
  if exists (select 1 from public.notifications n where n.user_id = p_user and n.kind = 'clan_nudge' and n.created_at > now() - interval '24 hours') then
    raise exception 'CLAN:nudge_once';
  end if;
  perform public._clan_notify_many(v_clan, 'clan_nudge', auth.uid(), '{}'::jsonb, 'users', array[p_user]);
end $$;

-- ───────────── 5. доли сундука и битвы в общак ─────────────
-- _settle_clan_week_at: вставки по якорям (каждый ровно один раз). Доля — от монет, которые клан получил за неделю
-- (сундук всем, кто набрал очки; битва всем, кто прошёл 10 м), без множителя «Двойных монет»; платит игра.
do $migration$
declare
  v_def text := pg_get_functiondef('public._settle_clan_week_at(text,timestamptz)'::regprocedure);
  a_decl constant text := $a$  v_won boolean;
begin$a$;
  a_reset constant text := $a$    select count(*) into v_members from public.clan_members cm where cm.clan_id = r.id and cm.left_at is null;$a$;
  a_chest constant text := $a$        perform public._clan_notify(m.user_id, 'clan_chest_reward', null, r.id, jsonb_build_object('tier', v_tier, 'coins', v_chest_coins * v_mult));$a$;
  a_race constant text := $a$          values (m.user_id, v_race_coins * v_mult, 'clan_race', 'Битва кланов: ' || r.place || '-е место');$a$;
  a_after constant text := $a$    update public.clans set xp = xp + v_xp, trophies = greatest(0, trophies + v_trophies) where id = r.id;$a$;
  a text;
begin
  foreach a in array array[a_decl, a_reset, a_chest, a_race, a_after] loop
    if (length(v_def) - length(replace(v_def, a, ''))) / length(a) <> 1 then
      raise exception '_settle_clan_week_at: anchor not found exactly once: %', left(a, 60);
    end if;
  end loop;
  v_def := replace(v_def, a_decl, $b$  v_won boolean;
  -- Клан (09): сколько монет клан получил за неделю, для доли в общак.
  v_chest_pool int;
  v_race_pool int;
  v_share int;
begin$b$);
  v_def := replace(v_def, a_reset, a_reset || $b$
    v_chest_pool := 0;
    v_race_pool := 0;$b$);
  v_def := replace(v_def, a_chest, a_chest || $b$
        v_chest_pool := v_chest_pool + v_chest_coins;$b$);
  v_def := replace(v_def, a_race, a_race || $b$
          v_race_pool := v_race_pool + v_race_coins;$b$);
  v_def := replace(v_def, a_after, $b$    if public._clan_econ_on(r.id) then
      select e.chest_share into v_share from public.clan_economy e where e.id = 1;
      if floor(v_chest_pool * v_share / 100.0) >= 1 then
        perform public._clan_treasury_add(r.id, floor(v_chest_pool * v_share / 100.0)::int, 'chest_share', null, 'Сундук недели');
      end if;
      if floor(v_race_pool * v_share / 100.0) >= 1 then
        perform public._clan_treasury_add(r.id, floor(v_race_pool * v_share / 100.0)::int, 'race_share', null, 'Битва кланов недели');
      end if;
    end if;
$b$ || a_after);
  execute v_def;
end
$migration$;

-- ───────────── 6. глава пропал ─────────────
-- Последний заход в приложение (решение владельца 08.11: уловы не важны, важно заходить хотя бы раз в 30 дней): более поздняя
-- из двух дат — вход в аккаунт (auth.users.last_sign_in_at) и последнее обновление сессии (auth.sessions: обновляется, пока
-- приложение открыто; last_sign_in_at при сохранённом входе не меняется, на 08.11 так у 31 игрока, заходившего на неделе).
create or replace function public._last_seen(p_user uuid)
returns timestamptz language sql stable security definer set search_path = public as $$
  select greatest((select u.last_sign_in_at from auth.users u where u.id = p_user),
                  (select max(greatest(s.updated_at, coalesce(s.refreshed_at::timestamptz, s.updated_at))) from auth.sessions s where s.user_id = p_user));
$$;
create or replace function public.clan_leader_away_tick()
returns int language plpgsql security definer set search_path = public as $$
declare r record; v_next uuid; n int := 0;
begin
  -- Скрытый запуск: только кланы, у которых общак работает (игроки остальных ещё в старых правилах).
  for r in
    select cm.clan_id, cm.user_id from public.clan_members cm
      join public.clans c on c.id = cm.clan_id and c.disbanded_at is null and public._clan_econ_on(c.id)
     where cm.role = 'leader' and cm.left_at is null
       and greatest(coalesce(public._last_seen(cm.user_id), cm.joined_at), cm.joined_at) < now() - interval '30 days'
  loop
    select cm.user_id into v_next from public.clan_members cm
     where cm.clan_id = r.clan_id and cm.left_at is null and cm.user_id <> r.user_id
     order by case cm.role when 'co_leader' then 0 when 'elder' then 1 else 2 end,
              public._last_seen(cm.user_id) desc nulls last, cm.joined_at
     limit 1;
    continue when v_next is null;
    update public.clan_members set role = 'co_leader' where clan_id = r.clan_id and user_id = r.user_id and left_at is null;
    update public.clan_members set role = 'leader' where clan_id = r.clan_id and user_id = v_next and left_at is null;
    insert into public.clan_events (clan_id, kind, payload)
    values (r.clan_id, 'leader_auto', jsonb_build_object('from', r.user_id, 'to', v_next));
    n := n + 1;
  end loop;
  return n;
end $$;

-- ───────────── 7. отмена записи журнала ─────────────
create or replace function public.admin_clan_reverse_entry(p_entry_id bigint)
returns void language plpgsql security definer set search_path = public as $$
declare e public.clan_treasury_log; v_back int;
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and is_super_admin) then raise exception 'not allowed'; end if;
  select * into e from public.clan_treasury_log where id = p_entry_id for update;
  if e.id is null or e.amount = 0 or coalesce(e.label, '') like 'reversed:%'
     or exists (select 1 from public.clan_treasury_log l where l.clan_id = e.clan_id and l.label = 'reversal:' || e.id) then
    raise exception 'CLAN:bad_entry';
  end if;
  select least(balance, e.amount) into v_back from public.clan_treasury where clan_id = e.clan_id for update;
  -- Приход отменяется не больше, чем есть в общаке; расход возвращается целиком (может упереться в потолок, как всё).
  if e.amount > 0 then
    update public.clan_treasury set balance = balance - greatest(0, v_back) where clan_id = e.clan_id;
    insert into public.clan_treasury_log (clan_id, kind, amount, user_id, label) values (e.clan_id, 'reversal', -greatest(0, v_back), auth.uid(), 'reversal:' || e.id);
  else
    perform public._clan_treasury_add(e.clan_id, -e.amount, 'reversal', auth.uid(), 'reversal:' || e.id);
  end if;
end $$;

-- ───────────── 8. всё состояние клана одним вызовом ─────────────
create or replace function public.get_clan_state(p_clan_id bigint)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); q public.clan_quests; v_month timestamptz;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  if not exists (select 1 from public.clan_members cm where cm.clan_id = p_clan_id and cm.user_id = v_uid and cm.left_at is null)
     and not exists (select 1 from public.profiles where id = v_uid and is_super_admin) then
    raise exception 'CLAN:not_member';
  end if;
  if public._clan_econ_on(p_clan_id) then q := public._clan_quest_ensure(p_clan_id); end if;
  v_month := date_trunc('month', now() at time zone public._city_tz((select city from public.clans where id = p_clan_id)))
             at time zone public._city_tz((select city from public.clans where id = p_clan_id));
  return public.get_clan_treasury_unchecked(p_clan_id) || jsonb_build_object(
    'economy', (select to_jsonb(e) - 'updated_by' from public.clan_economy e where e.id = 1),
    'hq', (select jsonb_build_object('territory_id', h.territory_id, 'placed_at', h.placed_at, 'moved_at', h.moved_at,
             'siege', (select jsonb_build_object('attacker_id', s.attacker_id, 'started_at', s.started_at, 'ends_at', s.ends_at)
                        from public.clan_sieges s where s.territory_id = h.territory_id))
           from public.clan_hq h where h.clan_id = p_clan_id),
    'ruins', (select jsonb_build_object('territory_id', r.territory_id, 'by_clan_id', r.by_clan_id, 'loot', r.loot, 'fell_at', r.fell_at, 'until', r.until)
              from public.clan_hq_ruins r where r.clan_id = p_clan_id and r.until > now()),
    'build', (select jsonb_build_object('project', b.project, 'to_level', b.to_level, 'cost', b.cost, 'started_at', b.started_at, 'ends_at', b.ends_at)
              from public.clan_builds b where b.clan_id = p_clan_id),
    'buff', (select jsonb_build_object('id', b.id, 'starts_at', b.starts_at, 'ends_at', b.ends_at, 'created_by', b.created_by,
               'rsvp', coalesce((select jsonb_agg(r.user_id) from public.clan_buff_rsvp r where r.buff_id = b.id), '[]'::jsonb))
             from public.clan_buffs b where b.clan_id = p_clan_id order by b.starts_at desc limit 1),
    'quest', case when q.clan_id is null then null else jsonb_build_object('week_start', q.week_start, 'kind', q.kind, 'target', q.target,
               'progress', public._clan_quest_progress(p_clan_id, q.kind, q.week_start), 'claimed_at', q.claimed_at, 'reward', q.reward,
               'helpers', coalesce((select jsonb_agg(distinct c.user_id) from public.catches c
                                     join public.clan_members cm on cm.user_id = c.user_id and cm.clan_id = p_clan_id and cm.left_at is null
                                    where c.caught_at >= q.week_start), '[]'::jsonb)) end,
    'items', coalesce((select jsonb_agg(ci.item_id order by ci.bought_at) from public.clan_items ci where ci.clan_id = p_clan_id), '[]'::jsonb),
    'equipped', (select jsonb_build_object('clan_skin', e.skin, 'boat', e.boat, 'frame', e.frame) from public.clan_equipped e where e.clan_id = p_clan_id),
    'month_givers', coalesce((select jsonb_object_agg(g.user_id, g.s) from (select user_id, sum(amount)::int s from public.clan_treasury_log
                               where clan_id = p_clan_id and kind in ('donation', 'tax') and created_at >= v_month and user_id is not null
                               group by user_id) g), '{}'::jsonb),
    'recruits', coalesce((select jsonb_agg(jsonb_build_object('user_id', r.user_id, 'amount', r.amount, 'paid_at', r.paid_at))
                           from public.clan_recruits r where r.clan_id = p_clan_id), '[]'::jsonb)
  );
end $$;

-- get_clan_treasury без проверки участника (её делает get_clan_state, там же пускается суперадмин).
create or replace function public.get_clan_treasury_unchecked(p_clan_id bigint)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_t public.clan_treasury; v_e public.clan_economy;
begin
  select * into v_e from public.clan_economy where id = 1;
  select * into v_t from public.clan_treasury where clan_id = p_clan_id;
  return jsonb_build_object(
    'enabled', public._clan_econ_on(p_clan_id),
    'balance', coalesce(v_t.balance, 0),
    'cap', public._clan_treasury_cap(p_clan_id),
    'tax_rate', coalesce(v_t.tax_rate, 0),
    'goal_id', v_t.goal_id,
    'projects', coalesce(v_t.projects, '{}'::jsonb),
    'last_rent_at', v_t.last_rent_at,
    'log', coalesce((select jsonb_agg(jsonb_build_object('id', l.id, 'kind', l.kind, 'amount', l.amount, 'user_id', l.user_id,
                       'name', p.display_name, 'label', l.label, 'at', l.created_at) order by l.id desc)
                     from (select * from public.clan_treasury_log where clan_id = p_clan_id order by id desc limit 50) l
                     left join public.profiles p on p.id = l.user_id), '[]'::jsonb)
  );
end $$;

-- ───────────── права ─────────────
revoke all on function public._clan_shop_item(text), public._clan_week_start(bigint), public._clan_quest_ensure(bigint),
  public._clan_quest_progress(bigint, text, timestamptz), public._clan_recruit_on_catch(), public._clan_recruit_on_join(), public.clan_leader_away_tick(), public._last_seen(uuid),
  public.get_clan_treasury_unchecked(bigint) from public, anon, authenticated;
revoke all on function public.clan_shop_buy(text), public.clan_shop_equip(text, text), public.clan_set_goal(text), public.clan_quest_claim(),
  public.clan_nudge(uuid), public.admin_clan_reverse_entry(bigint), public.get_clan_state(bigint) from public, anon;
grant execute on function public.clan_shop_buy(text), public.clan_shop_equip(text, text), public.clan_set_goal(text), public.clan_quest_claim(),
  public.clan_nudge(uuid), public.admin_clan_reverse_entry(bigint), public.get_clan_state(bigint) to authenticated;

-- «Позвать на воду» и «глава пропал» в рассылке Telegram (якорь — конец списка после 06).
do $migration$
declare
  v_def text := pg_get_functiondef('public.queue_telegram_notification()'::regprocedure);
  v_kinds constant text := $k$'clan_recruit_paid', 'clan_week_digest')$k$;
begin
  if (length(v_def) - length(replace(v_def, v_kinds, ''))) / length(v_kinds) <> 1 then
    raise exception 'queue_telegram_notification: kinds anchor (after 06) not found exactly once';
  end if;
  execute replace(v_def, v_kinds, $k$'clan_recruit_paid', 'clan_week_digest', 'clan_nudge')$k$);
end
$migration$;

select cron.schedule('clan-leader-away', '20 3 * * *', $$select public.clan_leader_away_tick()$$);
