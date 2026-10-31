-- Откат 02_sector_forecast.sql: функции в виде до 30.10.2026, без queue_sector_forecast.
-- Уже созданные уведомления sector_forecast остаются в ленте игроков; новые в Telegram не уйдут.
drop function if exists public.queue_sector_forecast(text, date, jsonb);

CREATE OR REPLACE FUNCTION public.queue_bite_forecast(p_city text, p_for_date date, p_score integer, p_from text, p_to text)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_week_start date := date_trunc('week', p_for_date)::date;
  v_n int;
begin
  if p_city not in (select cc.id from public.city_config cc) or p_score < 4 then
    return 0;
  end if;
  if (select count(*) from public.forecast_alerts a where a.city = p_city and a.for_date >= v_week_start and a.for_date < v_week_start + 7) >= 2
     or exists (select 1 from public.forecast_alerts a where a.city = p_city and a.for_date between p_for_date - 2 and p_for_date) then
    return 0;
  end if;
  insert into public.forecast_alerts (city, for_date, score) values (p_city, p_for_date, p_score);
  insert into public.notifications (user_id, kind, payload)
  select p.id, 'bite_forecast', jsonb_build_object('score', p_score, 'city', p_city, 'from', p_from, 'to', p_to, 'date', p_for_date)
  from public.profiles p
  where p.city = p_city and not coalesce(p.is_blocked, false)
    and exists (select 1 from public.catches c where c.user_id = p.id and c.caught_at > now() - interval '60 days');
  get diagnostics v_n = row_count;
  return v_n;
end;
$function$;

CREATE OR REPLACE FUNCTION public.queue_telegram_notification()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if new.kind not in ('sector_lost', 'new_follower', 'catch_liked', 'moderation', 'award_granted', 'weekly_result', 'follow_catch',
                      'challenge_completed', 'challenges_week_done', 'challenge_deadline_soon', 'catch_comment', 'comment_reply',
                      'clan_invite', 'clan_join_request', 'clan_join_accepted', 'clan_kicked', 'clan_disbanded',
                      'clan_chest_reward', 'clan_race_result', 'clan_race_overtaken', 'clan_race_finished',
                      'clan_chat_mention', 'referral_joined', 'referral_reward', 'system_alert',
                      'hot_sector_week', 'hot_sector_won', 'legend_gained', 'legend_lost', 'bite_forecast', 'daily_reward_reminder',
                      'sector_attacked', 'support_reply', 'admin_gift', 'geo_bonus', 'catch_edited', 'clan_war_started', 'clan_war_reminder',
                      'catch_species_changed') then
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
    -- Alerts reach the admins even with game notifications switched off.
    and (p.tg_notifications_enabled or new.kind in ('system_alert', 'catch_edited'))
    and p.telegram_id is not null
    and p.tg_unreachable_at is null;

  return new;
exception when others then
  return new;
end;
$function$;
