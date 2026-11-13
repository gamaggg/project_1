-- Значок точки партнёра на карте (14.11.2026, просьба владельца): готовый (shop, sauna, boat, cafe, camp, fish) или свой SVG.
-- Свой SVG хранится текстом прямо в строке (до 20 000 знаков) и показывается в приложении только как картинка
-- (<img src="data:image/svg+xml,…">), поэтому скрипты внутри не выполняются; на всякий случай база не принимает SVG
-- со <script>, javascript:, <foreignObject> и обработчиками on…= (форма их и так вырезает).
-- partner_points_live() отдаёт новый столбец icon: тип результата меняется, поэтому DROP + CREATE (параметров нет,
-- значений по умолчанию терять нечего), права выдаются заново. admin_partner_point_save пишет icon из p->>'icon'.
-- Откат: 02_partner_icon_ROLLBACK.sql

set local lock_timeout = '3s';

alter table public.partner_points add column icon text check (
  icon is null
  or icon in ('shop', 'sauna', 'boat', 'cafe', 'camp', 'fish')
  or (icon like '<svg%' and char_length(icon) <= 20000 and icon !~* '<script|javascript:|<foreignobject|\son[a-z]+\s*=')
);

drop function public.partner_points_live();
create function public.partner_points_live()
returns table (
  id bigint, city text, plan text, name text, kind text, description text, hours text, address text,
  lat double precision, lng double precision, phone text, website text, photos text[],
  promo_code text, promo_discount text, promo_terms text, prize_title text, prize_from text, prize_weeks date[],
  ends_at timestamptz, icon text
)
language sql stable security definer set search_path = public
as $f$
  select p.id, p.city, p.plan, p.name, p.kind, p.description, p.hours, p.address, p.lat, p.lng, p.phone, p.website, p.photos,
         p.promo_code, p.promo_discount, p.promo_terms,
         case when p.plan = 'partner' then p.prize_title end,
         case when p.plan = 'partner' then coalesce(p.prize_from, p.name) end,
         case when p.plan = 'partner' then p.prize_weeks else '{}'::date[] end,
         p.ends_at, p.icon
  from public.partner_points p
  where not p.paused and p.starts_at <= now() and p.ends_at > now()
  order by p.id;
$f$;
revoke all on function public.partner_points_live() from public;
grant execute on function public.partner_points_live() to anon, authenticated;

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
      starts_at, ends_at, paused, created_by, icon
    ) values (
      v_city, v_plan, v_name, nullif(trim(p->>'kind'), ''), nullif(trim(p->>'description'), ''), nullif(trim(p->>'hours'), ''),
      nullif(trim(p->>'address'), ''), (p->>'lat')::double precision, (p->>'lng')::double precision,
      nullif(trim(p->>'phone'), ''), nullif(trim(p->>'website'), ''), v_photos,
      nullif(trim(p->>'promo_code'), ''), nullif(trim(p->>'promo_discount'), ''), nullif(trim(p->>'promo_terms'), ''),
      nullif(trim(p->>'prize_title'), ''), nullif(trim(p->>'prize_from'), ''), v_weeks,
      v_starts, v_ends, coalesce((p->>'paused')::boolean, false), v_admin, nullif(trim(p->>'icon'), '')
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
      starts_at = v_starts, ends_at = v_ends, paused = coalesce((p->>'paused')::boolean, false), icon = nullif(trim(p->>'icon'), ''), updated_at = now()
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

insert into supabase_migrations.schema_migrations (version, name, statements)
values (to_char(clock_timestamp() at time zone 'utc', 'YYYYMMDDHH24MISS'), 'partner_icon_14_11', array[current_query()]);
