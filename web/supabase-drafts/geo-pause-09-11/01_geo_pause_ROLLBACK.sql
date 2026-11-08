-- Откат 01_geo_pause.sql: задания «Географ» и «Меткий глаз» снова выдаются, где в городе есть
-- одобренные панорамы; тревога «Кончаются панорамы» снова шлётся.

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
    return exists (select 1 from public.geo_panoramas g where g.city = public._profile_city(p_uid) and g.status = 'approved');
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
  v_new := replace(v_def, E'  return; -- «Где это?» на паузе с 09.11.2026: тревога не нужна\n', '');
  if v_new = v_def then
    raise exception '_geo_supply_alert: строка паузы не найдена';
  end if;
  execute v_new;
end
$geo$;
