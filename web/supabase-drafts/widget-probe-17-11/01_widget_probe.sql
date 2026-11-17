-- «Вернулись ли виджеты?» (17.11.2026). Telegram с 13.11 не даёт обычным ботам
-- отправлять HTML-виджеты (tdlib/telegram-bot-api#947), срока нет. Раз в день
-- pg_cron зовёт /api/telegram/widget-probe: маршрут пробует отправить
-- суперадминам маленький виджет. Отказ — тишина. Прошло — виджет и сообщение
-- «что включить», после чего маршрут зовёт stop_widget_probe(), и задача
-- снимает себя с расписания (сообщение придёт один раз).

-- 1. Снять задачу с расписания — только для сервера (service_role).
create or replace function public.stop_widget_probe()
returns void
language plpgsql
security definer
set search_path = public, cron
as $$
begin
  perform cron.unschedule(jobid) from cron.job where jobname = 'widget-probe';
end;
$$;
revoke all on function public.stop_widget_probe() from public, anon, authenticated;
grant execute on function public.stop_widget_probe() to service_role;

-- 2. Задача: каждый день в 06:00 UTC (10:00 Батуми/Тбилиси, 09:00 Москва).
-- Команда берётся из задачи telegram-fishing с заменой адреса, чтобы заголовок
-- с CRON_SECRET не писать в этот файл.
select cron.schedule(
  'widget-probe',
  '0 6 * * *',
  (select replace(command, '/api/telegram/fishing', '/api/telegram/widget-probe') from cron.job where jobname = 'telegram-fishing')
);
