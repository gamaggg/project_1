-- Отказ игрока не поломка: `geolocation` (code 1 — телефон или Telegram не дали доступ к местоположению) и `camera`
-- (NotAllowedError) пишутся в client_errors для разбора обращений, но будили тревогой от первой же записи.
-- Теперь, как webview_killed и api:*, тревожат только всплеском (5 и больше за 10 минут — это уже похоже на наш баг,
-- например поломку после релиза). Остальные ошибки как раньше, от одной.
-- Откат: 01_player_side_alerts_ROLLBACK.sql.
do $do$
declare
  v_old text := pg_get_functiondef('public.system_health_tick()'::regprocedure);
  v_new text;
begin
  v_new := replace(v_old,
    E'when ce.context like ''api:%'' then 3 else 1 end',
    E'when ce.context like ''api:%'' then 3 when ce.context in (''geolocation'', ''camera'') then 5 else 1 end');
  if v_new = v_old then
    raise exception 'system_health_tick: нужный участок не найден';
  end if;
  execute v_new;
end
$do$;
