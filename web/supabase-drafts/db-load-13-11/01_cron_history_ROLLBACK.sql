-- Откат 01_cron_history.sql: снять ежедневную чистку истории pg_cron.
-- Удалённые строки истории не возвращаются.
select cron.unschedule('cron-history-cleanup');
