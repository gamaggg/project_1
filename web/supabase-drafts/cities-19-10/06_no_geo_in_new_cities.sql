-- «Где это?» в новых городах пока не играется (20.10.2026): панорам там нет.
--  1. Задания «Меткий глаз» и «Географ» (geo_correct, geo_days) выдаются, только если в городе
--     игрока есть одобренные панорамы; иначе игрок получил бы невыполнимое задание (замена
--     стоит монет). «На горячем» (catch_hot_sector) — только если в городе уже выбирались
--     горячие сектора. Как только панорамы появятся, задания включатся сами.
--  2. _geo_supply_alert не шлёт «кончаются панорамы» для города, где панорам не было вообще:
--     иначе каждый вход в игру игрока из нового города поднимал бы тревогу админам.
-- Откат: 06_no_geo_in_new_cities_ROLLBACK.sql
create or replace function public._challenge_eligible(p_uid uuid, p_metric text) returns boolean
  language sql stable security definer set search_path to 'public'
  as $$
  select case
    when p_metric = 'clan_messages_sent'
      then exists (select 1 from public.clan_members m where m.user_id = p_uid and m.left_at is null)
    when p_metric in ('geo_correct', 'geo_days')
      then exists (select 1 from public.geo_panoramas g where g.city = public._profile_city(p_uid) and g.status = 'approved')
    when p_metric = 'catch_hot_sector'
      then exists (select 1 from public.hot_sectors h where h.city = public._profile_city(p_uid))
    else true
  end;
$$;

do $geo$
declare
  v_def text;
  v_new text;
begin
  v_def := pg_get_functiondef('public._geo_supply_alert(text)'::regprocedure);
  v_new := replace(v_def, E'begin\n  select (select count(*) from public.geo_days d where',
    E'begin\n  if not exists (select 1 from public.geo_panoramas gp where gp.city = p_city) then\n    return; -- the game is not played in this city yet\n  end if;\n  select (select count(*) from public.geo_days d where');
  if v_new = v_def then
    raise exception '_geo_supply_alert: the place to insert was not found';
  end if;
  insert into public._city_migration_backup (fn_oid, proname, def)
  values ('public._geo_supply_alert(text)'::regprocedure::oid, '_geo_supply_alert', v_def);
  execute v_new;
end
$geo$;
