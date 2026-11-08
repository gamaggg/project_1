-- 04 · Уведомления клана: кому что приходит (решение владельца 07.11.2026). ЧЕРНОВИК, применять только после «применяй».
-- Не зависит от 01–03 (только clans, clan_members, notifications); вызовы из функций 02/03 и будущих (магазин, задание
-- недели, постройки) идут через _clan_notify_many.
--
-- Кому:
--   всему клану          — clan_hq_attacked, clan_hq_siege, clan_hq_saved, clan_hq_fell, clan_buff_planned,
--                          clan_project_done (с 08.11.2026, вызов в clan_build_tick из 06), clan_week_digest (06)
--   тем, кто ловил       — clan_quest_done (p_users: участники с уловом за неделю)
--   главе и заместителям — clan_item_bought, clan_recruit_joined, clan_recruit_paid
--   никому (только журнал клана) — выход отменён/начался/закончился, атаки на обычные сектора (у них своё sector_attacked)
-- Как не спамить:
--   * clan_hq_attacked — не чаще раза в 30 минут на человека и клан и не после начавшейся осады в эти 30 минут;
--   * одна осада = clan_hq_siege и чем кончилась (clan_hq_saved или clan_hq_fell);
--   * clan_buff_planned — один раз на выход;
--   * в Telegram ночью всё копится до утра, как остальные уведомления игры (notification_deliver_after), кроме
--     clan_hq_siege: на осаду 90 минут, утром она уже ни к чему;
--   * кто выключил уведомления бота, тому в Telegram ничего (как сейчас), «Активность» показывает всё.

-- 1. Рассылка по клану.
create or replace function public._clan_notify_many(
  p_clan_id bigint,
  p_kind text,
  p_actor uuid,
  p_extra jsonb default '{}'::jsonb,
  p_audience text default 'all',
  p_users uuid[] default null
)
returns integer
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_count integer;
begin
  if p_audience not in ('all', 'managers', 'users') then
    raise exception '_clan_notify_many: bad audience %', p_audience;
  end if;
  insert into public.notifications (user_id, kind, actor_id, payload)
  select m.user_id, p_kind, p_actor,
         jsonb_build_object('clan_id', c.id, 'clan_name', c.name, 'crest', c.crest) || coalesce(p_extra, '{}'::jsonb)
  from public.clan_members m
  join public.clans c on c.id = m.clan_id
  where m.clan_id = p_clan_id and m.left_at is null
    and (p_audience = 'all'
         or (p_audience = 'managers' and m.role in ('leader', 'co_leader'))
         or (p_audience = 'users' and m.user_id = any(coalesce(p_users, '{}'::uuid[]))))
    and not (
      p_kind = 'clan_hq_attacked' and exists (
        select 1 from public.notifications n
        where n.user_id = m.user_id and n.kind in ('clan_hq_attacked', 'clan_hq_siege')
          and n.payload->>'clan_id' = p_clan_id::text and n.created_at > now() - interval '30 minutes'
      )
    );
  get diagnostics v_count = row_count;
  return v_count;
end;
$function$;
revoke all on function public._clan_notify_many(bigint, text, uuid, jsonb, text, uuid[]) from public, anon, authenticated;

-- 2. Telegram: новые виды в списке рассылки, осада — сразу, даже ночью. Правка текста функции по двум якорям,
-- каждый должен встретиться ровно один раз.
do $migration$
declare
  v_def text := pg_get_functiondef('public.queue_telegram_notification()'::regprocedure);
  v_kinds constant text := $k$'catch_species_changed', 'sector_forecast', 'rating_overtaken')$k$;
  v_night constant text := $n$case when new.kind = 'system_alert' then now()$n$;
begin
  if (length(v_def) - length(replace(v_def, v_kinds, ''))) / length(v_kinds) <> 1 then
    raise exception 'queue_telegram_notification: kinds anchor not found exactly once';
  end if;
  if (length(v_def) - length(replace(v_def, v_night, ''))) / length(v_night) <> 1 then
    raise exception 'queue_telegram_notification: night anchor not found exactly once';
  end if;
  v_def := replace(v_def, v_kinds, $k$'catch_species_changed', 'sector_forecast', 'rating_overtaken',
                      'clan_hq_attacked', 'clan_hq_siege', 'clan_hq_saved', 'clan_hq_fell', 'clan_buff_planned',
                      'clan_quest_done', 'clan_project_done', 'clan_item_bought', 'clan_recruit_joined', 'clan_recruit_paid')$k$);
  v_def := replace(v_def, v_night, $n$case when new.kind in ('system_alert', 'clan_hq_siege') then now()$n$);
  execute v_def;
end
$migration$;
