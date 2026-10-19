-- Откат 01_city_config.sql. Выполнять ПОСЛЕ отката 02 (функции ещё читают city_config) и
-- только пока в таблицах нет городов кроме batumi и moscow.
delete from public.challenges where id in ('dvustihiynik_sochi', 'dvustihiynik_spb');

alter table public.app_events      drop constraint app_events_city_fkey,      add constraint app_events_city_check      check (city = any (array['batumi'::text, 'moscow'::text]));
alter table public.challenges      drop constraint challenges_city_scope_fkey, add constraint challenges_city_scope_check check (city_scope = any (array['batumi'::text, 'moscow'::text]));
alter table public.clans           drop constraint clans_city_fkey,           add constraint clans_city_check           check (city = any (array['batumi'::text, 'moscow'::text]));
alter table public.forecast_alerts drop constraint forecast_alerts_city_fkey, add constraint forecast_alerts_city_check check (city = any (array['batumi'::text, 'moscow'::text]));
alter table public.geo_panoramas   drop constraint geo_panoramas_city_fkey,   add constraint geo_panoramas_city_check   check (city = any (array['batumi'::text, 'moscow'::text]));
alter table public.hot_sectors     drop constraint hot_sectors_city_fkey,     add constraint hot_sectors_city_check     check (city = any (array['batumi'::text, 'moscow'::text]));
alter table public.profiles        drop constraint profiles_city_fkey,        add constraint profiles_city_check        check (city = any (array['batumi'::text, 'moscow'::text]));

-- _city_tz как было (неизменяемая SQL-функция).
create or replace function public._city_tz(p_city text) returns text
  language sql immutable
  as $$ select case when p_city = 'moscow' then 'Europe/Moscow' else 'Asia/Tbilisi' end $$;

drop function public._city_prefix(text), public._prefix_city(text), public._city_theme(text),
  public._city_frame(text), public._city_water_kinds(text), public._city_name_in(text);
drop table public.city_config;
