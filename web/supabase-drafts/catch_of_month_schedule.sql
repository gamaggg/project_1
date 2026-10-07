-- «Улов месяца»: run at 00:10 UTC on the 1st (04:10 Batumi, 03:10 Moscow —
-- the first night of the new month) instead of 20:10/21:10 UTC on the 1st,
-- which is already 00:10 on the 2nd in both cities. The function picks the
-- previous month from the city's local clock, so the award itself is
-- unchanged — it just stops arriving a day late.
select cron.alter_job(jobid, schedule := '10 0 1 * *')
from cron.job
where jobname in ('grant-catch-of-month-batumi', 'grant-catch-of-month-moscow');
