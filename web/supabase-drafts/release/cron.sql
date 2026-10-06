-- РЕЛИЗ: расписание задач большого обновления. Применять ПОСЛЕ выкладки клиента и миграций
-- (маршруты /api/telegram/* должны уже быть на проде).
-- HTTP-задачи берут команду (с заголовком Bearer CRON_SECRET) у уже работающей задачи
-- telegram-send-notifications и меняют только адрес — секрет в файл не попадает (репозиторий публичный).
-- Время — UTC: Батуми UTC+4, Москва UTC+3.

do $$
declare
  v_cmd text := (select command from cron.job where jobname = 'telegram-send-notifications');
  v_from text := '/api/telegram/send-notifications';
begin
  if v_cmd is null or position(v_from in v_cmd) = 0 then
    raise exception 'template job telegram-send-notifications not found';
  end if;
  -- Цепочка онбординга: каждые 15 минут.
  perform cron.schedule('telegram-send-onboarding', '*/15 * * * *', replace(v_cmd, v_from, '/api/telegram/send-onboarding'));
  -- «Ещё на рыбалке?»: каждые 5 минут (перед включением проверить вручную ?dry=1).
  perform cron.schedule('telegram-fishing', '*/5 * * * *', replace(v_cmd, v_from, '/api/telegram/fishing'));
  -- «Завтра хороший клёв»: 19:00 по городу.
  perform cron.schedule('forecast-alert-batumi', '0 15 * * *', replace(v_cmd, v_from, '/api/telegram/forecast-alert?city=batumi'));
  perform cron.schedule('forecast-alert-moscow', '0 16 * * *', replace(v_cmd, v_from, '/api/telegram/forecast-alert?city=moscow'));
end $$;

-- Горячие сектора: выбор в пятницу 12:00 по городу, объявление через 5 минут, итоги — каждый час
-- (settle_hot_sectors подводит те, у кого вышло время: вс 23:59 по городу).
select cron.schedule('pick-hot-batumi', '0 8 * * 5', $$select public.pick_hot_sectors('batumi')$$);
select cron.schedule('pick-hot-moscow', '0 9 * * 5', $$select public.pick_hot_sectors('moscow')$$);
select cron.schedule('announce-hot-batumi', '5 8 * * 5', $$select public.announce_hot_sectors('batumi')$$);
select cron.schedule('announce-hot-moscow', '5 9 * * 5', $$select public.announce_hot_sectors('moscow')$$);
select cron.schedule('settle-hot-sectors', '1 * * * *', $$select public.settle_hot_sectors()$$);

-- Легенды секторов: свежие уловы каждые 10 минут (с уведомлениями), всё — раз в сутки (без них).
select cron.schedule('refresh-sector-legends', '*/10 * * * *', $$select public.refresh_sector_legends(15)$$);
select cron.schedule('refresh-sector-legends-daily', '30 0 * * *', $$select public.refresh_sector_legends(null)$$);

-- Напоминание о ежедневной награде (функция сама выбирает 19:00 по городу игрока).
select cron.schedule('remind-daily-rewards', '2 * * * *', $$select public.remind_daily_rewards()$$);
