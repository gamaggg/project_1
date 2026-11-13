-- Точки партнёров на карте (13.11.2026): магазины, бани, прокат и другие места, которые купили тариф на странице
-- /partners. Суперадмин добавляет их в приложении (Профиль → «Точки партнёров»), игроки видят метку на карте и
-- карточку с фото, маршрутом, звонком, сайтом, адресом и промокодом. Тариф «Партнёр» добавляет приз недели:
-- он показывается в рейтинге недели города в выбранные недели.
--
-- Срок: точка видна с 00:00 дня «start» (по времени города) до 00:00 дня start + days и пропадает сама,
-- без фоновых задач: чтение берёт только строки, где сейчас между starts_at и ends_at.
--
-- Доступ:
--   partner_points_live()               — anon и authenticated: действующие точки (для карты);
--   partner_prize_of_week(city, monday) — anon и authenticated: приз недели города (для рейтинга и итогов недели);
--   admin_partner_point_save(id, jsonb) — только суперадмин, пишет в admin_actions;
--   admin_partner_point_delete(id)      — только суперадмин, пишет в admin_actions;
--   сама таблица: select только суперадмину (RLS), запись только через функции.
--
-- Откат: 01_partner_points_ROLLBACK.sql

set local lock_timeout = '3s';

create table public.partner_points (
  id bigint generated always as identity primary key,
  city text not null references public.city_config (id),
  plan text not null default 'start' check (plan in ('start', 'partner')),
  name text not null check (char_length(name) between 1 and 60),
  kind text check (kind is null or char_length(kind) <= 60),
  description text check (description is null or char_length(description) <= 600),
  hours text check (hours is null or char_length(hours) <= 80),
  address text check (address is null or char_length(address) <= 160),
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),
  phone text check (phone is null or char_length(phone) <= 40),
  website text check (website is null or (char_length(website) <= 300 and website ~* '^https?://')),
  photos text[] not null default '{}' check (cardinality(photos) <= 6),
  promo_code text check (promo_code is null or char_length(promo_code) <= 32),
  promo_discount text check (promo_discount is null or char_length(promo_discount) <= 20),
  promo_terms text check (promo_terms is null or char_length(promo_terms) <= 300),
  prize_title text check (prize_title is null or char_length(prize_title) <= 80),
  prize_from text check (prize_from is null or char_length(prize_from) <= 60),
  -- Понедельники недель, в которые точка дарит приз недели (по времени города). Одна неделя города — один приз.
  prize_weeks date[] not null default '{}',
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  paused boolean not null default false,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

create index partner_points_live_idx on public.partner_points (ends_at) where not paused;

alter table public.partner_points enable row level security;
create policy partner_points_super_admin_read on public.partner_points for select to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_super_admin));
revoke all on public.partner_points from anon, authenticated;
grant select on public.partner_points to authenticated;
grant all on public.partner_points to service_role;

-- Действующие точки для карты (все города: точек мало, карта может уйти в любой город).
create or replace function public.partner_points_live()
returns table (
  id bigint, city text, plan text, name text, kind text, description text, hours text, address text,
  lat double precision, lng double precision, phone text, website text, photos text[],
  promo_code text, promo_discount text, promo_terms text, prize_title text, prize_from text, prize_weeks date[],
  ends_at timestamptz
)
language sql stable security definer set search_path = public
as $f$
  select p.id, p.city, p.plan, p.name, p.kind, p.description, p.hours, p.address, p.lat, p.lng, p.phone, p.website, p.photos,
         p.promo_code, p.promo_discount, p.promo_terms,
         case when p.plan = 'partner' then p.prize_title end,
         case when p.plan = 'partner' then coalesce(p.prize_from, p.name) end,
         case when p.plan = 'partner' then p.prize_weeks else '{}'::date[] end,
         p.ends_at
  from public.partner_points p
  where not p.paused and p.starts_at <= now() and p.ends_at > now()
  order by p.id;
$f$;
revoke all on function public.partner_points_live() from public;
grant execute on function public.partner_points_live() to anon, authenticated;

-- Приз недели города: точка с тарифом «Партнёр», у которой эта неделя в списке и которая была на карте
-- хотя бы часть этой недели (так приз прошлой недели виден в итогах, даже если точка уже снята).
create or replace function public.partner_prize_of_week(p_city text, p_week date)
returns table (point_id bigint, name text, prize_title text, prize_from text, lat double precision, lng double precision, address text)
language sql stable security definer set search_path = public
as $f$
  select p.id, p.name, p.prize_title, coalesce(p.prize_from, p.name), p.lat, p.lng, p.address
  from public.partner_points p
  join public.city_config c on c.id = p.city
  where p.city = p_city and p.plan = 'partner' and not p.paused and p.prize_title is not null
    and p_week = any (p.prize_weeks)
    and p.starts_at < ((p_week + 7)::timestamp at time zone c.tz)
    and p.ends_at > (p_week::timestamp at time zone c.tz)
  order by p.id
  limit 1;
$f$;
revoke all on function public.partner_prize_of_week(text, date) from public;
grant execute on function public.partner_prize_of_week(text, date) to anon, authenticated;

-- Создать (p_id = null) или изменить точку. p — объект с полями таблицы, плюс:
--   start — день начала 'YYYY-MM-DD' (по времени города), days — сколько дней показывать (1–366).
-- Возвращает id точки. Ошибки: PARTNER:not_authorized, PARTNER:not_found, PARTNER:bad_city, PARTNER:bad_days,
-- PARTNER:bad_coords, PARTNER:prize_needs_title, PARTNER:prize_week_taken.
create or replace function public.admin_partner_point_save(p_id bigint, p jsonb)
returns bigint
language plpgsql security definer set search_path = public
as $f$
declare
  v_admin uuid := auth.uid();
  v_old public.partner_points;
  v_city text := coalesce(nullif(trim(p->>'city'), ''), '');
  v_tz text;
  v_plan text := case when p->>'plan' = 'partner' then 'partner' else 'start' end;
  v_start date;
  v_days int;
  v_weeks date[];
  v_photos text[];
  v_id bigint;
  v_starts timestamptz;
  v_ends timestamptz;
  v_name text := trim(coalesce(p->>'name', ''));
begin
  if v_admin is null or not exists (select 1 from public.profiles where id = v_admin and is_super_admin) then
    raise exception 'PARTNER:not_authorized';
  end if;
  if p_id is not null then
    select * into v_old from public.partner_points where id = p_id for update;
    if v_old.id is null then raise exception 'PARTNER:not_found'; end if;
  end if;
  select tz into v_tz from public.city_config where id = v_city;
  if v_tz is null then raise exception 'PARTNER:bad_city'; end if;
  if (p->>'lat') is null or (p->>'lng') is null then raise exception 'PARTNER:bad_coords'; end if;

  v_days := nullif(p->>'days', '')::int;
  if v_days is null or v_days < 1 or v_days > 366 then raise exception 'PARTNER:bad_days'; end if;
  v_start := coalesce(nullif(p->>'start', '')::date, (now() at time zone v_tz)::date);
  v_starts := v_start::timestamp at time zone v_tz;
  v_ends := (v_start + v_days)::timestamp at time zone v_tz;

  -- Только понедельники, без повторов, по порядку; без тарифа «Партнёр» недель нет.
  select coalesce(array_agg(distinct (date_trunc('week', d::timestamp))::date order by (date_trunc('week', d::timestamp))::date), '{}')
    into v_weeks
    from jsonb_array_elements_text(coalesce(p->'prize_weeks', '[]'::jsonb)) as d
    where v_plan = 'partner';
  if cardinality(v_weeks) > 0 and nullif(trim(p->>'prize_title'), '') is null then
    raise exception 'PARTNER:prize_needs_title';
  end if;
  if exists (
    select 1 from public.partner_points o
    where o.city = v_city and o.plan = 'partner' and o.id is distinct from p_id and o.prize_weeks && v_weeks
  ) then
    raise exception 'PARTNER:prize_week_taken';
  end if;

  select coalesce(array_agg(u), '{}') into v_photos
    from jsonb_array_elements_text(coalesce(p->'photos', '[]'::jsonb)) as u
    where u ~* '^https://';

  if p_id is null then
    insert into public.partner_points (
      city, plan, name, kind, description, hours, address, lat, lng, phone, website, photos,
      promo_code, promo_discount, promo_terms, prize_title, prize_from, prize_weeks,
      starts_at, ends_at, paused, created_by
    ) values (
      v_city, v_plan, v_name, nullif(trim(p->>'kind'), ''), nullif(trim(p->>'description'), ''), nullif(trim(p->>'hours'), ''),
      nullif(trim(p->>'address'), ''), (p->>'lat')::double precision, (p->>'lng')::double precision,
      nullif(trim(p->>'phone'), ''), nullif(trim(p->>'website'), ''), v_photos,
      nullif(trim(p->>'promo_code'), ''), nullif(trim(p->>'promo_discount'), ''), nullif(trim(p->>'promo_terms'), ''),
      nullif(trim(p->>'prize_title'), ''), nullif(trim(p->>'prize_from'), ''), v_weeks,
      v_starts, v_ends, coalesce((p->>'paused')::boolean, false), v_admin
    ) returning id into v_id;
  else
    update public.partner_points set
      city = v_city, plan = v_plan, name = v_name, kind = nullif(trim(p->>'kind'), ''),
      description = nullif(trim(p->>'description'), ''), hours = nullif(trim(p->>'hours'), ''),
      address = nullif(trim(p->>'address'), ''), lat = (p->>'lat')::double precision, lng = (p->>'lng')::double precision,
      phone = nullif(trim(p->>'phone'), ''), website = nullif(trim(p->>'website'), ''), photos = v_photos,
      promo_code = nullif(trim(p->>'promo_code'), ''), promo_discount = nullif(trim(p->>'promo_discount'), ''),
      promo_terms = nullif(trim(p->>'promo_terms'), ''), prize_title = nullif(trim(p->>'prize_title'), ''),
      prize_from = nullif(trim(p->>'prize_from'), ''), prize_weeks = v_weeks,
      starts_at = v_starts, ends_at = v_ends, paused = coalesce((p->>'paused')::boolean, false), updated_at = now()
    where id = p_id
    returning id into v_id;
  end if;

  insert into public.admin_actions (admin_id, action, details)
  values (v_admin, case when p_id is null then 'partner_add' else 'partner_edit' end,
          case when p_id is null then 'Точка партнёра добавлена: ' else 'Точка партнёра изменена: ' end
          || '«' || v_name || '» (' || v_city || ', ' || case when v_plan = 'partner' then 'Партнёр' else 'Старт' end
          || ', до ' || to_char(v_ends at time zone v_tz, 'DD.MM.YYYY') || ')'
          || case when coalesce((p->>'paused')::boolean, false) then ', на паузе' else '' end);
  return v_id;
end;
$f$;
revoke all on function public.admin_partner_point_save(bigint, jsonb) from public, anon;
grant execute on function public.admin_partner_point_save(bigint, jsonb) to authenticated;

create or replace function public.admin_partner_point_delete(p_id bigint)
returns void
language plpgsql security definer set search_path = public
as $f$
declare
  v_admin uuid := auth.uid();
  v_name text;
begin
  if v_admin is null or not exists (select 1 from public.profiles where id = v_admin and is_super_admin) then
    raise exception 'PARTNER:not_authorized';
  end if;
  delete from public.partner_points where id = p_id returning name into v_name;
  if v_name is null then raise exception 'PARTNER:not_found'; end if;
  insert into public.admin_actions (admin_id, action, details)
  values (v_admin, 'partner_delete', 'Точка партнёра удалена: «' || v_name || '»');
end;
$f$;
revoke all on function public.admin_partner_point_delete(bigint) from public, anon;
grant execute on function public.admin_partner_point_delete(bigint) to authenticated;

insert into supabase_migrations.schema_migrations (version, name, statements)
values (to_char(clock_timestamp() at time zone 'utc', 'YYYYMMDDHH24MISS'), 'partner_points_13_11', array[current_query()]);
