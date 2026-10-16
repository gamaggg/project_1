-- Back to «today» by the profile city's clock alone.
create or replace function public._daily_reward_state(p_uid uuid)
returns table(today date, claimed_today boolean, streak_day integer, broken boolean, next_reset timestamp with time zone)
language sql
stable
security definer
set search_path = public
as $$
  with tz as (
    select public._city_tz(public._profile_city(p_uid)) as tz
  ), t as (
    select (now() at time zone tz.tz)::date as today, tz.tz from tz
  ), last as (
    select r.day, r.streak_day from public.daily_rewards r where r.user_id = p_uid order by r.day desc limit 1
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
