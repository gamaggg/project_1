-- The Telegram queue knows the new kind (a player edited a catch): sent to
-- super admins even with game notifications switched off, like alerts.
do $m$
declare
  v text := pg_get_functiondef('public.queue_telegram_notification'::regproc);
  v2 text;
begin
  v2 := replace(v, $a$'sector_attacked', 'support_reply', 'admin_gift', 'geo_bonus') then$a$, $a$'sector_attacked', 'support_reply', 'admin_gift', 'geo_bonus', 'catch_edited') then$a$);
  if v2 = v then raise exception 'kind list not found'; end if;
  v := v2;
  v2 := replace(v, $a$or new.kind = 'system_alert')$a$, $a$or new.kind in ('system_alert', 'catch_edited'))$a$);
  if v2 = v then raise exception 'enabled clause not found'; end if;
  execute v2;
end
$m$;
