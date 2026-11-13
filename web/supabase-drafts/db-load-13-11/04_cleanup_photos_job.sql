-- Нагрузка на бесплатный Supabase, блок В (13.11.2026): ночная подчистка брошенных фото уловов.
--
-- Маршрут /api/cron/cleanup-photos (app/api/cron/cleanup-photos/route.ts, lib/server/orphanPhotos.ts) удаляет фото,
-- на которые не ссылается ни улов, ни дневник, старше 2 дней — не больше 200 за ночь. Новых таких ≈40 в неделю.
-- Применять ПОСЛЕ выкладки кода с маршрутом (иначе задача будет стучаться в 404 и поднимет тревогу cron).
--
-- Секрет для маршрута не пишется сюда: команда берётся у существующей задачи telegram-fishing (тот же заголовок
-- Authorization с CRON_SECRET), меняется только адрес. Каждый день в 02:20 UTC (05:20 по Москве).
-- Откат: 04_cleanup_photos_job_ROLLBACK.sql.

do $m$
declare
  cmd text := (select command from cron.job where jobname = 'telegram-fishing');
begin
  if cmd is null or position('/api/telegram/fishing' in cmd) = 0 then
    raise exception 'нет задачи telegram-fishing с ожидаемым адресом — команду не из чего собрать';
  end if;
  perform cron.schedule('cleanup-photos', '20 2 * * *', replace(cmd, '/api/telegram/fishing', '/api/cron/cleanup-photos'));
end
$m$;
