-- Dry run (after 01 in one transaction; ends in an exception, nothing stays). Wtfish (id 2) is moved to end in 5 hours:
-- «soon»; a second tick sends nothing; then its end is moved 5 minutes into the past: «gone»; another tick — nothing.
do $$
declare v_soon int; v_again int; v_gone int; v_again2 int; v_tg int; v_orig timestamptz; t0 timestamptz := now();
begin
  select ends_at into v_orig from partner_points where id = 2;
  update partner_points set ends_at = now() + interval '5 hours' where id = 2;
  perform partner_points_expiry_tick();
  select count(*) into v_soon from notifications where kind = 'partner_point_expiry' and payload->>'stage' = 'soon' and created_at >= t0;
  perform partner_points_expiry_tick();
  select count(*) into v_again from notifications where kind = 'partner_point_expiry' and created_at >= t0;
  update partner_points set ends_at = now() - interval '5 minutes' where id = 2;
  perform partner_points_expiry_tick();
  select count(*) into v_gone from notifications where kind = 'partner_point_expiry' and payload->>'stage' = 'gone' and created_at >= t0;
  perform partner_points_expiry_tick();
  select count(*) into v_again2 from notifications where kind = 'partner_point_expiry' and created_at >= t0;
  select count(*) into v_tg from telegram_outbox o join notifications n on n.id = o.notification_id where n.kind = 'partner_point_expiry' and n.created_at >= t0;
  raise exception 'DRY RUN: soon=%, after 2nd tick total=%, gone=%, after 4th tick total=%, telegram queued=%, cron=%, payload=%',
    v_soon, v_again, v_gone, v_again2, v_tg,
    (select schedule from cron.job where jobname = 'partner-points-expiry'),
    (select payload from notifications where kind = 'partner_point_expiry' and created_at >= t0 order by id desc limit 1);
end $$;
