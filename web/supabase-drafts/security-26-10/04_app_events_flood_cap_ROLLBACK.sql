-- Откат 04_app_events_flood_cap.sql
do $do$
declare
  v_old text := pg_get_functiondef('public.log_app_events(uuid,uuid,jsonb)'::regprocedure);
  v_new text;
begin
  v_new := replace(v_old,
    'where created_at > now() - interval ''1 minute'') > 300 or (select count(*) from public.app_events where created_at > now() - interval ''1 hour'') > 6000 then',
    'where created_at > now() - interval ''1 minute'') > 5000 then');
  if v_new = v_old then raise exception 'log_app_events: нужный участок не найден'; end if;
  execute v_new;
end
$do$;
