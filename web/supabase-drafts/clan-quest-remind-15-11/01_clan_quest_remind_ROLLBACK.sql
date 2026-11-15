-- Откат 01_clan_quest_remind.sql: расписание, функция, вид в рассылке Telegram, колонка. Уже пришедшие напоминания
-- (notifications.kind = 'clan_quest_ready') остаются в «Активности» как есть.

select cron.unschedule('clan-quest-remind');

drop function if exists public.clan_quest_remind_tick();

do $migration$
declare
  v_def text := pg_get_functiondef('public.queue_telegram_notification()'::regprocedure);
  v_from constant text := $k$'clan_week_digest', 'clan_nudge', 'clan_quest_ready')$k$;
  v_to constant text := $k$'clan_week_digest', 'clan_nudge')$k$;
begin
  if (length(v_def) - length(replace(v_def, v_from, ''))) / length(v_from) <> 1 then
    raise exception 'queue_telegram_notification: kinds anchor not found exactly once';
  end if;
  execute replace(v_def, v_from, v_to);
end
$migration$;

alter table public.clan_quests drop column if exists reminded_at;
