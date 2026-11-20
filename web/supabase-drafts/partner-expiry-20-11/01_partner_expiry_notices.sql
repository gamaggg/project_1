-- 20.11.2026 (owner): when a partner's time runs out, the super admin should know in Telegram — first that the marker
-- leaves the map soon (with the date and time), then that it has left. A partner point is on the map while it is not
-- paused and starts_at <= now() < ends_at (partner_points_live).
--
-- partner_points_expiry_tick() (cron every 10 minutes) sends kind 'partner_point_expiry' to every super admin:
--   stage 'soon' — the point is on its way off: under 24 hours left (once per point and end time);
--   stage 'gone' — ends_at has passed (once per point and end time; within 2 days after it, so nothing old is dug up).
-- Paused points are skipped (they are off the map anyway). Extending the term (a new ends_at) brings new notices later.
-- Payload: point_id, stage, name, city, ends_at (ISO), ends_epoch (the dedupe key), tz (the city's time zone).
-- Telegram: the kind joins queue_telegram_notification's list and, like catch_edited, reaches the admins even with
-- game notifications switched off (it waits for the morning at night, like other notices).

create or replace function public.partner_points_expiry_tick()
returns integer
language plpgsql
security definer
set search_path to 'public'
as $function$
declare r record; v_stage text; n int := 0;
begin
  for r in
    select pp.id, pp.name, pp.city, pp.ends_at, coalesce(cc.tz, 'Europe/Moscow') as tz
    from public.partner_points pp
    left join public.city_config cc on cc.id = pp.city
    where not pp.paused and pp.ends_at is not null
      and pp.ends_at > now() - interval '2 days'
      and pp.ends_at <= now() + interval '24 hours'
      and pp.starts_at < pp.ends_at
  loop
    v_stage := case when r.ends_at <= now() then 'gone' else 'soon' end;
    if exists (select 1 from public.notifications n
               where n.kind = 'partner_point_expiry' and n.payload->>'point_id' = r.id::text
                 and n.payload->>'stage' = v_stage
                 and (n.payload->>'ends_epoch')::bigint = extract(epoch from r.ends_at)::bigint) then
      continue;
    end if;
    -- A point that ended before anyone heard «soon» (say, added for under a day and already over) gets only «gone».
    insert into public.notifications (user_id, kind, payload)
    select p.id, 'partner_point_expiry', jsonb_build_object(
      'point_id', r.id, 'stage', v_stage, 'name', r.name, 'city', r.city,
      'ends_at', r.ends_at, 'ends_epoch', extract(epoch from r.ends_at)::bigint, 'tz', r.tz)
    from public.profiles p where p.is_super_admin;
    n := n + 1;
  end loop;
  return n;
end $function$;
revoke all on function public.partner_points_expiry_tick() from public, anon, authenticated;

-- Telegram: the kind joins the list, and reaches the admins whatever their game-notification switch.
do $$
declare d text := pg_get_functiondef('public.queue_telegram_notification()'::regprocedure);
begin
  if position('partner_point_expiry' in d) = 0 then
    d := replace(d, 'if new.kind not in (''sector_lost'',', 'if new.kind not in (''sector_lost'', ''partner_point_expiry'',');
    d := replace(d, 'new.kind in (''system_alert'', ''catch_edited'')', 'new.kind in (''system_alert'', ''catch_edited'', ''partner_point_expiry'')');
    if (length(d) - length(replace(d, 'partner_point_expiry', ''))) / length('partner_point_expiry') <> 2 then
      raise exception 'queue_telegram_notification: patch did not find both places';
    end if;
    execute d;
  end if;
end $$;

select cron.schedule('partner-points-expiry', '*/10 * * * *', $job$select public.partner_points_expiry_tick()$job$);
