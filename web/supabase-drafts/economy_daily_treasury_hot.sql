-- Большое обновление, пачка 2 (только новое): ежедневная награда, Казна секторов, горячие сектора.
-- Игроки ничего из этого не видят до релиза кода. Расписания cron, бонус за улов на горячем секторе
-- (триггер на catches) и Telegram-рассылки — в релизной миграции.

-- ===== Ежедневная награда: 10 дней подряд, пропуск — заново с первого =====
create table public.daily_rewards (
  user_id uuid not null references public.profiles(id) on delete cascade,
  day date not null,
  streak_day smallint not null check (streak_day between 1 and 10),
  coins integer not null,
  claimed_at timestamptz not null default now(),
  primary key (user_id, day)
);
alter table public.daily_rewards enable row level security;
revoke all on public.daily_rewards from anon, authenticated;
comment on table public.daily_rewards is 'Ежедневная награда: одна строка на каждый день, когда игрок её забрал. day — дата по времени его города.';

create function public._daily_reward_amounts()
 returns int[]
 language sql
 immutable
as $function$
  select array[10, 15, 20, 25, 30, 35, 40, 50, 60, 100];
$function$;

-- Какой день серии сегодня: забрал вчера — следующий (после 10-го снова 1-й), пропустил — 1-й.
create function public._daily_reward_state(p_uid uuid)
 returns table(today date, claimed_today boolean, streak_day int, broken boolean, next_reset timestamptz)
 language sql
 stable
 security definer
 set search_path to 'public'
as $function$
  with tz as (
    select public._city_tz(public._profile_city(p_uid)) as tz
  ), t as (
    select (now() at time zone tz.tz)::date as today, tz.tz from tz
  ), last as (
    select r.day, r.streak_day from public.daily_rewards r where r.user_id = p_uid order by r.day desc limit 1
  )
  select
    t.today,
    coalesce((select day from last) = t.today, false),
    case
      when (select day from last) = t.today then (select streak_day from last)
      when (select day from last) = t.today - 1 then (select streak_day from last) % 10 + 1
      else 1
    end,
    coalesce((select day from last) < t.today - 1, false),
    ((t.today + 1)::timestamp at time zone t.tz)
  from t;
$function$;
revoke all on function public._daily_reward_state(uuid) from public, anon, authenticated;

create function public.get_daily_reward_state()
 returns jsonb
 language plpgsql
 stable
 security definer
 set search_path to 'public'
as $function$
declare
  v_uid uuid := auth.uid();
  v record;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;
  select * into v from public._daily_reward_state(v_uid);
  return jsonb_build_object(
    'claimed_today', v.claimed_today,
    'day', v.streak_day,
    'broken', v.broken,
    'amounts', to_jsonb(public._daily_reward_amounts()),
    'next_reset', v.next_reset
  );
end;
$function$;

create function public.claim_daily_reward()
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_uid uuid := auth.uid();
  v record;
  v_coins int;
  v_balance int;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;
  perform 1 from public.profiles where id = v_uid for update;
  select * into v from public._daily_reward_state(v_uid);
  if v.claimed_today then
    raise exception 'DAILY:already_claimed';
  end if;
  v_coins := (public._daily_reward_amounts())[v.streak_day];
  insert into public.daily_rewards (user_id, day, streak_day, coins) values (v_uid, v.today, v.streak_day, v_coins);
  update public.profiles set coins = coins + v_coins where id = v_uid returning coins into v_balance;
  insert into public.coin_transactions (user_id, amount, reason, label)
  values (v_uid, v_coins, 'daily_reward', 'Ежедневная награда · день ' || v.streak_day);
  return jsonb_build_object('day', v.streak_day, 'coins', v_coins, 'balance', v_balance);
end;
$function$;

-- ===== Горячие сектора недели =====
create table public.hot_sectors (
  id bigserial primary key,
  territory_id text not null references public.territories(id) on delete cascade,
  city text not null check (city in ('batumi', 'moscow')),
  kind text not null check (kind in ('popular', 'free')),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  winner_ids uuid[],
  settled_at timestamptz
);
create index hot_sectors_ends_idx on public.hot_sectors (ends_at);
create index hot_sectors_territory_idx on public.hot_sectors (territory_id, ends_at desc);
alter table public.hot_sectors enable row level security;
revoke all on public.hot_sectors from anon, authenticated;
comment on table public.hot_sectors is 'Горячие сектора недели: пятница 12:00 — воскресенье 23:59 по времени города. winner_ids — кто держал сектор в конце.';

-- Пятница 12:00 по городу: самый популярный за 30 дней сектор (не тот, что был горячим на
-- прошлой неделе) и свободный рядом с популярными местами. До конца воскресенья.
create function public.pick_hot_sectors(p_city text)
 returns int
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_tz text := public._city_tz(p_city);
  v_prefix text := case when p_city = 'moscow' then 'M' else 'B' end;
  v_local_now timestamp := now() at time zone v_tz;
  v_ends timestamptz;
  v_popular text;
  v_free text;
  v_n int := 0;
begin
  if exists (select 1 from public.hot_sectors where city = p_city and ends_at > now()) then
    return 0;
  end if;
  -- Sunday 23:59:59 of this week, local time.
  v_ends := ((date_trunc('week', v_local_now) + interval '7 days' - interval '1 second') at time zone v_tz);

  select t.id into v_popular
  from public.territories t
  join public.catches c on c.territory_id = t.id and c.caught_at > now() - interval '30 days'
  where t.id like v_prefix || '%' and not t.is_deleted
    and not exists (select 1 from public.hot_sectors h where h.territory_id = t.id and h.ends_at > now() - interval '8 days')
  group by t.id
  order by count(*) desc, max(c.caught_at) desc
  limit 1;

  if v_popular is not null then
    insert into public.hot_sectors (territory_id, city, kind, starts_at, ends_at) values (v_popular, p_city, 'popular', now(), v_ends);
    v_n := v_n + 1;
  end if;

  -- A free sector close to where people actually fish: among the 5 nearest free sectors
  -- to the city's 10 busiest ones (within 2 km), pick one at random.
  with busy as (
    select t.id, t.lat, t.lng
    from public.territories t
    join public.catches c on c.territory_id = t.id and c.caught_at > now() - interval '30 days'
    where t.id like v_prefix || '%' and not t.is_deleted
    group by t.id, t.lat, t.lng
    order by count(*) desc
    limit 10
  ), candidates as (
    select f.id,
      min(sqrt(power((f.lat - b.lat) * 111.0, 2) + power((f.lng - b.lng) * 111.0 * cos(radians(f.lat)), 2))) as km
    from public.territories f
    cross join busy b
    where f.id like v_prefix || '%' and not f.is_deleted and f.owner_id is null
      and f.id <> coalesce(v_popular, '')
      and not exists (select 1 from public.hot_sectors h where h.territory_id = f.id and h.ends_at > now() - interval '8 days')
    group by f.id
    having min(sqrt(power((f.lat - b.lat) * 111.0, 2) + power((f.lng - b.lng) * 111.0 * cos(radians(f.lat)), 2))) <= 2
    order by km
    limit 5
  )
  select id into v_free from candidates order by random() limit 1;

  if v_free is not null then
    insert into public.hot_sectors (territory_id, city, kind, starts_at, ends_at) values (v_free, p_city, 'free', now(), v_ends);
    v_n := v_n + 1;
  end if;
  return v_n;
end;
$function$;

-- После конца недели: всем, кто держит сектор (хозяин и совладельцы), — 100 монет и медаль.
create function public.settle_hot_sectors()
 returns int
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  h record;
  v_holders uuid[];
  v_uid uuid;
  v_n int := 0;
begin
  for h in
    select hs.* from public.hot_sectors hs where hs.ends_at <= now() and hs.settled_at is null for update
  loop
    select array_remove(array[t.owner_id] || coalesce((select array_agg(s.user_id) from public.territory_shares s where s.territory_id = t.id), '{}'), null)
      into v_holders
    from public.territories t where t.id = h.territory_id;

    foreach v_uid in array coalesce(v_holders, '{}') loop
      update public.profiles set coins = coins + 100 where id = v_uid;
      insert into public.coin_transactions (user_id, amount, reason, label)
      values (v_uid, 100, 'hot_sector_win', 'Удержал горячий сектор ' || h.territory_id);
      insert into public.user_awards (user_id, kind, title, subtitle, description, period_key)
      values (v_uid, 'hot_sector', 'Хозяин горячего сектора', 'Сектор ' || h.territory_id,
        'Удержал горячий сектор ' || h.territory_id || ' до конца недели — +100 монет.', 'hot:' || h.id);
      insert into public.notifications (user_id, kind, territory_id, payload)
      values (v_uid, 'hot_sector_won', h.territory_id, jsonb_build_object('coins', 100));
    end loop;

    update public.hot_sectors set winner_ids = v_holders, settled_at = now() where id = h.id;
    v_n := v_n + 1;
  end loop;
  return v_n;
end;
$function$;

-- ===== Казна: 1 монета за 3 часа удержания с каждого сектора, копится не дольше суток,
-- забирать кнопкой, не больше 30 монет в сутки. Горячий сектор ×3. =====
create table public.treasury_collections (
  id bigserial primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  collected_at timestamptz not null default now(),
  coins integer not null
);
create index treasury_collections_user_idx on public.treasury_collections (user_id, collected_at desc);
alter table public.treasury_collections enable row level security;
revoke all on public.treasury_collections from anon, authenticated;
comment on table public.treasury_collections is 'Казна секторов: когда и сколько игрок собрал. Накопление считается от последнего сбора (не дальше суток назад).';

-- Сектора, которые игрок держит сейчас, и с какого момента: хозяин — с последнего своего
-- захвата, совладелец — с входа в долю.
create function public._held_sectors(p_uid uuid)
 returns table(territory_id text, held_since timestamptz)
 language sql
 stable
 security definer
 set search_path to 'public'
as $function$
  select t.id,
    coalesce((select max(a.created_at) from public.activity_log a
              where a.territory_id = t.id and a.kind = 'claim' and a.user_id = p_uid), t.claimed_at, now())
  from public.territories t
  where t.owner_id = p_uid and not t.is_deleted
  union all
  select s.territory_id, s.joined_at
  from public.territory_shares s
  join public.territories t on t.id = s.territory_id
  where s.user_id = p_uid and not t.is_deleted;
$function$;
revoke all on function public._held_sectors(uuid) from public, anon, authenticated;

create function public._treasury_state(p_uid uuid)
 returns table(available int, accrued numeric, collected_today int, per_day int, sectors int)
 language sql
 stable
 security definer
 set search_path to 'public'
as $function$
  with tz as (
    select public._city_tz(public._profile_city(p_uid)) as tz
  ), d as (
    select (date_trunc('day', now() at time zone tz.tz) at time zone tz.tz) as day_start from tz
  ), w as (
    select greatest(
      coalesce((select max(collected_at) from public.treasury_collections where user_id = p_uid), '-infinity'::timestamptz),
      now() - interval '24 hours'
    ) as ws
  ), held as (
    select h.territory_id,
      greatest(h.held_since, (select ws from w)) as since,
      case when exists (
        select 1 from public.hot_sectors hs where hs.territory_id = h.territory_id and now() between hs.starts_at and hs.ends_at
      ) then 3 else 1 end as mult
    from public._held_sectors(p_uid) h
  ), acc as (
    select coalesce(sum(greatest(extract(epoch from now() - since), 0) / 10800.0 * mult), 0) as a,
      coalesce(sum(8 * mult), 0)::int as per_day,
      count(*)::int as n
    from held
  ), today as (
    select coalesce(sum(c.coins), 0)::int as c from public.treasury_collections c, d
    where c.user_id = p_uid and c.collected_at >= d.day_start
  )
  select least(floor(acc.a)::int, greatest(30 - today.c, 0)), acc.a, today.c, acc.per_day, acc.n
  from acc, today;
$function$;
revoke all on function public._treasury_state(uuid) from public, anon, authenticated;

create function public.get_treasury()
 returns jsonb
 language plpgsql
 stable
 security definer
 set search_path to 'public'
as $function$
declare
  v_uid uuid := auth.uid();
  v record;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;
  select * into v from public._treasury_state(v_uid);
  return jsonb_build_object('available', v.available, 'collected_today', v.collected_today, 'daily_cap', 30,
    'per_day', v.per_day, 'sectors', v.sectors);
end;
$function$;

create function public.collect_treasury()
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_uid uuid := auth.uid();
  v record;
  v_balance int;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;
  perform 1 from public.profiles where id = v_uid for update;
  select * into v from public._treasury_state(v_uid);
  if v.available <= 0 then
    raise exception 'TREASURY:empty';
  end if;
  insert into public.treasury_collections (user_id, coins) values (v_uid, v.available);
  update public.profiles set coins = coins + v.available where id = v_uid returning coins into v_balance;
  insert into public.coin_transactions (user_id, amount, reason, label) values (v_uid, v.available, 'treasury', 'Казна секторов');
  return jsonb_build_object('coins', v.available, 'balance', v_balance);
end;
$function$;

revoke all on function public.get_daily_reward_state() from public, anon;
revoke all on function public.claim_daily_reward() from public, anon;
revoke all on function public.get_treasury() from public, anon;
revoke all on function public.collect_treasury() from public, anon;
revoke all on function public.pick_hot_sectors(text) from public, anon, authenticated;
revoke all on function public.settle_hot_sectors() from public, anon, authenticated;
revoke all on function public._daily_reward_amounts() from public, anon, authenticated;
grant execute on function public.get_daily_reward_state() to authenticated, service_role;
grant execute on function public.claim_daily_reward() to authenticated, service_role;
grant execute on function public.get_treasury() to authenticated, service_role;
grant execute on function public.collect_treasury() to authenticated, service_role;
grant execute on function public.pick_hot_sectors(text) to service_role;
grant execute on function public.settle_hot_sectors() to service_role;

-- Горячий сектор виден на карте без отдельного запроса: в данных секторов появляется
-- hot_until — до какого момента сектор горячий (null — не горячий). Колонка добавляется
-- в конец представления (CREATE OR REPLACE сохраняет права); текст берётся из текущего
-- определения, сверенного по контрольной сумме.
do $$
declare
  v_def text := pg_get_viewdef('public.territories_with_stats'::regclass, true);
begin
  if md5(v_def) <> '3374e0b51a1ab7361802ca191c2af887' then
    raise exception 'territories_with_stats changed since inspection';
  end if;
  v_def := rtrim(v_def, E'; \n');
  v_def := replace(v_def, 'END AS capturer_id',
    'END AS capturer_id, ( SELECT max(hs.ends_at) AS max FROM hot_sectors hs WHERE hs.territory_id = t.id AND now() >= hs.starts_at AND now() < hs.ends_at) AS hot_until');
  execute 'create or replace view public.territories_with_stats as ' || v_def;
end $$;
