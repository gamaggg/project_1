-- Статистика точек партнёров (14.11.2026, просьба владельца): что игроки делают с меткой и карточкой партнёра,
-- и доступ партнёру к статистике его точки со своего аккаунта RANGE.
--
-- partner_point_events — одно действие игрока: нажал метку (pin), открыл карточку (open), «Маршрут» (route),
--   «Позвонить» (call), «Сайт» (site), скопировал адрес (copy_address), скопировал промокод (copy_promo),
--   открыл фото на весь экран (photo). Кто: user_id (вошёл) или device (случайный id телефона из приложения, для гостей).
--   Админы и суперадмин не считаются (иначе проверки владельца портили бы цифры партнёру).
--   Одно и то же действие одного человека на одной точке чаще раза в 10 секунд не пишется (двойные нажатия).
-- partner_point_viewers — кому суперадмин открыл статистику точки (партнёр со своим аккаунтом).
--
-- Функции:
--   partner_point_track(point, kind, device)     — anon и authenticated: записать действие;
--   partner_point_stats(point, from, to)          — суперадмин или тот, кому открыт доступ: цифры за период (jsonb);
--   partner_points_shared_with_me()               — authenticated: точки, статистику которых мне открыли;
--   admin_partner_viewer_set(point, user, on)     — суперадмин: открыть / закрыть доступ, пишет в admin_actions;
--   admin_partner_viewers(point)                  — суперадмин: кому открыт доступ к точке;
--   admin_partner_access_of(user)                 — суперадмин: к каким точкам у игрока есть доступ (для его профиля).
-- Таблицы закрыты целиком (RLS без политик, прав у anon и authenticated нет): только через функции.
-- Откат: 03_partner_stats_ROLLBACK.sql

set local lock_timeout = '3s';

create table public.partner_point_events (
  id bigint generated always as identity primary key,
  point_id bigint not null references public.partner_points (id) on delete cascade,
  kind text not null check (kind in ('pin', 'open', 'route', 'call', 'site', 'copy_address', 'copy_promo', 'photo')),
  user_id uuid references public.profiles (id) on delete set null,
  device text check (device is null or char_length(device) <= 64),
  created_at timestamptz not null default now(),
  check (user_id is not null or device is not null)
);
create index partner_point_events_point_idx on public.partner_point_events (point_id, created_at);
alter table public.partner_point_events enable row level security;
revoke all on public.partner_point_events from anon, authenticated;
grant all on public.partner_point_events to service_role;

create table public.partner_point_viewers (
  point_id bigint not null references public.partner_points (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  granted_by uuid references public.profiles (id) on delete set null,
  granted_at timestamptz not null default now(),
  primary key (point_id, user_id)
);
create index partner_point_viewers_user_idx on public.partner_point_viewers (user_id);
alter table public.partner_point_viewers enable row level security;
revoke all on public.partner_point_viewers from anon, authenticated;
grant all on public.partner_point_viewers to service_role;

create or replace function public.partner_point_track(p_point bigint, p_kind text, p_device text)
returns void
language plpgsql security definer set search_path = public
as $f$
declare
  v_user uuid := auth.uid();
  v_device text := nullif(left(trim(coalesce(p_device, '')), 64), '');
begin
  if p_kind not in ('pin', 'open', 'route', 'call', 'site', 'copy_address', 'copy_promo', 'photo') then return; end if;
  if v_user is null and v_device is null then return; end if;
  if v_user is not null and exists (select 1 from public.profiles where id = v_user and (is_admin or is_super_admin)) then return; end if;
  if not exists (select 1 from public.partner_points where id = p_point and not paused and starts_at <= now() and ends_at > now()) then return; end if;
  if exists (
    select 1 from public.partner_point_events e
    where e.point_id = p_point and e.kind = p_kind and e.created_at > now() - interval '10 seconds'
      and (case when v_user is not null then e.user_id = v_user else e.user_id is null and e.device = v_device end)
  ) then return; end if;
  insert into public.partner_point_events (point_id, kind, user_id, device) values (p_point, p_kind, v_user, v_device);
end;
$f$;
revoke all on function public.partner_point_track(bigint, text, text) from public;
grant execute on function public.partner_point_track(bigint, text, text) to anon, authenticated;

-- Цифры точки за период [p_from, p_to). Человек = вошедший игрок или телефон гостя.
-- totals: по каждому действию — сколько раз и сколько разных людей; funnel: сколько людей открыли карточку, сколько из них
-- скопировали промокод, и сколько из скопировавших потом (позже по времени) нажали «Маршрут», «Позвонить», «Сайт»;
-- days: по дням (время города) — нажатия метки, открытия, копирования промокода.
create or replace function public.partner_point_stats(p_point bigint, p_from timestamptz, p_to timestamptz)
returns jsonb
language plpgsql stable security definer set search_path = public
as $f$
declare
  v_user uuid := auth.uid();
  v_tz text;
  v_res jsonb;
begin
  if v_user is null or not (
    exists (select 1 from public.profiles where id = v_user and is_super_admin)
    or exists (select 1 from public.partner_point_viewers where point_id = p_point and user_id = v_user)
  ) then
    raise exception 'PARTNER:not_authorized';
  end if;
  select c.tz into v_tz from public.partner_points p join public.city_config c on c.id = p.city where p.id = p_point;
  if v_tz is null then raise exception 'PARTNER:not_found'; end if;

  with ev as (
    select e.kind, e.created_at, coalesce(e.user_id::text, 'd:' || e.device) as who
    from public.partner_point_events e
    where e.point_id = p_point and e.created_at >= p_from and e.created_at < p_to
  ),
  totals as (
    select jsonb_object_agg(k.kind, jsonb_build_object('count', coalesce(t.n, 0), 'people', coalesce(t.people, 0))) as j
    from unnest(array['pin', 'open', 'route', 'call', 'site', 'copy_address', 'copy_promo', 'photo']) as k(kind)
    left join (select kind, count(*) as n, count(distinct who) as people from ev group by kind) t on t.kind = k.kind
  ),
  first_copy as (select who, min(created_at) as at from ev where kind = 'copy_promo' group by who),
  funnel as (
    select jsonb_build_object(
      'opened', (select count(distinct who) from ev where kind in ('open', 'pin')),
      'copied', (select count(*) from first_copy),
      'copied_then_route', (select count(distinct f.who) from first_copy f join ev e on e.who = f.who and e.kind = 'route' and e.created_at > f.at),
      'copied_then_call', (select count(distinct f.who) from first_copy f join ev e on e.who = f.who and e.kind = 'call' and e.created_at > f.at),
      'copied_then_site', (select count(distinct f.who) from first_copy f join ev e on e.who = f.who and e.kind = 'site' and e.created_at > f.at),
      'copied_then_any', (select count(distinct f.who) from first_copy f join ev e on e.who = f.who and e.kind in ('route', 'call', 'site') and e.created_at > f.at)
    ) as j
  ),
  days as (
    select coalesce(jsonb_agg(jsonb_build_object('day', d, 'pin', pin, 'open', open, 'copy_promo', copy_promo) order by d), '[]'::jsonb) as j
    from (
      select (created_at at time zone v_tz)::date as d,
             count(*) filter (where kind = 'pin') as pin,
             count(*) filter (where kind = 'open') as open,
             count(*) filter (where kind = 'copy_promo') as copy_promo
      from ev group by 1
    ) x
  )
  select jsonb_build_object(
    'point_id', p_point,
    'tz', v_tz,
    'people', (select count(distinct who) from ev),
    'totals', (select j from totals),
    'funnel', (select j from funnel),
    'days', (select j from days)
  ) into v_res;
  return v_res;
end;
$f$;
revoke all on function public.partner_point_stats(bigint, timestamptz, timestamptz) from public, anon;
grant execute on function public.partner_point_stats(bigint, timestamptz, timestamptz) to authenticated;

create or replace function public.partner_points_shared_with_me()
returns table (id bigint, city text, name text, starts_at timestamptz, ends_at timestamptz, paused boolean)
language sql stable security definer set search_path = public
as $f$
  select p.id, p.city, p.name, p.starts_at, p.ends_at, p.paused
  from public.partner_point_viewers v join public.partner_points p on p.id = v.point_id
  where v.user_id = auth.uid()
  order by p.id;
$f$;
revoke all on function public.partner_points_shared_with_me() from public, anon;
grant execute on function public.partner_points_shared_with_me() to authenticated;

create or replace function public.admin_partner_viewer_set(p_point bigint, p_user uuid, p_on boolean)
returns void
language plpgsql security definer set search_path = public
as $f$
declare
  v_admin uuid := auth.uid();
  v_point text;
  v_name text;
begin
  if v_admin is null or not exists (select 1 from public.profiles where id = v_admin and is_super_admin) then
    raise exception 'PARTNER:not_authorized';
  end if;
  select name into v_point from public.partner_points where id = p_point;
  if v_point is null then raise exception 'PARTNER:not_found'; end if;
  select coalesce(display_name, 'Игрок') into v_name from public.profiles where id = p_user;
  if v_name is null then raise exception 'PARTNER:no_user'; end if;
  if p_on then
    insert into public.partner_point_viewers (point_id, user_id, granted_by) values (p_point, p_user, v_admin) on conflict do nothing;
  else
    delete from public.partner_point_viewers where point_id = p_point and user_id = p_user;
  end if;
  insert into public.admin_actions (admin_id, action, target_user_id, details)
  values (v_admin, case when p_on then 'partner_stats_grant' else 'partner_stats_revoke' end, p_user,
          case when p_on then 'Открыта статистика точки «' else 'Закрыта статистика точки «' end || v_point || '» для ' || v_name);
end;
$f$;
revoke all on function public.admin_partner_viewer_set(bigint, uuid, boolean) from public, anon;
grant execute on function public.admin_partner_viewer_set(bigint, uuid, boolean) to authenticated;

create or replace function public.admin_partner_viewers(p_point bigint)
returns table (user_id uuid, display_name text, avatar_url text, granted_at timestamptz)
language plpgsql stable security definer set search_path = public
as $f$
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and is_super_admin) then
    raise exception 'PARTNER:not_authorized';
  end if;
  return query
    select v.user_id, pr.display_name, pr.avatar_url, v.granted_at
    from public.partner_point_viewers v join public.profiles pr on pr.id = v.user_id
    where v.point_id = p_point
    order by v.granted_at;
end;
$f$;
revoke all on function public.admin_partner_viewers(bigint) from public, anon;
grant execute on function public.admin_partner_viewers(bigint) to authenticated;

create or replace function public.admin_partner_access_of(p_user uuid)
returns table (point_id bigint)
language plpgsql stable security definer set search_path = public
as $f$
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and is_super_admin) then
    raise exception 'PARTNER:not_authorized';
  end if;
  return query select v.point_id from public.partner_point_viewers v where v.user_id = p_user;
end;
$f$;
revoke all on function public.admin_partner_access_of(uuid) from public, anon;
grant execute on function public.admin_partner_access_of(uuid) to authenticated;

insert into supabase_migrations.schema_migrations (version, name, statements)
values (to_char(clock_timestamp() at time zone 'utc', 'YYYYMMDDHH24MISS'), 'partner_stats_14_11', array[current_query()]);
