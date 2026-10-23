-- Тише тревоги в Telegram: system_health_tick слал тревогу на каждую ошибку игрока, даже когда задет один человек один раз
-- (_system_alert не чаще раза в час на ключ). Теперь два фоновых, ожидаемых вида ошибок тревожат только всплеском
-- (3 и больше за 10 минут): сброс страницы слабыми телефонами `webview_killed` (стабильный фон, 1–2 в час) и сбои
-- серверных маршрутов `api:*` (например, погода у внешнего сервиса отвечает 502 разово). Остальные ошибки как раньше, от одной.
-- Откат: 01_quieter_alerts_ROLLBACK.sql.
do $do$
declare
  v_old text := pg_get_functiondef('public.system_health_tick()'::regprocedure);
  v_new text;
begin
  v_new := replace(v_old,
    E'    where ce.created_at > now() - interval ''10 minutes'' and not ce.network\n    group by ce.context\n',
    E'    where ce.created_at > now() - interval ''10 minutes'' and not ce.network\n    group by ce.context\n    having count(*) >= case when ce.context = ''webview_killed'' then 3 when ce.context like ''api:%'' then 3 else 1 end\n');
  if v_new = v_old then
    raise exception 'system_health_tick: нужный участок не найден';
  end if;
  execute v_new;
end
$do$;
