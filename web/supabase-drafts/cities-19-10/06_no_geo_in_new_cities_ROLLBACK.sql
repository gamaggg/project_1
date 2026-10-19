-- Откат 06: прежняя проверка допустимости заданий и прежняя _geo_supply_alert.
create or replace function public._challenge_eligible(p_uid uuid, p_metric text) returns boolean
  language sql stable security definer set search_path to 'public'
  as $$
  select case
    when p_metric = 'clan_messages_sent'
      then exists (select 1 from public.clan_members m where m.user_id = p_uid and m.left_at is null)
    else true
  end;
$$;
do $rb$
declare r record;
begin
  for r in select def from public._city_migration_backup where proname = '_geo_supply_alert' order by saved_at desc limit 1 loop
    execute r.def;
  end loop;
end
$rb$;
