-- «Сегодня» для ежедневной награды считалось по часовому поясу города в профиле.
-- Батуми на час впереди Москвы: забрал награду после полуночи по Батуми (дата 17-е),
-- сменил город на Москву — там ещё 16-е, последняя награда «из будущего», и награда
-- снова выглядела нетронутой («день 1 из 10, забрать +10», серия сбрасывалась).
-- Теперь «сегодня» не бывает раньше даты последней забранной награды: если последняя
-- награда датирована позже, чем сегодня в этом городе, считаем, что за этот день она
-- уже забрана, а серия и время обновления идут от даты той награды.
create or replace function public._daily_reward_state(p_uid uuid)
returns table(today date, claimed_today boolean, streak_day integer, broken boolean, next_reset timestamp with time zone)
language sql
stable
security definer
set search_path = public
as $$
  with tz as (
    select public._city_tz(public._profile_city(p_uid)) as tz
  ), last as (
    select r.day, r.streak_day from public.daily_rewards r where r.user_id = p_uid order by r.day desc limit 1
  ), t as (
    -- not earlier than the last claimed day, whatever the city's clock says
    select greatest((now() at time zone tz.tz)::date, coalesce((select day from last), '-infinity'::date)) as today, tz.tz from tz
  )
  select
    t.today,
    coalesce((select day from last) = t.today, false),
    case
      when (select day from last) = t.today then (select streak_day from last)
      when (select day from last) = t.today - 1 then (select streak_day from last) % 10 + 1
      else 1
    end,
    coalesce((select day from last) < t.today - 1, false),
    ((t.today + 1)::timestamp at time zone t.tz)
  from t;
$$;
