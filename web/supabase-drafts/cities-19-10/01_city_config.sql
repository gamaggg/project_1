-- Города: одна таблица вместо «если москва, то M, иначе B» в сорока функциях (20.10.2026).
-- Добавить город = строка в city_config + сектора в territories + регулярные задания.
--
--  id            идентификатор города (profiles.city, clans.city, …)
--  prefix        буква id секторов (B0001, M2065, P0001 …)
--  tz            часовой пояс города: неделя, рейтинг и задания считаются по нему
--  theme         sea — морские и пресные виды (Батуми, Сочи); fresh — хищные и мирные (Москва,
--                Петербург, Тбилиси). Тема выбирает набор достижений
--  jackpot_frame рамка джекпота слотов
--  water_kinds   виды воды на карте города
--  name_in       город в предложном падеже для текстов («в Москве»: «Москве»)
--
-- Откат: 01_city_config_ROLLBACK.sql

create table public.city_config (
  id text primary key,
  prefix text not null unique check (length(prefix) = 1),
  tz text not null,
  theme text not null check (theme in ('sea', 'fresh')),
  jackpot_frame text not null,
  water_kinds text[] not null,
  name_in text not null
);

insert into public.city_config (id, prefix, tz, theme, jackpot_frame, water_kinds, name_in) values
  ('batumi',  'B', 'Asia/Tbilisi',   'sea',   'frame_katran', array['sea','river','lake','pond'], 'Батуми'),
  ('moscow',  'M', 'Europe/Moscow',  'fresh', 'frame_som',    array['river','lake','pond'],       'Москве'),
  ('spb',     'P', 'Europe/Moscow',  'fresh', 'frame_som',    array['sea','river','lake','pond'], 'Петербурге'),
  ('sochi',   'S', 'Europe/Moscow',  'sea',   'frame_katran', array['sea','river','lake','pond'], 'Сочи'),
  ('tbilisi', 'T', 'Asia/Tbilisi',   'fresh', 'frame_som',    array['river','lake','pond'],       'Тбилиси');

-- Только чтение; пишет её миграция.
alter table public.city_config enable row level security;
create policy city_config_read on public.city_config for select using (true);
revoke all on public.city_config from anon, authenticated;
grant select on public.city_config to anon, authenticated, service_role;

-- Помощники: функции читают город отсюда (stable, чтобы планировщик не вычислял их на каждую строку).
create or replace function public._city_prefix(p_city text) returns text
  language sql stable set search_path to 'public'
  as $$ select coalesce((select c.prefix from public.city_config c where c.id = p_city), 'B') $$;

create or replace function public._prefix_city(p_prefix text) returns text
  language sql stable set search_path to 'public'
  as $$ select coalesce((select c.id from public.city_config c where c.prefix = p_prefix), 'batumi') $$;

create or replace function public._city_tz(p_city text) returns text
  language sql stable set search_path to 'public'
  as $$ select coalesce((select c.tz from public.city_config c where c.id = p_city), 'Asia/Tbilisi') $$;

create or replace function public._city_theme(p_city text) returns text
  language sql stable set search_path to 'public'
  as $$ select coalesce((select c.theme from public.city_config c where c.id = p_city), 'sea') $$;

create or replace function public._city_frame(p_city text) returns text
  language sql stable set search_path to 'public'
  as $$ select coalesce((select c.jackpot_frame from public.city_config c where c.id = p_city), 'frame_katran') $$;

create or replace function public._city_water_kinds(p_city text) returns text[]
  language sql stable set search_path to 'public'
  as $$ select coalesce((select c.water_kinds from public.city_config c where c.id = p_city), array['sea','river','lake','pond']) $$;

create or replace function public._city_name_in(p_city text) returns text
  language sql stable set search_path to 'public'
  as $$ select coalesce((select c.name_in from public.city_config c where c.id = p_city), 'Батуми') $$;

-- Семь проверок «city in (batumi, moscow)» становятся внешним ключом на city_config: новый
-- город больше не требует правки таблиц. NULL по-прежнему допустим там, где был допустим.
alter table public.app_events      drop constraint app_events_city_check,      add constraint app_events_city_fkey      foreign key (city)       references public.city_config (id);
alter table public.challenges      drop constraint challenges_city_scope_check, add constraint challenges_city_scope_fkey foreign key (city_scope) references public.city_config (id);
alter table public.clans           drop constraint clans_city_check,           add constraint clans_city_fkey           foreign key (city)       references public.city_config (id);
alter table public.forecast_alerts drop constraint forecast_alerts_city_check, add constraint forecast_alerts_city_fkey foreign key (city)       references public.city_config (id);
alter table public.geo_panoramas   drop constraint geo_panoramas_city_check,   add constraint geo_panoramas_city_fkey   foreign key (city)       references public.city_config (id);
alter table public.hot_sectors     drop constraint hot_sectors_city_check,     add constraint hot_sectors_city_fkey     foreign key (city)       references public.city_config (id);
alter table public.profiles        drop constraint profiles_city_check,        add constraint profiles_city_fkey        foreign key (city)       references public.city_config (id);

-- «Двустихийник» (улов в море и на реке) был только батумским: Сочи и Петербург тоже на
-- море, им та же карточка.
insert into public.challenges (id, tier, name, description, metric, target, params, coin_reward, city_scope, sort_order)
select c.id || '_' || v.city, c.tier, c.name, c.description, c.metric, c.target, c.params, c.coin_reward, v.city, c.sort_order
from public.challenges c cross join (values ('sochi'), ('spb')) as v(city)
where c.id = 'dvustihiynik';
