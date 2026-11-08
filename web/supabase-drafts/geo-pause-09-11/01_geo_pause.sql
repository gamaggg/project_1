-- «Где это?» на паузе (09.11.2026): игру скрыли в приложении (GEO_PAUSED в web/lib/geo.ts),
-- пока ищем панорамы получше. Здесь — что делает база:
--  1. Недельные задания «Географ» (geo_days) и «Меткий глаз» (geo_correct) больше не выдаются
--     ни новой неделей, ни заменой, ни докупкой: _challenge_eligible для них возвращает false
--     (через неё идут sync_my_challenges, swap_challenge, buy_extra_challenge). Уже выданные
--     с прошлых недель закроются сами, как обычно (неделя прошла).
--  2. Тревога «Кончаются панорамы «Где это?»» (_geo_supply_alert) больше не шлётся: функция
--     сразу выходит. Остальное тело оставлено как было, чтобы вернуть одной строкой.
-- Другие функции, таблицы и права не меняются (сигнатуры те же, CREATE OR REPLACE).
-- Откат: 01_geo_pause_ROLLBACK.sql

create or replace function public._challenge_eligible(p_uid uuid, p_metric text)
 returns boolean
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
begin
  if p_metric = 'clan_messages_sent' then
    return exists (select 1 from public.clan_members m where m.user_id = p_uid and m.left_at is null);
  elsif p_metric in ('geo_correct', 'geo_days') then
    return false; -- «Где это?» на паузе с 09.11.2026 (до паузы: есть одобренные панорамы в городе игрока)
  elsif p_metric = 'catch_hot_sector' then
    return exists (select 1 from public.hot_sectors h where h.city = public._profile_city(p_uid));
  elsif p_metric = 'treasury_collected' then
    return not coalesce((select e.enabled from public.clan_economy e where e.id = 1), false);
  elsif p_metric in ('buff_rsvp', 'catch_in_buff') then
    return exists (
      select 1 from public.clan_members m join public.clan_buffs b on b.clan_id = m.clan_id
      where m.user_id = p_uid and m.left_at is null and b.starts_at > now() - interval '14 days' and public._clan_econ_on(m.clan_id)
    );
  elsif p_metric in ('clan_deposit', 'catch_clan_shared', 'catch_hq_sector', 'clan_catches', 'siege_broken', 'catch_enemy_hq', 'clan_recruit') then
    return exists (select 1 from public.clan_members m where m.user_id = p_uid and m.left_at is null and public._clan_econ_on(m.clan_id));
  end if;
  return true;
end;
$function$;

do $geo$
declare
  v_def text := pg_get_functiondef('public._geo_supply_alert(text)'::regprocedure);
  v_new text;
begin
  v_new := replace(v_def, E'begin\n  if not exists (select 1 from public.geo_panoramas gp where gp.city = p_city) then',
    E'begin\n  return; -- «Где это?» на паузе с 09.11.2026: тревога не нужна\n  if not exists (select 1 from public.geo_panoramas gp where gp.city = p_city) then');
  if v_new = v_def then
    raise exception '_geo_supply_alert: место для вставки не найдено';
  end if;
  execute v_new;
end
$geo$;
