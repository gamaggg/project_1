-- Напоминание главе и заместителям: задание недели клана выполнено, а награду не забрали (просьба владельца 15.11.2026).
-- ЧЕРНОВИК, применять только после «применяй». Откат — 01_clan_quest_remind_ROLLBACK.sql.
--
-- Когда: в воскресенье с 18:00 до 22:59 по времени города клана (в 23:00 Telegram начинает копить уведомления до утра,
-- а в понедельник 00:00 награда сгорает). Проверка раз в час (в :10); одно напоминание на клан и неделю (reminded_at).
-- Кому: глава и заместители (_clan_notify_many 'managers'), в «Активность» и в Telegram.
-- Что: clan_quest_ready с наградой, которую получит клан сейчас (база вида × «Доска», как в clan_quest_claim).
-- Только для заданий, которые уже созданы (кто-то в клане открывал экран клана на этой неделе) и при включённом общаке.

-- 1. Отметка «напомнили».
alter table public.clan_quests add column reminded_at timestamptz;

-- 2. Проверка.
create or replace function public.clan_quest_remind_tick()
returns integer
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  q record;
  v_board int;
  v_reward int;
  v_sent int := 0;
begin
  for q in
    select cq.clan_id, cq.week_start, cq.kind, cq.target
    from public.clan_quests cq
    join public.clans c on c.id = cq.clan_id
    where cq.claimed_at is null
      and cq.reminded_at is null
      and cq.week_start = public._clan_week_start(cq.clan_id)
      and extract(isodow from now() at time zone public._city_tz(c.city)) = 7
      and extract(hour from now() at time zone public._city_tz(c.city)) between 18 and 22
  loop
    continue when not public._clan_econ_on(q.clan_id);
    continue when public._clan_quest_progress(q.clan_id, q.kind, q.week_start) < q.target;
    v_board := case public._clan_project_level(q.clan_id, 'board') when 1 then 15 when 2 then 30 when 3 then 50 else 0 end;
    v_reward := round((case q.kind when 'catches' then 150 when 'species' then 200 when 'rare' then 220 when 'big' then 200
                        when 'length' then 150 when 'members' then 180 when 'days' then 150 else 170 end) * (100 + v_board) / 100.0);
    update public.clan_quests set reminded_at = now() where clan_id = q.clan_id and week_start = q.week_start;
    v_sent := v_sent + public._clan_notify_many(q.clan_id, 'clan_quest_ready', null,
      jsonb_build_object('reward', v_reward, 'kind', q.kind), 'managers');
  end loop;
  return v_sent;
end;
$function$;
revoke all on function public.clan_quest_remind_tick() from public, anon, authenticated;

-- 3. Telegram: новый вид в списке рассылки (правка по якорю, якорь ровно один раз).
do $migration$
declare
  v_def text := pg_get_functiondef('public.queue_telegram_notification()'::regprocedure);
  v_from constant text := $k$'clan_week_digest', 'clan_nudge')$k$;
  v_to constant text := $k$'clan_week_digest', 'clan_nudge', 'clan_quest_ready')$k$;
begin
  if (length(v_def) - length(replace(v_def, v_from, ''))) / length(v_from) <> 1 then
    raise exception 'queue_telegram_notification: kinds anchor not found exactly once';
  end if;
  execute replace(v_def, v_from, v_to);
end
$migration$;

-- 4. Расписание: каждый час в :10.
select cron.schedule('clan-quest-remind', '10 * * * *', $$select public.clan_quest_remind_tick()$$);
