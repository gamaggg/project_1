-- Откат 01_slots_day_by_date.sql: прежний подсчёт с полуночи текущего города, без триггера и колонки.

set local lock_timeout = '3s';

create or replace function public._slot_day_state(p_uid uuid)
 returns table(total integer, used integer, day_start timestamp with time zone, next_reset timestamp with time zone)
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  with d as (
    select (date_trunc('day', now() at time zone public._city_tz(public._profile_city(p_uid))) at time zone public._city_tz(public._profile_city(p_uid))) as day_start
  )
  select
    least(4, 1 + (select count(*) from public.catches c where c.user_id = p_uid and c.caught_at >= d.day_start))::int,
    (select count(*) from public.slot_spins s where s.user_id = p_uid and s.created_at >= d.day_start and not s.bonus)::int,
    d.day_start,
    d.day_start + interval '1 day'
  from d;
$function$;

drop trigger if exists slot_spins_day on public.slot_spins;
drop function if exists public._slot_spin_day();
alter table public.slot_spins drop column if exists spin_day;
