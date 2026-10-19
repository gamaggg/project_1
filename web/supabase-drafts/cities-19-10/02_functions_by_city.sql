-- Функции читают город из city_config вместо «если москва, то M, иначе B» (20.10.2026).
--
-- Переписывается 27 функций и представление territories_with_stats одним и тем же механическим приёмом (текст определения функции
-- из pg_get_functiondef, подстановки по образцу, CREATE OR REPLACE — права и значения по
-- умолчанию сохраняются). Перед этим старые определения целиком кладутся в
-- public._city_migration_backup: откат (02_functions_by_city_ROLLBACK.sql) выполняет их обратно.
--
-- Образцы:
--   case when X = 'moscow' then 'M' else 'B' end                    -> _city_prefix(X)
--   case X when 'moscow' then 'M' else 'B' end                      -> _city_prefix(X)
--   case when left(X, 1) = 'M' then 'moscow' else 'batumi' end      -> _prefix_city(left(X, 1))
--   case when p_city_prefix = 'M' then 'moscow' else 'batumi' end   -> _prefix_city(p_city_prefix)
--   case [when] X [=] 'moscow' then 'Europe/Moscow' else 'Asia/Tbilisi' end -> _city_tz(X)
--   case when X = 'moscow' then 'frame_som' else 'frame_katran' end -> _city_frame(X)
--   in ('batumi', 'moscow')                                         -> in (select id from city_config)
--   case p_city when 'moscow' then 'Москве' else 'Батуми' end       -> _city_name_in(p_city)
-- и точечно в _sync_achievements_for_user (тема «fresh» вместо «москва»).
--
-- Требует 01_city_config.sql.

create table if not exists public._city_migration_backup (
  fn_oid oid not null,
  proname text not null,
  def text not null,
  saved_at timestamptz not null default now()
);
alter table public._city_migration_backup enable row level security;
revoke all on public._city_migration_backup from anon, authenticated;

do $mig$
declare
  r record;
  v_new text;
  v_changed int := 0;
  v_names text[] := array[
    '_challenge_progress_new', '_clan_member_left_shares', '_clan_week_events', '_geo_catch_bonus',
    '_geo_supply_alert', '_sync_achievements_for_user', 'admin_set_territory_kind', 'announce_hot_sectors',
    'buy_extra_challenge', 'confirm_catch', 'get_catch_comments', 'get_city_feed', 'get_city_pulse',
    'get_city_week_recap', 'get_clan', 'get_sector_insights', 'get_slot_state', 'list_clans',
    'log_app_events', 'notification_deliver_after_from', 'onboarding_due', 'pick_hot_sectors',
    'queue_bite_forecast', 'spin_slots', 'submit_geo_guess', 'swap_challenge', 'sync_my_challenges'
  ];
begin
  for r in
    select p.oid as fn_oid, p.proname, pg_get_functiondef(p.oid) as def
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = any (v_names)
    order by p.proname
  loop
    insert into public._city_migration_backup (fn_oid, proname, def) values (r.fn_oid, r.proname, r.def);
    v_new := r.def;

    v_new := regexp_replace(v_new, 'case when ([^\n]+?) = ''moscow'' then ''M'' else ''B'' end', 'public._city_prefix(\1)', 'g');
    v_new := regexp_replace(v_new, 'case ([a-zA-Z_.]+) when ''moscow'' then ''M'' else ''B'' end', 'public._city_prefix(\1)', 'g');
    v_new := regexp_replace(v_new, 'case when left\(([^\n]+?), 1\) = ''M'' then ''moscow'' else ''batumi'' end', 'public._prefix_city(left(\1, 1))', 'g');
    v_new := regexp_replace(v_new, 'case when ([a-zA-Z_.]+) = ''M'' then ''moscow'' else ''batumi'' end', 'public._prefix_city(\1)', 'g');
    v_new := regexp_replace(v_new, 'case when ([^\n]+?) = ''moscow'' then ''Europe/Moscow'' else ''Asia/Tbilisi'' end', 'public._city_tz(\1)', 'g');
    v_new := regexp_replace(v_new, 'case ([a-zA-Z_.]+) when ''moscow'' then ''Europe/Moscow'' else ''Asia/Tbilisi'' end', 'public._city_tz(\1)', 'g');
    v_new := regexp_replace(v_new, 'case when ([^\n]+?) = ''moscow'' then ''frame_som'' else ''frame_katran'' end', 'public._city_frame(\1)', 'g');
    v_new := replace(v_new, 'case p_city when ''moscow'' then ''Москве'' else ''Батуми'' end', 'public._city_name_in(p_city)');
    v_new := replace(v_new, 'in (''batumi'', ''moscow'')', 'in (select cc.id from public.city_config cc)');
    v_new := replace(v_new, 'not in (''batumi'', ''moscow'')', 'not in (select cc.id from public.city_config cc)');

    if r.proname = '_sync_achievements_for_user' then
      -- The freshwater variant of the achievements follows the city's theme, its time zone,
      -- water kinds and id prefix come from city_config.
      v_new := replace(v_new, 'v_is_moscow := v_city = ''moscow'';', 'v_is_moscow := public._city_theme(v_city) = ''fresh'';');
      v_new := replace(v_new, 'v_tz := case when v_is_moscow then ''Europe/Moscow'' else ''Asia/Tbilisi'' end;', 'v_tz := public._city_tz(v_city);');
      v_new := replace(v_new, 'v_required_kinds := case when v_is_moscow then array[''river'',''lake'',''pond''] else array[''sea'',''river'',''lake'',''pond''] end;', 'v_required_kinds := public._city_water_kinds(v_city);');
      v_new := replace(v_new, 'c.territory_id like ''M%''', 'c.territory_id like public._city_prefix(v_city) || ''%''');
    end if;

    if v_new <> r.def then
      execute v_new;
      v_changed := v_changed + 1;
    end if;
  end loop;

  -- Nothing hard-wired to «moscow» may remain in these functions (comments aside).
  perform 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = any (v_names)
    and p.proname <> 'sync_my_challenges' -- старые недели без city угадывает по часу начала: оставлено как есть
    and regexp_replace(pg_get_functiondef(p.oid), '--[^\n]*', '', 'g') ~ '''moscow''|''Europe/Moscow''|''frame_som''';
  if found then
    raise exception 'a function still names moscow: %', (
      select string_agg(p.proname, ', ') from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = any (v_names) and p.proname <> 'sync_my_challenges'
        and regexp_replace(pg_get_functiondef(p.oid), '--[^\n]*', '', 'g') ~ '''moscow''|''Europe/Moscow''|''frame_som''');
  end if;
  raise notice 'functions rewritten: %', v_changed;
end
$mig$;

-- Представление: клан владельца сектора ищется среди членов клана ЭТОГО города.
-- CREATE OR REPLACE оставляет права; параметров (reloptions) у него нет.
do $view$
declare
  v_def text;
  v_new text;
begin
  v_def := pg_get_viewdef('public.territories_with_stats'::regclass, true);
  v_new := regexp_replace(v_def,
    'CASE\s+WHEN\s+"left"\(t\.id,\s*1\)\s*=\s*''M''::text\s+THEN\s+''moscow''::text\s+ELSE\s+''batumi''::text\s+END',
    'public._prefix_city("left"(t.id, 1))');
  if v_new = v_def then
    raise exception 'territories_with_stats: the CASE for the city was not found';
  end if;
  insert into public._city_migration_backup (fn_oid, proname, def)
  values ('public.territories_with_stats'::regclass::oid, 'territories_with_stats', 'create or replace view public.territories_with_stats as ' || v_def);
  execute 'create or replace view public.territories_with_stats as ' || v_new;
end
$view$;

