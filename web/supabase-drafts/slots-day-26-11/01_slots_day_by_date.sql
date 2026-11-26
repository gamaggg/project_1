-- 26.11.2026. Бесплатный прокрут слотов: один на календарный день игрока, а не на «сутки текущего города».
--
-- Было: _slot_day_state считала прокруты с полуночи города, выбранного в профиле. Город сменился —
-- сменилась полночь: прокрут в 00:13 по Батуми (23:13 по Москве накануне) после перехода в Москву
-- оказывался «вчерашним», и игроку снова давали бесплатный прокрут.
-- Стало: у каждого прокрута записан его день (spin_day) — дата по городу, где игрок крутил. Израсходованные
-- за сегодня = прокруты с датой «сегодня по текущему городу». Одна дата — не больше бесплатных прокрутов,
-- чем положено, как бы игрок ни переходил между городами.
-- Подпись функций не меняется (CREATE OR REPLACE), spin_slots не трогаем: день ставит триггер.

set local lock_timeout = '3s';

alter table public.slot_spins add column if not exists spin_day date;

create or replace function public._slot_spin_day()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
begin
  if new.spin_day is null then
    new.spin_day := (new.created_at at time zone public._city_tz(public._profile_city(new.user_id)))::date;
  end if;
  return new;
end;
$function$;

revoke all on function public._slot_spin_day() from public, anon, authenticated;

drop trigger if exists slot_spins_day on public.slot_spins;
create trigger slot_spins_day before insert on public.slot_spins
  for each row execute function public._slot_spin_day();

-- Старые прокруты: дата по нынешнему городу игрока (другого у нас нет).
update public.slot_spins s
   set spin_day = (s.created_at at time zone public._city_tz(public._profile_city(s.user_id)))::date
 where s.spin_day is null;

create or replace function public._slot_day_state(p_uid uuid)
 returns table(total integer, used integer, day_start timestamp with time zone, next_reset timestamp with time zone)
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  with z as (
    select public._city_tz(public._profile_city(p_uid)) as tz
  ), d as (
    select (date_trunc('day', now() at time zone z.tz) at time zone z.tz) as day_start,
           (now() at time zone z.tz)::date as today
    from z
  )
  select
    least(4, 1 + (select count(*) from public.catches c where c.user_id = p_uid and c.caught_at >= d.day_start))::int,
    (select count(*) from public.slot_spins s where s.user_id = p_uid and s.spin_day = d.today and not s.bonus)::int,
    d.day_start,
    d.day_start + interval '1 day'
  from d;
$function$;
