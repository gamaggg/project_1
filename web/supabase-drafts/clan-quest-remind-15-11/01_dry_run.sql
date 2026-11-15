-- Пробный прогон 01 на живой базе: всё в одной транзакции, в конце raise exception откатывает. Собирается так:
-- текст 01_clan_quest_remind.sql (без верхних комментариев) + этот блок, одним запуском в SQL-редакторе.
do $test$
declare
  r text := '';
  v int;
  v_before_outbox int;
begin
  -- Сейчас не вечер воскресенья: по настоящему окну ничего не уходит.
  r := r || 'now_window=' || public.clan_quest_remind_tick();
  -- Для проверки рассылки окно на эту транзакцию — весь день.
  execute replace(pg_get_functiondef('public.clan_quest_remind_tick()'::regprocedure), 'between 18 and 22', 'between 0 and 23');
  -- А воскресенье нужно и в самой проверке: сегодня 15.11 и есть воскресенье, иначе прогон бессмыслен.
  r := r || ' | isodow_batumi=' || extract(isodow from now() at time zone 'Asia/Tbilisi');
  select count(*) into v_before_outbox from public.telegram_outbox;
  v := public.clan_quest_remind_tick();
  r := r || ' | sent=' || v;
  r := r || ' | rows=' || coalesce((select string_agg(n.user_id::text || ':' || cm.role || ':' || (n.payload->>'clan_id') || ':' || (n.payload->>'reward') || ':' || (n.payload->>'kind'), ', ')
    from public.notifications n join public.clan_members cm on cm.user_id = n.user_id and cm.left_at is null
    where n.kind = 'clan_quest_ready'), 'none');
  r := r || ' | reminded=' || coalesce((select string_agg(clan_id::text, ',') from public.clan_quests where reminded_at is not null), 'none');
  r := r || ' | outbox_new=' || ((select count(*) from public.telegram_outbox) - v_before_outbox);
  -- Второй раз — тишина.
  r := r || ' | second=' || public.clan_quest_remind_tick();
  -- Права и расписание.
  r := r || ' | anon_exec=' || has_function_privilege('anon', 'public.clan_quest_remind_tick()', 'execute');
  r := r || ' | auth_exec=' || has_function_privilege('authenticated', 'public.clan_quest_remind_tick()', 'execute');
  r := r || ' | cron=' || (select schedule from cron.job where jobname = 'clan-quest-remind');
  r := r || ' | tg_kind=' || (pg_get_functiondef('public.queue_telegram_notification()'::regprocedure) like '%''clan_nudge'', ''clan_quest_ready'')%');
  raise exception 'DRYRUN %', r;
end
$test$;
