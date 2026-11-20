-- Rollback of 01_partner_expiry_notices.sql: the cron job and the function go, the kind leaves queue_telegram_notification.
-- Notices already sent stay.
select cron.unschedule('partner-points-expiry');
drop function if exists public.partner_points_expiry_tick();
do $$
declare d text := pg_get_functiondef('public.queue_telegram_notification()'::regprocedure);
begin
  d := replace(d, 'if new.kind not in (''sector_lost'', ''partner_point_expiry'',', 'if new.kind not in (''sector_lost'',');
  d := replace(d, 'new.kind in (''system_alert'', ''catch_edited'', ''partner_point_expiry'')', 'new.kind in (''system_alert'', ''catch_edited'')');
  execute d;
end $$;
