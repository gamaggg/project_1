-- РЕЛИЗ: новые игровые уведомления (в «Активности» и в Telegram).
--   hot_sector_week        — пт 12:00: горячие сектора недели (игрокам города);
--   hot_sector_won         — вс: удержал горячий сектор (уже создаёт settle_hot_sectors);
--   legend_gained / legend_lost — стал легендой сектора / тебя обошли;
--   bite_forecast          — «завтра хороший клёв» (создаёт маршрут /api/telegram/forecast-alert);
--   daily_reward_reminder  — 19:00, серия 3+ и награда не забрана.
-- Всё это — только в релиз: клиент до релиза не знает этих видов и показал бы их как улов.

-- 1) Разрешить новые виды для Telegram (остальное в триггере как было).
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
                      'hot_sector_week', 'hot_sector_won', 'legend_gained', 'legend_lost', 'bite_forecast', 'daily_reward_reminder') then
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

-- 2) Легенды секторов: кто легенда сейчас (то же правило, что _sector_legend: 10+ уловов
--    за 90 дней, ничья — кто начал раньше). Таблица — чтобы заметить смену.
create table public.sector_legends (
  territory_id text primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  catches int not null,
  since timestamptz not null default now()
);
alter table public.sector_legends enable row level security;
revoke all on public.sector_legends from public, anon, authenticated;
grant all on public.sector_legends to service_role;

-- Пересчитать легенды. p_recent_minutes: только сектора с уловами за последние N минут
-- (частый прогон, с уведомлениями); null — все сектора (раз в сутки: легенда может
-- «состариться» — тогда без уведомлений, просто обновить таблицу).
create function public.refresh_sector_legends(p_recent_minutes integer default 15)
 returns integer
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  r record;
  v_old uuid;
  v_changed int := 0;
  v_notify boolean := p_recent_minutes is not null;
begin
  for r in
    select t.id as territory_id, l.user_id, l.catches
    from public.territories t
    left join lateral public._sector_legend(t.id) l on true
    where not t.is_deleted
      and (p_recent_minutes is null
           or exists (select 1 from public.catches c where c.territory_id = t.id and c.caught_at > now() - make_interval(mins => p_recent_minutes)))
  loop
    select user_id into v_old from public.sector_legends where territory_id = r.territory_id;
    if r.user_id is null then
      if v_old is not null then
        delete from public.sector_legends where territory_id = r.territory_id;
        v_changed := v_changed + 1;
      end if;
      continue;
    end if;
    if v_old is distinct from r.user_id then
      insert into public.sector_legends (territory_id, user_id, catches, since)
      values (r.territory_id, r.user_id, r.catches, now())
      on conflict (territory_id) do update set user_id = excluded.user_id, catches = excluded.catches, since = now();
      v_changed := v_changed + 1;
      if v_notify then
        insert into public.notifications (user_id, kind, territory_id, payload)
        values (r.user_id, 'legend_gained', r.territory_id, jsonb_build_object('catches', r.catches));
        if v_old is not null then
          insert into public.notifications (user_id, kind, actor_id, territory_id, payload)
          values (v_old, 'legend_lost', r.user_id, r.territory_id, jsonb_build_object('catches', r.catches));
        end if;
      end if;
    else
      update public.sector_legends set catches = r.catches where territory_id = r.territory_id;
    end if;
  end loop;
  return v_changed;
end;
$function$;
revoke all on function public.refresh_sector_legends(integer) from public, anon, authenticated;
grant execute on function public.refresh_sector_legends(integer) to service_role;

-- Стартовое заполнение — без уведомлений.
select public.refresh_sector_legends(null);

-- 3) Горячие сектора недели — объявление игрокам города (один раз на неделю).
create function public.announce_hot_sectors(p_city text)
 returns integer
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_ids text[];
  v_until timestamptz;
  v_n int;
begin
  select array_agg(h.territory_id order by h.territory_id), max(h.ends_at) into v_ids, v_until
  from public.hot_sectors h
  where now() between h.starts_at and h.ends_at
    and left(h.territory_id, 1) = case when p_city = 'moscow' then 'M' else 'B' end;
  if v_ids is null then return 0; end if;

  insert into public.notifications (user_id, kind, territory_id, payload)
  select p.id, 'hot_sector_week', v_ids[1], jsonb_build_object('sectors', to_jsonb(v_ids), 'until', v_until)
  from public.profiles p
  where p.city = p_city and p.onboarding_completed and not coalesce(p.is_blocked, false)
    and not exists (select 1 from public.notifications n
                    where n.user_id = p.id and n.kind = 'hot_sector_week' and n.created_at > now() - interval '5 days');
  get diagnostics v_n = row_count;
  return v_n;
end;
$function$;
revoke all on function public.announce_hot_sectors(text) from public, anon, authenticated;
grant execute on function public.announce_hot_sectors(text) to service_role;

-- 4) Напоминание о ежедневной награде: в 19:00 по городу, если серия 3+ (вчера был
--    3-й день или дальше) и сегодня награда ещё не забрана. Раз в день. Прогон — каждый час.
create function public.remind_daily_rewards()
 returns integer
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_n int;
begin
  insert into public.notifications (user_id, kind, payload)
  select p.id, 'daily_reward_reminder',
         jsonb_build_object('day', last.streak_day % 10 + 1, 'coins', (public._daily_reward_amounts())[last.streak_day % 10 + 1])
  from public.profiles p
  cross join lateral (select r.day, r.streak_day from public.daily_rewards r where r.user_id = p.id order by r.day desc limit 1) last
  where not coalesce(p.is_blocked, false)
    and extract(hour from now() at time zone public._city_tz(p.city)) = 19
    and last.day = (now() at time zone public._city_tz(p.city))::date - 1
    and last.streak_day >= 3
    and not exists (select 1 from public.notifications n
                    where n.user_id = p.id and n.kind = 'daily_reward_reminder' and n.created_at > now() - interval '20 hours');
  get diagnostics v_n = row_count;
  return v_n;
end;
$function$;
revoke all on function public.remind_daily_rewards() from public, anon, authenticated;
grant execute on function public.remind_daily_rewards() to service_role;

-- 5) «Завтра хороший клёв»: какие дни уже объявлены (не чаще 2 раз в неделю на город).
create table public.forecast_alerts (
  city text not null check (city in ('batumi', 'moscow')),
  for_date date not null,
  score smallint not null,
  created_at timestamptz not null default now(),
  primary key (city, for_date)
);
alter table public.forecast_alerts enable row level security;
revoke all on public.forecast_alerts from public, anon, authenticated;
grant all on public.forecast_alerts to service_role;

-- «Завтра хороший клёв»: маршрут считает прогноз (Open-Meteo) и передаёт сюда оценку на завтра.
-- Только 4–5, не больше 2 объявлений в неделю на город и не два дня подряд; получают игроки
-- города, ловившие за последние 60 дней. Возвращает, сколько уведомлений создано.
create function public.queue_bite_forecast(p_city text, p_for_date date, p_score integer, p_from text, p_to text)
 returns integer
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_week_start date := date_trunc('week', p_for_date)::date;
  v_n int;
begin
  if p_city not in ('batumi', 'moscow') or p_score < 4 then
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
revoke all on function public.queue_bite_forecast(text, date, integer, text, text) from public, anon, authenticated;
grant execute on function public.queue_bite_forecast(text, date, integer, text, text) to service_role;

-- 6) Расписание (маски секрета — как у остальных задач, см. telegram-send):
--   select cron.schedule('refresh-sector-legends', '*/10 * * * *', $$select public.refresh_sector_legends(15)$$);
--   select cron.schedule('refresh-sector-legends-daily', '30 0 * * *', $$select public.refresh_sector_legends(null)$$);
--   select cron.schedule('announce-hot-batumi', '5 8 * * 5', $$select public.announce_hot_sectors('batumi')$$);   -- 12:05 Тбилиси, после pick_hot_sectors
--   select cron.schedule('announce-hot-moscow', '5 9 * * 5', $$select public.announce_hot_sectors('moscow')$$);   -- 12:05 Москва
--   select cron.schedule('remind-daily-rewards', '2 * * * *', $$select public.remind_daily_rewards()$$);
--   forecast-alert: http GET /api/telegram/forecast-alert?city=batumi в 15:00 UTC (19:00 Тбилиси),
--                   ?city=moscow в 16:00 UTC (19:00 Москва), с Bearer CRON_SECRET.
