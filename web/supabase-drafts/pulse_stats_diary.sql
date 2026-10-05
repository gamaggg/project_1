-- Большое обновление, пачка 4 (только новое): «Живой город», своя статистика, дневник рыбака.

-- ===== Живой город: город за 7 дней — уловы, рыбаки, захваты — и последние фото =====
create function public.get_city_pulse(p_city text)
 returns jsonb
 language sql
 stable
 security definer
 set search_path to 'public'
as $function$
  with week as (
    select c.id, c.user_id, c.territory_id, c.species, c.photo_url, c.caught_at
    from public.catches c
    join public.profiles p on p.id = c.user_id and not coalesce(p.is_blocked, false)
    where c.caught_at > now() - interval '7 days'
      and left(c.territory_id, 1) = case when p_city = 'moscow' then 'M' else 'B' end
  )
  select jsonb_build_object(
    'catches', (select count(*) from week),
    'anglers', (select count(distinct user_id) from week),
    'captures', (select count(*) from public.activity_log a
                 join public.profiles p on p.id = a.user_id and not coalesce(p.is_blocked, false)
                 where a.kind = 'claim' and a.created_at > now() - interval '7 days'
                   and left(a.territory_id, 1) = case when p_city = 'moscow' then 'M' else 'B' end),
    'recent', coalesce((
      select jsonb_agg(jsonb_build_object(
        'catch_id', w.id, 'user_id', w.user_id, 'name', p.display_name, 'avatar_url', p.avatar_url,
        'species', s.name, 'photo_url', w.photo_url, 'territory_id', w.territory_id, 'caught_at', w.caught_at
      ) order by w.caught_at desc)
      from (select * from week order by caught_at desc limit 8) w
      join public.profiles p on p.id = w.user_id
      left join public.species s on s.key = w.species
    ), '[]'::jsonb)
  )
  where auth.uid() is not null;
$function$;
revoke all on function public.get_city_pulse(text) from public, anon;
grant execute on function public.get_city_pulse(text) to authenticated, service_role;

-- ===== Статистика: свои события приложения (заходы, экраны, камера, улов, шаги онбординга) =====
-- Пишутся только через log_app_events пачкой; читает только супер-админ через get_app_stats.
-- device_id — случайный id телефона (localStorage), чтобы считать воронку и до регистрации.
create table public.app_events (
  id bigint generated always as identity primary key,
  device_id uuid not null,
  session_id uuid not null,
  user_id uuid references auth.users(id) on delete set null,
  name text not null check (name ~ '^[a-z][a-z0-9_]{1,39}$'),
  props jsonb not null default '{}'::jsonb,
  city text check (city in ('batumi', 'moscow')),
  client_at timestamptz,
  created_at timestamptz not null default now()
);
create index app_events_created_idx on public.app_events (created_at desc);
create index app_events_user_idx on public.app_events (user_id, created_at desc);
create index app_events_device_idx on public.app_events (device_id, created_at desc);
create index app_events_name_idx on public.app_events (name, created_at desc);
alter table public.app_events enable row level security;
revoke all on public.app_events from public, anon, authenticated;
grant all on public.app_events to service_role;

-- До 100 событий за вызов; телефону — не больше 600 в час, всем вместе — 5000 в минуту:
-- лишнее молча отбрасывается (статистика не должна ломать приложение).
create function public.log_app_events(p_device uuid, p_session uuid, p_events jsonb)
 returns integer
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_n integer;
begin
  if p_device is null or p_session is null or jsonb_typeof(p_events) is distinct from 'array' then
    return 0;
  end if;
  if (select count(*) from public.app_events where device_id = p_device and created_at > now() - interval '1 hour') > 600
     or (select count(*) from public.app_events where created_at > now() - interval '1 minute') > 5000 then
    return 0;
  end if;
  insert into public.app_events (device_id, session_id, user_id, name, props, city, client_at)
  select p_device, p_session, auth.uid(), e->>'name',
         case when jsonb_typeof(e->'props') = 'object' and pg_column_size(e->'props') <= 1024 then e->'props' else '{}'::jsonb end,
         case when e->>'city' in ('batumi', 'moscow') then e->>'city' end,
         case when jsonb_typeof(e->'at') = 'number'
              then greatest(least(to_timestamp((e->>'at')::double precision / 1000), now()), now() - interval '2 days') end
  from (select value as e from jsonb_array_elements(p_events) limit 100) x
  where jsonb_typeof(e) = 'object' and (e->>'name') ~ '^[a-z][a-z0-9_]{1,39}$';
  get diagnostics v_n = row_count;
  return v_n;
end;
$function$;
revoke all on function public.log_app_events(uuid, uuid, jsonb) from public;
grant execute on function public.log_app_events(uuid, uuid, jsonb) to anon, authenticated, service_role;

-- Экран «Статистика» супер-админа: заходы по дням, недельные/месячные, воронка новичков,
-- возвраты, экраны. Дни — по времени p_tz.
create function public.get_app_stats(p_days integer default 30, p_tz text default 'Asia/Tbilisi')
 returns jsonb
 language plpgsql
 stable
 security definer
 set search_path to 'public'
as $function$
declare
  v_days integer := least(greatest(coalesce(p_days, 30), 7), 120);
  v_from date := (now() at time zone p_tz)::date - (v_days - 1);
begin
  if not exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_super_admin) then
    raise exception 'not authorized';
  end if;
  return jsonb_build_object(
    'from', v_from,
    'daily', (
      with days as (
        select d0::date as d from generate_series(v_from, (now() at time zone p_tz)::date, interval '1 day') d0
      ), ev as (
        select (e.created_at at time zone p_tz)::date as d,
               count(distinct coalesce(e.user_id::text, e.device_id::text)) as active,
               count(distinct e.user_id) as signed_in
        from public.app_events e where e.created_at >= (v_from::timestamp at time zone p_tz) group by 1
      ), nu as (
        select (p.created_at at time zone p_tz)::date as d, count(*) as n
        from public.profiles p where p.created_at >= (v_from::timestamp at time zone p_tz) group by 1
      ), ca as (
        select (c.caught_at at time zone p_tz)::date as d, count(*) as n
        from public.catches c where c.caught_at >= (v_from::timestamp at time zone p_tz) group by 1
      )
      select jsonb_agg(jsonb_build_object(
        'day', days.d, 'active', coalesce(ev.active, 0), 'signed_in', coalesce(ev.signed_in, 0),
        'new_users', coalesce(nu.n, 0), 'catches', coalesce(ca.n, 0)
      ) order by days.d)
      from days left join ev using (d) left join nu using (d) left join ca using (d)
    ),
    'wau', (select count(distinct e.user_id) from public.app_events e where e.created_at > now() - interval '7 days' and e.user_id is not null),
    'mau', (select count(distinct e.user_id) from public.app_events e where e.created_at > now() - interval '30 days' and e.user_id is not null),
    'funnel', (
      with cohort as (
        select p.id, p.created_at, p.onboarding_completed from public.profiles p
        where (p.created_at at time zone p_tz)::date >= v_from
      )
      select jsonb_build_object(
        'registered', (select count(*) from cohort),
        'onboarded', (select count(*) from cohort where onboarding_completed),
        'camera', (select count(*) from cohort c where exists (select 1 from public.app_events e where e.user_id = c.id and e.name = 'camera_open')),
        'first_catch', (select count(*) from cohort c where exists (select 1 from public.catches x where x.user_id = c.id)),
        'second_day', (select count(*) from cohort c where exists (
          select 1 from public.app_events e where e.user_id = c.id and e.created_at >= c.created_at + interval '1 day'))
      )
    ),
    'retention', (
      with cohort as (
        select p.id, p.created_at from public.profiles p
        where (p.created_at at time zone p_tz)::date >= v_from and p.created_at < now() - interval '8 days'
      )
      select jsonb_build_object(
        'cohort', (select count(*) from cohort),
        'd1', (select count(*) from cohort c where exists (select 1 from public.app_events e where e.user_id = c.id
                 and e.created_at >= c.created_at + interval '1 day' and e.created_at < c.created_at + interval '2 days')),
        'w1', (select count(*) from cohort c where exists (select 1 from public.app_events e where e.user_id = c.id
                 and e.created_at >= c.created_at + interval '1 day' and e.created_at < c.created_at + interval '8 days'))
      )
    ),
    'screens', coalesce((
      select jsonb_agg(jsonb_build_object('screen', x.screen, 'views', x.n, 'people', x.people) order by x.n desc)
      from (select e.props->>'id' as screen, count(*) as n, count(distinct coalesce(e.user_id::text, e.device_id::text)) as people
            from public.app_events e where e.name = 'screen' and e.created_at > now() - make_interval(days => v_days)
            group by 1 order by 2 desc limit 20) x
    ), '[]'::jsonb),
    'onboarding', coalesce((
      select jsonb_agg(jsonb_build_object('step', x.step, 'devices', x.n) order by x.n desc)
      from (select e.props->>'step' as step, count(distinct e.device_id) as n
            from public.app_events e where e.name = 'onboarding_step' and e.created_at > now() - make_interval(days => v_days)
            group by 1) x
    ), '[]'::jsonb)
  );
end;
$function$;
revoke all on function public.get_app_stats(integer, text) from public, anon;
grant execute on function public.get_app_stats(integer, text) to authenticated, service_role;

-- ===== Дневник рыбака: только владелец видит и меняет =====
-- День рыбалки: заметка и место; строка без уловов в этот день — «рыбалка без улова».
create table public.diary_days (
  user_id uuid not null references public.profiles(id) on delete cascade,
  day date not null,
  note text check (note is null or char_length(note) <= 1000),
  territory_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, day)
);
alter table public.diary_days enable row level security;
create policy "diary days: own only" on public.diary_days for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
revoke all on public.diary_days from public, anon;
grant select, insert, update, delete on public.diary_days to authenticated;
grant all on public.diary_days to service_role;

-- Улов из галереи — только в дневник: не захватывает сектор, без монет и рейтинга.
-- Фото только из своей папки catch-photos/<uid>/diary/.
create table public.diary_catches (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  day date not null,
  caught_at timestamptz not null,
  species text not null references public.species(key),
  length_cm smallint check (length_cm between 1 and 500),
  weight_kg numeric(7,3) check (weight_kg > 0 and weight_kg < 1000),
  photo_url text not null,
  lat double precision check (lat between -90 and 90),
  lng double precision check (lng between -180 and 180),
  territory_id text,
  created_at timestamptz not null default now(),
  constraint diary_catches_photo_own check (
    photo_url like 'https://yhgdcdkfkerzuhnzjzrz.supabase.co/storage/v1/object/public/catch-photos/' || user_id::text || '/diary/%')
);
create index diary_catches_user_day_idx on public.diary_catches (user_id, day desc);
alter table public.diary_catches enable row level security;
create policy "diary catches: own only" on public.diary_catches for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
revoke all on public.diary_catches from public, anon;
grant select, insert, update, delete on public.diary_catches to authenticated;
grant all on public.diary_catches to service_role;
