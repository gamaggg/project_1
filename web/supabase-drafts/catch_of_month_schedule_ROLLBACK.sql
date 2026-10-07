select cron.alter_job(jobid, schedule := '10 20 1 * *') from cron.job where jobname = 'grant-catch-of-month-batumi';
select cron.alter_job(jobid, schedule := '10 21 1 * *') from cron.job where jobname = 'grant-catch-of-month-moscow';
