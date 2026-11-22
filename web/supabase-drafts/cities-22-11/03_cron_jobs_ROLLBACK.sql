-- Откат 03_cron_jobs.sql: снять задания новых городов и вернуть общим тикам прежний список из пяти городов.
do $$
declare j record;
begin
  for j in select jobname from cron.job where jobname ~ '-(kazan|nnov|varna|anapa|kyiv|odesa|yerevan)$' loop
    perform cron.unschedule(j.jobname);
  end loop;
  perform cron.alter_job(jobid, command := 'select public.clan_race_tick(''batumi''); select public.clan_race_tick(''moscow''); select public.clan_race_tick(''spb''); select public.clan_race_tick(''sochi''); select public.clan_race_tick(''tbilisi'');')
  from cron.job where jobname = 'clan-race-tick';
  perform cron.alter_job(jobid, command := 'select public.rating_tick(''batumi''); select public.rating_tick(''moscow''); select public.rating_tick(''spb''); select public.rating_tick(''sochi''); select public.rating_tick(''tbilisi'');')
  from cron.job where jobname = 'rating-tick';
end $$;
