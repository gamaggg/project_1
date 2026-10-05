-- Погода во время улова: один раз берётся из архива Open-Meteo по месту сектора и часу улова
-- (маршрут /api/catch-conditions, ключ service_role) и дальше просто читается.
-- Уловы видны всем — погода к ним тоже. Пишет только сервер.
create table public.catch_conditions (
  catch_id bigint primary key references public.catches(id) on delete cascade,
  air_temp real,
  water_temp real,          -- только у моря (температура поверхности моря)
  wind real,                -- м/с
  wind_dir smallint check (wind_dir between 0 and 360),
  gusts real,
  pressure real,            -- гПа, на уровне моря
  pressure_trend real,      -- гПа за 3 часа до улова
  wave real,                -- м, только у моря
  weather_code smallint,
  fetched_at timestamptz not null default now()
);
alter table public.catch_conditions enable row level security;
create policy "catch conditions readable by anyone" on public.catch_conditions for select to anon, authenticated using (true);
revoke all on public.catch_conditions from public, anon, authenticated;
grant select on public.catch_conditions to anon, authenticated;
grant all on public.catch_conditions to service_role;
