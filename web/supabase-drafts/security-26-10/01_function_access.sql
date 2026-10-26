-- Закрытие функций базы от анонимных вызовов (аудит 26.10.2026).
-- Проблема: у функций, созданных до осени, выдача EXECUTE шла через PUBLIC, поэтому любой с публичным ключом сайта
-- мог вызвать их через /rest/v1/rpc/…: рассылки и недельные награды (grant_*_awards, notify_*) без всякой проверки,
-- а все остальные (покупки, админские, фиксация улова) упирались только в проверку внутри функции.
--
-- 1) «Внутренние» функции: их зовёт только cron (от postgres) и триггеры. Снимаем EXECUTE у PUBLIC, anon, authenticated.
--    service_role и postgres остаются.
-- 2) Все остальные SECURITY DEFINER функции с доступом у anon: снимаем у PUBLIC и anon, у authenticated оставляем.
--    Исключение, которое гостю нужно: get_share_preview, get_catch_comments, list_clans, get_clan_chest, get_clan,
--    log_app_events (воронка новичка считается до регистрации).
-- Откат: 01_function_access_ROLLBACK.sql.
do $do$
declare
  r record;
  v_internal text[] := array[
    'grant_all_weekly_awards','grant_catch_of_month_awards','grant_duelist_awards','grant_guardian_awards',
    'grant_lightning_awards','grant_night_watch_awards','grant_season_legend_awards','grant_weekly_rank_awards',
    'notify_challenge_deadline_approaching','notify_weekly_results','compute_challenge_progress','coin_multiplier',
    'buy_shield','spin_wheel','fanout_activity_notification','fanout_award_notification','fanout_new_follower',
    'notify_catch_like','queue_telegram_notification'
  ];
  v_anon_keep text[] := array['get_share_preview','get_catch_comments','list_clans','get_clan_chest','get_clan','log_app_events'];
  n_int int := 0;
  n_anon int := 0;
begin
  for r in
    select p.oid::regprocedure as sig
    from pg_proc p
    where p.pronamespace = 'public'::regnamespace and p.prokind = 'f' and p.prosecdef and p.proname = any(v_internal)
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', r.sig);
    n_int := n_int + 1;
  end loop;

  for r in
    select p.oid::regprocedure as sig
    from pg_proc p
    where p.pronamespace = 'public'::regnamespace and p.prokind = 'f' and p.prosecdef
      and has_function_privilege('anon', p.oid, 'EXECUTE')
      and not (p.proname = any(v_internal)) and not (p.proname = any(v_anon_keep))
  loop
    execute format('revoke execute on function %s from public, anon', r.sig);
    n_anon := n_anon + 1;
  end loop;

  raise notice 'внутренних закрыто: %, закрыто у anon: %', n_int, n_anon;
end
$do$;
