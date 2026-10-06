-- Подарки от админа и в Telegram (решение 06.10): admin_gift в белом списке queue_telegram_notification
-- (остальное в триггере как было). Ночью, как и всё, ждёт 08:00 по городу.

create or replace function public.queue_telegram_notification()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  if new.kind not in ('sector_lost', 'new_follower', 'catch_liked', 'moderation', 'award_granted', 'weekly_result', 'follow_catch',
                      'challenge_completed', 'challenges_week_done', 'challenge_deadline_soon', 'catch_comment', 'comment_reply',
                      'clan_invite', 'clan_join_request', 'clan_join_accepted', 'clan_kicked', 'clan_disbanded',
                      'clan_chest_reward', 'clan_race_result', 'clan_race_overtaken', 'clan_race_finished',
                      'clan_chat_mention', 'referral_joined', 'referral_reward', 'system_alert',
                      'hot_sector_week', 'hot_sector_won', 'legend_gained', 'legend_lost', 'bite_forecast', 'daily_reward_reminder',
                      'sector_attacked', 'support_reply', 'admin_gift') then
    return new;
  end if;

  if new.kind = 'follow_catch' and exists (
    select 1 from public.notifications n
    where n.user_id = new.user_id
      and n.created_at > now() - interval '3 hours'
      and n.id <> new.id
      and n.kind = 'follow_catch'
      and n.actor_id is not distinct from new.actor_id
  ) then
    return new;
  end if;

  insert into public.telegram_outbox (notification_id, chat_id, deliver_after)
  select new.id, p.telegram_id,
    -- Тревога не ждёт утра — остальные уведомления ночью копятся до 08:00.
    case when new.kind = 'system_alert' then now() else public.notification_deliver_after(p.city) end
  from public.profiles p
  where p.id = new.user_id
    and p.tg_notifications_enabled
    and p.telegram_id is not null
    and p.tg_unreachable_at is null;

  return new;
exception when others then
  return new;
end;
$function$;

-- Разово, 06.10: подарок, уже разданный всем до этой миграции, — в очередь Telegram тем же правилам
-- (уведомления включены, бот не заблокирован). Одно сообщение на игрока — его последний подарок.
insert into public.telegram_outbox (notification_id, chat_id, deliver_after)
select distinct on (n.user_id) n.id, p.telegram_id, public.notification_deliver_after(p.city)
from public.notifications n
join public.profiles p on p.id = n.user_id
where n.kind = 'admin_gift'
  and p.tg_notifications_enabled and p.telegram_id is not null and p.tg_unreachable_at is null
  and not exists (select 1 from public.telegram_outbox o where o.notification_id = n.id)
order by n.user_id, n.id desc;
