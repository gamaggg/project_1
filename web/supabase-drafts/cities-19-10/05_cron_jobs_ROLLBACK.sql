-- Откат 05_cron_jobs.sql: убрать задания новых городов и вернуть clan-race-tick.
do $rb$
declare j record; v_id bigint;
begin
  for j in select jobname from cron.job where jobname ~ '-(spb|sochi|tbilisi)$' loop
    perform cron.unschedule(j.jobname);
  end loop;
  select jobid into v_id from cron.job where jobname = 'clan-race-tick';
  if v_id is not null then
    perform cron.alter_job(v_id, command := 'select public.clan_race_tick(''batumi''); select public.clan_race_tick(''moscow'');');
  end if;
end
$rb$;
