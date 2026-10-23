do $do$
declare
  v_old text := pg_get_functiondef('public.system_health_tick()'::regprocedure);
begin
  execute replace(v_old,
    E'    group by ce.context\n    having count(*) >= case when ce.context = ''webview_killed'' then 3 when ce.context like ''api:%'' then 3 else 1 end\n',
    E'    group by ce.context\n');
end
$do$;
