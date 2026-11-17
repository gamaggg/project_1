-- Откат 01_widget_probe.sql: снять задачу и удалить функцию.
select cron.unschedule(jobid) from cron.job where jobname = 'widget-probe';
drop function if exists public.stop_widget_probe();
