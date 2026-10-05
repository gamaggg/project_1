-- Большое обновление: цепочка сообщений в Telegram до первого улова (только новое).
-- Шаги:
--   новичок без уловов: new_2h (через 2 ч после регистрации), new_friday (первая пятница 18:00–21:00),
--                       new_day7, new_day14;
--   нажал /start, но не зарегистрировался: start_day1, start_day4;
--   старый игрок без уловов: old_friday — одно пятничное сообщение.
-- Только 10:00–21:00 по городу (пятничные — 18:00–21:00), не чаще одного сообщения в сутки
-- на чат, каждый шаг — один раз. Цепочка останавливается после первого улова, /stop,
-- выключенных уведомлений или если бот заблокирован.
-- Отправляет маршрут /api/telegram/send-onboarding (cron включается в релизной миграции).

-- /stop у тех, кто ещё не зарегистрировался (профиля нет — отметка здесь).
alter table public.telegram_bot_starts add column stopped_at timestamptz;

create table public.onboarding_messages (
  chat_id bigint not null,
  step text not null check (step in ('new_2h', 'new_friday', 'new_day7', 'new_day14', 'old_friday', 'start_day1', 'start_day4')),
  user_id uuid references public.profiles(id) on delete set null,
  sent_at timestamptz not null default now(),
  primary key (chat_id, step)
);
create index onboarding_messages_chat_sent_idx on public.onboarding_messages (chat_id, sent_at desc);
alter table public.onboarding_messages enable row level security;
revoke all on public.onboarding_messages from public, anon, authenticated;
grant all on public.onboarding_messages to service_role;

-- Кому какой шаг пора отправить прямо сейчас (не больше одного шага на чат),
-- с данными для текста. Только для сервера.
create function public.onboarding_due(p_limit integer default 200)
 returns table(chat_id bigint, user_id uuid, step text, city text, name text, data jsonb)
 language sql
 stable
 security definer
 set search_path to 'public'
as $function$
  with
  reg as (
    select p.id, p.telegram_id as chat_id, p.city, p.display_name, p.created_at,
           now() at time zone public._city_tz(p.city) as local_now
    from public.profiles p
    where p.telegram_id is not null
      and not coalesce(p.is_blocked, false)
      and coalesce(p.tg_notifications_enabled, false)
      and p.tg_unreachable_at is null
      and not exists (select 1 from public.catches c where c.user_id = p.id)
  ),
  reg_steps as (
    select r.*, s.step, s.prio
    from reg r
    cross join lateral (values
      ('new_2h', 1, now() - r.created_at between interval '2 hours' and interval '26 hours'),
      ('new_day14', 2, now() - r.created_at between interval '14 days' and interval '15 days'),
      ('new_day7', 3, now() - r.created_at between interval '7 days' and interval '8 days'),
      ('new_friday', 4, extract(isodow from r.local_now) = 5 and extract(hour from r.local_now) between 18 and 20
                        and now() - r.created_at between interval '12 hours' and interval '8 days'),
      ('old_friday', 5, extract(isodow from r.local_now) = 5 and extract(hour from r.local_now) between 18 and 20
                        and now() - r.created_at > interval '15 days')
    ) as s(step, prio, due)
    where s.due and extract(hour from r.local_now) between 10 and 20
  ),
  starts as (
    select s.chat_id, s.started_at, now() at time zone 'Asia/Tbilisi' as local_now
    from public.telegram_bot_starts s
    where s.stopped_at is null
      and not exists (select 1 from public.profiles p where p.telegram_id = s.chat_id)
  ),
  start_steps as (
    select st.chat_id, null::uuid as id, null::text as city, null::text as display_name, x.step, x.prio
    from starts st
    cross join lateral (values
      ('start_day1', 1, now() - st.started_at between interval '1 day' and interval '2 days'),
      ('start_day4', 2, now() - st.started_at between interval '4 days' and interval '5 days')
    ) as x(step, prio, due)
    where x.due and extract(hour from st.local_now) between 10 and 20
  ),
  candidates as (
    select chat_id, id as user_id, city, display_name, step, prio from reg_steps
    union all
    select chat_id, id, city, display_name, step, prio from start_steps
  ),
  fresh as (
    select c.* from candidates c
    where not exists (select 1 from public.onboarding_messages m where m.chat_id = c.chat_id and m.step = c.step)
      and not exists (select 1 from public.onboarding_messages m where m.chat_id = c.chat_id and m.sent_at > now() - interval '20 hours')
  ),
  one_per_chat as (
    select distinct on (chat_id) * from fresh order by chat_id, prio
  )
  select o.chat_id, o.user_id, o.step, o.city, o.display_name,
    case
      when o.step = 'new_2h' then (
        select jsonb_build_object(
          'free', (select count(*) from public.territories t
                   where not t.is_deleted and t.owner_id is null and left(t.id, 1) = case when o.city = 'moscow' then 'M' else 'B' end),
          'sector', x.territory_id, 'sector_catches', x.n)
        from (select c.territory_id, count(*) as n from public.catches c
              where c.caught_at > now() - interval '7 days' and left(c.territory_id, 1) = case when o.city = 'moscow' then 'M' else 'B' end
              group by c.territory_id order by count(*) desc limit 1) x)
      when o.step in ('new_day7', 'old_friday') then (
        select jsonb_build_object(
          'catches', count(*),
          'best_species', (select s.name from public.catches c2 join public.species s on s.key = c2.species
                           where c2.caught_at > now() - interval '7 days' and left(c2.territory_id, 1) = case when o.city = 'moscow' then 'M' else 'B' end
                             and c2.length_cm is not null order by c2.length_cm desc limit 1),
          'best_cm', (select max(c3.length_cm) from public.catches c3
                      where c3.caught_at > now() - interval '7 days' and left(c3.territory_id, 1) = case when o.city = 'moscow' then 'M' else 'B' end))
        from public.catches c
        where c.caught_at > now() - interval '7 days' and left(c.territory_id, 1) = case when o.city = 'moscow' then 'M' else 'B' end)
      else '{}'::jsonb
    end
  from one_per_chat o
  limit least(greatest(coalesce(p_limit, 200), 1), 500);
$function$;
revoke all on function public.onboarding_due(integer) from public, anon, authenticated;
grant execute on function public.onboarding_due(integer) to service_role;
