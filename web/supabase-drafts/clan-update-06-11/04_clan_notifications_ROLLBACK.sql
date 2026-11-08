-- Откат 04: убрать рассылку по клану и вернуть queue_telegram_notification к списку видов до 04 (07.11.2026).
drop function if exists public._clan_notify_many(bigint, text, uuid, jsonb, text, uuid[]);
do $rollback$
declare
  v_def text := pg_get_functiondef('public.queue_telegram_notification()'::regprocedure);
begin
  v_def := replace(v_def, $k$'catch_species_changed', 'sector_forecast', 'rating_overtaken',
                      'clan_hq_attacked', 'clan_hq_siege', 'clan_hq_saved', 'clan_hq_fell', 'clan_buff_planned',
                      'clan_quest_done', 'clan_project_done', 'clan_item_bought', 'clan_recruit_joined', 'clan_recruit_paid')$k$,
                   $k$'catch_species_changed', 'sector_forecast', 'rating_overtaken')$k$);
  v_def := replace(v_def, $n$case when new.kind in ('system_alert', 'clan_hq_siege') then now()$n$, $n$case when new.kind = 'system_alert' then now()$n$);
  execute v_def;
end
$rollback$;
