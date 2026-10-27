-- «Лимиты сервисов» в профиле: экран для супер-админа и для админа с переключателем can_view_limits.
-- 1) флаг can_view_limits на profiles (тот же путь, что can_view_stats: колонка, маска во view, admin_set_admin, get_admin_permissions);
-- 2) таблица service_limits_manual: значения из панелей Supabase и Vercel (в базе их нет), их обновляет /limits;
-- 3) get_service_limits(): одним вызовом отдаёт «живые» числа из базы и значения из таблицы выше.
-- Откат: 01_service_limits_ROLLBACK.sql.

alter table public.profiles add column can_view_limits boolean not null default false;

-- Представление: тот же текст, что сейчас в базе, плюс can_view_limits в конце (CREATE OR REPLACE сохраняет права).
do $do$
declare
  v_old text := pg_get_viewdef('public.profiles_with_stats'::regclass);
  v_new text;
begin
  v_old := rtrim(v_old, E';\n ');
  v_new := replace(v_old,
    E'\n   FROM ((profiles p',
    E',\n        CASE\n            WHEN (p.id = auth.uid()) THEN p.can_view_limits\n            ELSE NULL::boolean\n        END AS can_view_limits\n   FROM ((profiles p');
  if v_new = v_old then raise exception 'profiles_with_stats: место вставки не найдено'; end if;
  execute 'create or replace view public.profiles_with_stats as ' || v_new;
end
$do$;

-- Выдача прав: новый параметр в конце, по умолчанию false (как у остальных).
drop function public.admin_set_admin(uuid, boolean, boolean, boolean, boolean, boolean, boolean, boolean, boolean);
create function public.admin_set_admin(
  p_user_id uuid,
  p_is_admin boolean,
  p_can_moderate_reports boolean default false,
  p_can_block_users boolean default false,
  p_can_add_catch_manually boolean default false,
  p_can_view_all_users boolean default false,
  p_can_add_catch_from_gallery boolean default false,
  p_can_review_panoramas boolean default false,
  p_can_view_stats boolean default false,
  p_can_view_limits boolean default false
)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_target_name text; v_perms text := '';
  v_moderate boolean := p_is_admin and p_can_moderate_reports;
  v_block boolean := p_is_admin and p_can_block_users;
  v_catch boolean := p_is_admin and p_can_add_catch_manually;
  v_users boolean := p_is_admin and p_can_view_all_users;
  v_gallery boolean := p_is_admin and p_can_add_catch_from_gallery;
  v_panoramas boolean := p_is_admin and p_can_review_panoramas;
  v_stats boolean := p_is_admin and p_can_view_stats;
  v_limits boolean := p_is_admin and p_can_view_limits;
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and is_super_admin) then raise exception 'not authorized'; end if;
  if p_user_id = auth.uid() then raise exception 'cannot change your own admin status'; end if;
  if exists (select 1 from public.profiles where id = p_user_id and is_super_admin) then raise exception 'cannot change another super admin'; end if;
  select display_name into v_target_name from public.profiles where id = p_user_id;
  if not found then raise exception 'user not found'; end if;
  update public.profiles set is_admin = p_is_admin, can_moderate_reports = v_moderate, can_block_users = v_block, can_add_catch_manually = v_catch,
    can_view_all_users = v_users, can_add_catch_from_gallery = v_gallery, can_review_panoramas = v_panoramas, can_view_stats = v_stats,
    can_view_limits = v_limits
  where id = p_user_id;
  if v_moderate then v_perms := v_perms || 'жалобы, '; end if;
  if v_block then v_perms := v_perms || 'блокировка, '; end if;
  if v_catch then v_perms := v_perms || 'улов без гео, '; end if;
  if v_users then v_perms := v_perms || 'список юзеров, '; end if;
  if v_gallery then v_perms := v_perms || 'улов из галереи, '; end if;
  if v_panoramas then v_perms := v_perms || 'панорамы, '; end if;
  if v_stats then v_perms := v_perms || 'статистика, '; end if;
  if v_limits then v_perms := v_perms || 'лимиты, '; end if;
  v_perms := rtrim(v_perms, ', ');
  insert into public.admin_actions (admin_id, action, target_user_id, details)
  values (auth.uid(), case when p_is_admin then 'grant_admin' else 'revoke_admin' end, p_user_id,
    case when not p_is_admin then 'Забрал права админа у: ' || v_target_name
         when v_perms = '' then 'Выдал права админа: ' || v_target_name || ' (без доп. прав)'
         else 'Выдал права админа: ' || v_target_name || ' (' || v_perms || ')' end);
end; $function$;
revoke all on function public.admin_set_admin(uuid, boolean, boolean, boolean, boolean, boolean, boolean, boolean, boolean, boolean) from public, anon;
grant execute on function public.admin_set_admin(uuid, boolean, boolean, boolean, boolean, boolean, boolean, boolean, boolean, boolean) to authenticated, service_role;

-- Настоящие (не замаскированные) права админа для окна «Права»: новое поле в конце.
drop function public.get_admin_permissions(uuid);
create function public.get_admin_permissions(p_user_id uuid)
 returns table(is_admin boolean, can_moderate_reports boolean, can_block_users boolean, can_add_catch_manually boolean, can_view_all_users boolean, can_add_catch_from_gallery boolean, can_review_panoramas boolean, can_view_stats boolean, can_view_limits boolean)
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and is_super_admin) then raise exception 'not authorized'; end if;
  return query select p.is_admin, p.can_moderate_reports, p.can_block_users, p.can_add_catch_manually, p.can_view_all_users, p.can_add_catch_from_gallery, p.can_review_panoramas, p.can_view_stats, p.can_view_limits
    from public.profiles p where p.id = p_user_id;
end; $function$;
revoke all on function public.get_admin_permissions(uuid) from public, anon;
grant execute on function public.get_admin_permissions(uuid) to authenticated, service_role;

-- Значения из панелей Supabase и Vercel. Читает только get_service_limits (security definer), напрямую недоступна игрокам.
-- period_end пустой = скользящие 30 дней (Vercel), прогноз по дате не считается.
create table public.service_limits_manual (
  key text primary key,
  used numeric not null,
  limit_value numeric not null,
  unit text not null,
  period_start date,
  period_end date,
  enforced boolean not null default true,
  as_of timestamptz not null default now()
);
alter table public.service_limits_manual enable row level security;
revoke all on table public.service_limits_manual from public, anon, authenticated;
grant all on table public.service_limits_manual to service_role;

-- Снимок панелей на 27.10.2026 (расчётный период Supabase 03.10–03.11). Размеры в МБ, процессор в секундах, сборки в минутах.
insert into public.service_limits_manual (key, used, limit_value, unit, period_start, period_end, enforced, as_of) values
  ('supabase_egress',        3046.4, 5120,    'mb',      '2026-10-03', '2026-11-03', true,  '2026-10-27 12:30+00'),
  ('supabase_cached_egress', 1728.5, 5120,    'mb',      '2026-10-03', '2026-11-03', true,  '2026-10-27 12:30+00'),
  ('supabase_logs',          1699.8, 1024,    'mb',      '2026-10-03', '2026-11-03', false, '2026-10-27 12:30+00'),
  ('supabase_mau',           113,    50000,   'count',   '2026-10-03', '2026-11-03', true,  '2026-10-27 12:30+00'),
  ('supabase_realtime_peak', 9,      200,     'count',   '2026-10-03', '2026-11-03', true,  '2026-10-27 12:30+00'),
  ('supabase_realtime_msgs', 26250,  2000000, 'count',   '2026-10-03', '2026-11-03', true,  '2026-10-27 12:30+00'),
  ('vercel_data_transfer',   4618.2, 102400,  'mb',      null, null, true, '2026-10-27 12:30+00'),
  ('vercel_origin_transfer', 764.2,  10240,   'mb',      null, null, true, '2026-10-27 12:30+00'),
  ('vercel_requests',        211000, 1000000, 'count',   null, null, true, '2026-10-27 12:30+00'),
  ('vercel_functions',       35000,  1000000, 'count',   null, null, true, '2026-10-27 12:30+00'),
  ('vercel_cpu',             2495,   14400,   'seconds', null, null, true, '2026-10-27 12:30+00'),
  ('vercel_memory',          28.8,   360,     'gbh',     null, null, true, '2026-10-27 12:30+00'),
  ('vercel_builds',          734,    6000,    'minutes', null, null, true, '2026-10-27 12:30+00'),
  ('vercel_analytics',       5900,   50000,   'count',   null, null, true, '2026-10-27 12:30+00');

-- Один вызов для экрана «Лимиты»: «живое» из базы (файлы, база, соединения, оценки Mapbox/Fishial/Open-Meteo, Telegram) и таблица выше.
create function public.get_service_limits()
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_items jsonb;
  v_storage_mb numeric; v_storage_7d numeric; v_db_mb numeric; v_cron_mb numeric;
  v_open int; v_sectors int; v_confirm int; v_catches int;
  v_stuck int; v_queued int;
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and (is_super_admin or (is_admin and can_view_limits))) then
    raise exception 'not authorized';
  end if;

  select round(coalesce(sum((metadata->>'size')::bigint), 0) / 1048576.0, 1),
         round(coalesce(sum((metadata->>'size')::bigint) filter (where created_at > now() - interval '7 days'), 0) / 1048576.0, 1)
    into v_storage_mb, v_storage_7d from storage.objects;
  v_db_mb := round(pg_database_size(current_database()) / 1048576.0, 1);
  v_cron_mb := round(pg_total_relation_size('cron.job_run_details'::regclass) / 1048576.0, 1);

  select count(*) filter (where name = 'app_open'),
         count(*) filter (where name = 'screen' and props->>'id' = 'screen-territory'),
         count(*) filter (where name = 'screen' and props->>'id' = 'screen-confirm')
    into v_open, v_sectors, v_confirm
    from public.app_events where created_at > now() - interval '7 days';
  select count(*) into v_catches from public.catches where caught_at > now() - interval '7 days';
  select count(*) filter (where created_at > now() - interval '24 hours'),
         count(*) filter (where sent_at is null and deliver_after < now() - interval '15 minutes')
    into v_queued, v_stuck from public.telegram_outbox;

  v_items := jsonb_build_array(
    jsonb_build_object('key', 'storage_files', 'source', 'live', 'unit', 'mb', 'used', v_storage_mb, 'limit', 1024,
      'rate_per_day', round(v_storage_7d / 7.0, 2),
      'detail', (select coalesce(jsonb_agg(x), '[]'::jsonb) from (
        select bucket_id as name, round(sum((metadata->>'size')::bigint) / 1048576.0, 1) as mb,
               round(coalesce(sum((metadata->>'size')::bigint) filter (where created_at > now() - interval '7 days'), 0) / 1048576.0, 1) as mb_7d
        from storage.objects group by bucket_id order by sum((metadata->>'size')::bigint) desc) x)),
    jsonb_build_object('key', 'database', 'source', 'live', 'unit', 'mb', 'used', v_db_mb, 'limit', 500,
      'detail', jsonb_build_object('cron_mb', v_cron_mb)),
    jsonb_build_object('key', 'connections', 'source', 'live', 'unit', 'count',
      'used', (select count(*) from pg_stat_activity),
      'limit', (select setting::int from pg_settings where name = 'max_connections')),
    jsonb_build_object('key', 'mapbox_loads', 'source', 'estimate', 'unit', 'count', 'used', round(v_open * 30 / 7.0), 'limit', 50000),
    jsonb_build_object('key', 'mapbox_tiles', 'source', 'estimate', 'unit', 'count', 'used', round(v_sectors * 9 * 30 / 7.0), 'limit', 200000),
    jsonb_build_object('key', 'fishial', 'source', 'estimate', 'unit', 'count', 'used', round(v_confirm * 30 / 7.0), 'limit', null),
    jsonb_build_object('key', 'open_meteo', 'source', 'estimate', 'unit', 'count', 'used', round(v_catches * 3 / 7.0 + 300), 'limit', 10000),
    jsonb_build_object('key', 'telegram', 'source', 'live', 'unit', 'count', 'used', v_queued, 'limit', null,
      'detail', jsonb_build_object('stuck', v_stuck))
  ) || coalesce((
    select jsonb_agg(jsonb_build_object('key', m.key, 'source', 'manual', 'unit', m.unit, 'used', m.used, 'limit', m.limit_value,
      'period_start', m.period_start, 'period_end', m.period_end, 'enforced', m.enforced, 'as_of', m.as_of))
    from public.service_limits_manual m), '[]'::jsonb);

  return jsonb_build_object('now', now(), 'items', v_items);
end; $function$;
revoke all on function public.get_service_limits() from public, anon;
grant execute on function public.get_service_limits() to authenticated, service_role;
