-- Нагрузка на бесплатный Supabase, блок Б, шаг 2 (13.11.2026): activity_log больше не в Realtime.
--
-- Realtime разбирает каждое изменение каждой таблицы своей публикации (supabase_realtime) — 10,5 ч времени базы
-- с 03.09, больше всего после проверки здоровья. Приложение не слушает activity_log с 25.09 (cc11a84: лента
-- строится из notifications), в коде подписок на неё нет, старые версии приложения обновляются сами при возврате.
-- Остаются: territories, catches, notifications, catch_comments, clan_messages.
--
-- Откат: 02_realtime_activity_log_ROLLBACK.sql.

set local lock_timeout = '3s';

alter publication supabase_realtime drop table public.activity_log;
