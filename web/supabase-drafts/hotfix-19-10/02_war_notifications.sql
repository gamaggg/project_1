-- Telegram for the two new notification kinds: «your clan is in the battle, you are
-- in the roster» (clan_war_started) and «open the war» (clan_war_reminder), plus the
-- reminders on a schedule: Monday 10:00 and Sunday 12:00 city time (cron is UTC:
-- Batumi UTC+4, Moscow UTC+3).
do $$
declare d text; d2 text;
begin
  d := pg_get_functiondef('public.queue_telegram_notification'::regproc);
  d2 := replace(d, '''geo_bonus'', ''catch_edited'')', '''geo_bonus'', ''catch_edited'', ''clan_war_started'', ''clan_war_reminder'')');
  if d2 = d then raise exception 'kind list not found'; end if;
  execute d2;
end $$;

select cron.schedule('clan-war-reminder-start-batumi', '0 6 * * 1', $c$select public.clan_war_reminder('batumi', 'start')$c$);
select cron.schedule('clan-war-reminder-start-moscow', '0 7 * * 1', $c$select public.clan_war_reminder('moscow', 'start')$c$);
select cron.schedule('clan-war-reminder-last-batumi', '0 8 * * 0', $c$select public.clan_war_reminder('batumi', 'last')$c$);
select cron.schedule('clan-war-reminder-last-moscow', '0 9 * * 0', $c$select public.clan_war_reminder('moscow', 'last')$c$);
