-- Откат 02_realtime_activity_log.sql: вернуть activity_log в публикацию Realtime.
set local lock_timeout = '3s';

alter publication supabase_realtime add table public.activity_log;
