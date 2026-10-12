-- /limits — everything the database itself can tell about limits, in one row.
-- Read-only. Run through Supabase MCP execute_sql (project yhgdcdkfkerzuhnzjzrz).
select jsonb_build_object(
  'checked_at', now(),

  -- Free plan: 500 MB database.
  'db', jsonb_build_object(
    'mb', round(pg_database_size(current_database()) / 1048576.0, 1),
    'top', (select jsonb_agg(x) from (
      select n.nspname || '.' || c.relname as rel, round(pg_total_relation_size(c.oid) / 1048576.0, 1) as mb
      from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where c.relkind in ('r', 'm') order by pg_total_relation_size(c.oid) desc limit 5) x),
    'cron_history_rows', (select count(*) from cron.job_run_details)
  ),

  -- Free plan: 1 GB of files. The dashboard shows an hourly average; this is the real size now.
  'storage', jsonb_build_object(
    'mb', (select round(coalesce(sum((metadata->>'size')::bigint), 0) / 1048576.0, 1) from storage.objects),
    'mb_last_7d', (select round(coalesce(sum((metadata->>'size')::bigint), 0) / 1048576.0, 1) from storage.objects where created_at > now() - interval '7 days'),
    'buckets', (select jsonb_agg(x) from (
      select bucket_id, count(*) as files,
        round(sum((metadata->>'size')::bigint) / 1048576.0, 1) as mb,
        round(coalesce(sum((metadata->>'size')::bigint) filter (where created_at > now() - interval '7 days'), 0) / 1048576.0, 1) as mb_7d,
        round(coalesce(avg((metadata->>'size')::bigint) filter (where created_at > now() - interval '7 days'), 0) / 1024.0) as avg_kb_7d
      from storage.objects group by bucket_id order by sum((metadata->>'size')::bigint) desc) x)
  ),

  -- Direct connections: the nano instance allows 60.
  'connections', jsonb_build_object(
    'now', (select count(*) from pg_stat_activity),
    'max', (select setting::int from pg_settings where name = 'max_connections'),
    'idle_in_tx', (select count(*) from pg_stat_activity where state = 'idle in transaction')
  ),

  'auth', jsonb_build_object(
    'users', (select count(*) from auth.users),
    'signed_in_30d', (select count(*) from auth.users where last_sign_in_at > now() - interval '30 days')
  ),

  -- pg_cron: failures in the last 24 h, by job.
  'cron_failed_24h', (select coalesce(jsonb_agg(x), '[]') from (
    select j.jobname, count(*) as n, left((array_agg(d.return_message order by d.start_time desc))[1], 160) as last_error
    from cron.job_run_details d join cron.job j on j.jobid = d.jobid
    where d.start_time > now() - interval '24 hours' and d.status <> 'succeeded'
    group by j.jobname) x),

  -- pg_net calls from cron to catchrange.com (kept ~6 h). A 5 s timeout is usually a cold start: the route still runs.
  'pg_net', jsonb_build_object(
    'calls', (select count(*) from net._http_response),
    'timeouts', (select count(*) from net._http_response where error_msg ilike 'Timeout%'),
    'http_errors', (select coalesce(jsonb_agg(x), '[]') from (
      select status_code, left(content, 120) as body, count(*) as n from net._http_response
      where status_code >= 400 group by 1, 2 order by 3 desc limit 5) x)
  ),

  -- Telegram: 30 msg/s per bot, 1 msg/s per chat. 429 = flood limit.
  'telegram', jsonb_build_object(
    'queued_24h', (select count(*) from public.telegram_outbox where created_at > now() - interval '24 hours'),
    'stuck_over_15m', (select count(*) from public.telegram_outbox where sent_at is null and deliver_after < now() - interval '15 minutes'),
    'errors_7d', (select coalesce(jsonb_agg(x), '[]') from (
      select left(last_error, 100) as err, count(*) as n from public.telegram_outbox
      where last_error is not null and created_at > now() - interval '7 days'
      group by 1 order by 2 desc limit 5) x)
  ),

  -- Errors from the app and the server routes (api:…), last 24 h.
  'errors_24h', (select coalesce(jsonb_agg(x), '[]') from (
    select context, left((array_agg(message order by created_at desc))[1], 120) as last, count(*) as n
    from public.client_errors where created_at > now() - interval '24 hours'
    group by context order by 3 desc limit 10) x),

  -- Activity, to estimate services that keep no counter of their own:
  -- Mapbox map loads ≈ app opens; raster tiles ≈ sector screens × ~9; Fishial ≈ confirm screens.
  'activity_7d', jsonb_build_object(
    'app_open', (select count(*) from public.app_events where name = 'app_open' and created_at > now() - interval '7 days'),
    'players', (select count(distinct coalesce(user_id::text, device_id::text)) from public.app_events where created_at > now() - interval '7 days'),
    'sector_screens', (select count(*) from public.app_events where name = 'screen' and props->>'id' = 'screen-territory' and created_at > now() - interval '7 days'),
    'confirm_screens', (select count(*) from public.app_events where name = 'screen' and props->>'id' = 'screen-confirm' and created_at > now() - interval '7 days'),
    'catches', (select count(*) from public.catches where caught_at > now() - interval '7 days')
  )
) as report;
