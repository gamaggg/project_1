-- Защита от скриптов и спама (02.11). Two layers:
--   * hard limits that a living player never reaches (the busiest players:
--     39 catches a day, 18 an hour; 43 photos a day, 19 an hour; 3 comments
--     an hour; no reports yet): 60 catches a day, 40 catch photos an hour and
--     120 a day, 10 reports an hour. Comments already had theirs (post_comment).
--   * a freeze for activity no person produces — a day without catches,
--     photos, comments or reports, an alert in Telegram to the super admin
--     and the admins who may block, «Разморозить» in the player's profile:
--       rhythm   — six catches in a row, gaps under 5 min, spread under 8 s
--                  (the most even living player: 23 s);
--       teleport — two catches more than 20 km apart at over 120 km/h
--                  (living players: 7 km/h at most);
--       volume   — 45 catches in 24 hours (living players: 39 at most);
--       uploads  — 30 catch photos in an hour (living: 19), every 10 min;
--       reports  — 8 reports in an hour, every 10 min.
-- Admins and the super admin are never checked (no cooldown either). The
-- catch that trips a check is still saved; the next ones are not.

-- 1. The freeze. Private columns: profiles has per-column grants and these get none.
alter table public.profiles add column frozen_until timestamptz, add column frozen_reason text;

-- 2. Distance between two points, km.
create or replace function public._km(p_lat1 double precision, p_lng1 double precision, p_lat2 double precision, p_lng2 double precision)
returns double precision language sql immutable set search_path to 'public' as $function$
  select 2 * 6371 * asin(sqrt(power(sin(radians(p_lat2 - p_lat1) / 2), 2)
    + cos(radians(p_lat1)) * cos(radians(p_lat2)) * power(sin(radians(p_lng2 - p_lng1) / 2), 2)));
$function$;

-- 3. Freeze for a day and tell the super admin and the admins who may block.
create or replace function public._freeze_user(p_user uuid, p_reason text, p_details text)
returns void language plpgsql security definer set search_path to 'public' as $function$
declare
  v_p public.profiles;
begin
  select * into v_p from public.profiles where id = p_user;
  if not found or v_p.is_admin or v_p.is_super_admin or coalesce(v_p.is_blocked, false) then return; end if;
  if v_p.frozen_until is not null and v_p.frozen_until > now() then return; end if;
  update public.profiles set frozen_until = now() + interval '24 hours', frozen_reason = p_reason where id = p_user;
  -- system_alert goes to Telegram at once, day or night, notifications on or off.
  insert into public.notifications (user_id, kind, payload)
  select a.id, 'system_alert', jsonb_build_object(
    'key', 'freeze:' || p_user,
    'text', left('Подозрительная активность — аккаунт заморожен на сутки: ' || coalesce(v_p.display_name, 'игрок')
      || ' (ID ' || coalesce(v_p.public_id, '—') || '). ' || p_details
      || ' Разморозить или заблокировать — в его профиле.', 600),
    'user_public_id', v_p.public_id)
  from public.profiles a
  where a.is_super_admin or (a.is_admin and a.can_block_users);
end;
$function$;

-- 4. After every catch of a player (not an admin): rhythm, teleport, volume.
create or replace function public._abuse_check_catch(p_user uuid, p_at timestamptz, p_territory text)
returns void language plpgsql security definer set search_path to 'public' as $function$
declare
  v_lat double precision;
  v_lng double precision;
  r record;
  v_km double precision;
  v_hours double precision;
  v_gaps double precision[];
  v_count int;
begin
  select t.lat, t.lng into v_lat, v_lng from public.territories t where t.id = p_territory;

  -- Teleport: the catch just before and just after this one in time.
  for r in
    (select c.caught_at, t.lat, t.lng, c.territory_id from public.catches c join public.territories t on t.id = c.territory_id
     where c.user_id = p_user and c.caught_at < p_at order by c.caught_at desc limit 1)
    union all
    (select c.caught_at, t.lat, t.lng, c.territory_id from public.catches c join public.territories t on t.id = c.territory_id
     where c.user_id = p_user and c.caught_at > p_at order by c.caught_at limit 1)
  loop
    v_km := public._km(v_lat, v_lng, r.lat, r.lng);
    v_hours := greatest(abs(extract(epoch from (p_at - r.caught_at))) / 3600.0, 1 / 60.0);
    if v_km > 20 and v_km / v_hours > 120 then
      perform public._freeze_user(p_user, 'teleport',
        format('«Телепорт»: уловы в %s и %s — %s км за %s мин (%s км/ч).', r.territory_id, p_territory,
          round(v_km::numeric), round((v_hours * 60)::numeric), round((v_km / v_hours)::numeric)));
      return;
    end if;
  end loop;

  -- Rhythm: the last six catches, gaps under 5 minutes and almost equal.
  select array_agg(gap order by caught_at) into v_gaps from (
    select caught_at, extract(epoch from caught_at - lag(caught_at) over (order by caught_at)) as gap
    from (select c.caught_at from public.catches c where c.user_id = p_user and c.caught_at <= p_at order by c.caught_at desc limit 6) a
  ) b where gap is not null;
  if coalesce(array_length(v_gaps, 1), 0) = 5
     and (select max(g) from unnest(v_gaps) g) < 300
     and (select stddev_samp(g) from unnest(v_gaps) g) < 8 then
    perform public._freeze_user(p_user, 'rhythm',
      format('Уловы как по таймеру: 6 подряд, каждый через %s с (±%s с).',
        round((select avg(g) from unnest(v_gaps) g)::numeric), round((select stddev_samp(g) from unnest(v_gaps) g)::numeric, 1)));
    return;
  end if;

  -- Volume: 45 catches in the 24 hours up to this one.
  select count(*) into v_count from public.catches c
  where c.user_id = p_user and c.caught_at > p_at - interval '24 hours' and c.caught_at <= p_at;
  if v_count >= 45 then
    perform public._freeze_user(p_user, 'volume', format('%s уловов за сутки (у живых игроков до 39).', v_count));
  end if;
end;
$function$;

-- 5. Every 10 minutes: photos and reports in the last hour.
create or replace function public.abuse_scan()
returns void language plpgsql security definer set search_path to 'public' as $function$
declare
  r record;
begin
  for r in
    select o.owner as uid, count(*) as n
    from storage.objects o
    join public.profiles p on p.id = o.owner
    where o.bucket_id = 'catch-photos' and o.created_at > now() - interval '1 hour'
      and not p.is_admin and not p.is_super_admin
    group by o.owner having count(*) >= 30
  loop
    perform public._freeze_user(r.uid, 'uploads', format('%s фото за час (у живых игроков до 19).', r.n));
  end loop;
  for r in
    select x.uid, count(*) as n from (
      select reporter_id as uid from public.catch_reports where created_at > now() - interval '1 hour'
      union all
      select reporter_id from public.comment_reports where created_at > now() - interval '1 hour'
    ) x join public.profiles p on p.id = x.uid
    where not p.is_admin and not p.is_super_admin
    group by x.uid having count(*) >= 8
  loop
    perform public._freeze_user(r.uid, 'reports', format('%s жалоб за час.', r.n));
  end loop;
end;
$function$;

-- 6. Checks the policies and report_comment ask (they run as the player).
create or replace function public._may_upload_photo()
returns boolean language sql stable security definer set search_path to 'public' as $function$
  select coalesce((
    select p.is_admin or p.is_super_admin or (
      (p.frozen_until is null or p.frozen_until <= now())
      and (select count(*) from storage.objects o where o.owner = p.id and o.bucket_id = 'catch-photos' and o.created_at > now() - interval '1 hour') < 40
      and (select count(*) from storage.objects o where o.owner = p.id and o.bucket_id = 'catch-photos' and o.created_at > now() - interval '24 hours') < 120)
    from public.profiles p where p.id = auth.uid()), false);
$function$;

create or replace function public._may_report()
returns boolean language sql stable security definer set search_path to 'public' as $function$
  select coalesce((
    select (p.frozen_until is null or p.frozen_until <= now())
      and (select count(*) from public.catch_reports r where r.reporter_id = p.id and r.created_at > now() - interval '1 hour')
        + (select count(*) from public.comment_reports r where r.reporter_id = p.id and r.created_at > now() - interval '1 hour') < 10
    from public.profiles p where p.id = auth.uid()), false);
$function$;

drop policy "users upload their own catch photos" on storage.objects;
create policy "users upload their own catch photos" on storage.objects for insert to authenticated
  with check (bucket_id = 'catch-photos' and (storage.foldername(name))[1] = auth.uid()::text and public._may_upload_photo());

drop policy "users report catches" on public.catch_reports;
create policy "users report catches" on public.catch_reports for insert to authenticated
  with check (auth.uid() = reporter_id and public._may_report());

-- 7. confirm_catch: frozen and over the day's limit are refused; after the
-- catch is in, the checks run.
do $$
declare
  v_def text := pg_get_functiondef('public.confirm_catch(text, text, text, integer, numeric, text, text, timestamptz)'::regprocedure);
  v_a text := E'    raise exception ''account blocked'';\n  end if;\n';
  v_b text := E'  returning * into v_catch;\n';
begin
  if (length(v_def) - length(replace(v_def, v_a, ''))) / length(v_a) <> 1 then raise exception 'confirm_catch: blocked check not found once'; end if;
  if (length(v_def) - length(replace(v_def, v_b, ''))) / length(v_b) <> 1 then raise exception 'confirm_catch: catch insert not found once'; end if;
  v_def := replace(v_def, v_a, v_a
    || E'  -- Заморозка и потолок уловов в сутки (защита от скриптов, 02.11).\n'
    || E'  if not coalesce(v_is_privileged, false) then\n'
    || E'    if exists (select 1 from public.profiles p where p.id = v_uid and p.frozen_until > now()) then\n'
    || E'      raise exception ''FROZEN'';\n'
    || E'    end if;\n'
    || E'    if (select count(*) from public.catches c where c.user_id = v_uid and c.caught_at > now() - interval ''24 hours'') >= 60 then\n'
    || E'      raise exception ''RATE_LIMIT:day'';\n'
    || E'    end if;\n'
    || E'  end if;\n');
  v_def := replace(v_def, v_b, v_b
    || E'  if not coalesce(v_is_privileged, false) then\n'
    || E'    perform public._abuse_check_catch(v_uid, v_catch.caught_at, v_catch.territory_id);\n'
    || E'  end if;\n');
  execute v_def;
end
$$;

-- 8. Comments: a frozen account doesn't write.
do $$
declare
  v_def text := pg_get_functiondef('public.post_comment(bigint, text, bigint)'::regprocedure);
  v_a text := E'    return jsonb_build_object(''ok'', false, ''reason'', ''muted'', ''muted_until'', v_muted_until);\n  end if;\n';
begin
  if (length(v_def) - length(replace(v_def, v_a, ''))) / length(v_a) <> 1 then raise exception 'post_comment: muted check not found once'; end if;
  execute replace(v_def, v_a, v_a
    || E'  if exists (select 1 from public.profiles p where p.id = v_uid and p.frozen_until > now()) then\n'
    || E'    return jsonb_build_object(''ok'', false, ''reason'', ''frozen'');\n'
    || E'  end if;\n');
end
$$;

-- 9. Comment reports: the same limit as reports on photos.
do $$
declare
  v_def text := pg_get_functiondef('public.report_comment(bigint, text)'::regprocedure);
  v_a text := E'  if v_uid is null then raise exception ''not authenticated''; end if;\n';
begin
  if (length(v_def) - length(replace(v_def, v_a, ''))) / length(v_a) <> 1 then raise exception 'report_comment: auth check not found once'; end if;
  execute replace(v_def, v_a, v_a
    || E'  if not public._may_report() then raise exception ''RATE_LIMIT:report''; end if;\n');
end
$$;

-- 10. The freeze for admins: what it is and «Разморозить».
create or replace function public.admin_get_freeze(p_user_id uuid)
returns jsonb language plpgsql stable security definer set search_path to 'public' as $function$
begin
  if not exists (select 1 from public.profiles a where a.id = auth.uid() and (a.is_super_admin or (a.is_admin and a.can_block_users))) then
    raise exception 'not authorized';
  end if;
  return (select jsonb_build_object('frozen_until', p.frozen_until, 'reason', p.frozen_reason)
          from public.profiles p where p.id = p_user_id and p.frozen_until > now());
end;
$function$;

create or replace function public.admin_unfreeze(p_user_id uuid)
returns void language plpgsql security definer set search_path to 'public' as $function$
begin
  if not exists (select 1 from public.profiles a where a.id = auth.uid() and (a.is_super_admin or (a.is_admin and a.can_block_users))) then
    raise exception 'not authorized';
  end if;
  update public.profiles set frozen_until = null, frozen_reason = null where id = p_user_id;
  insert into public.admin_actions (admin_id, action, target_user_id, details)
  values (auth.uid(), 'unfreeze', p_user_id, 'Разморозил аккаунт');
end;
$function$;

-- 11. Who may call what: new functions are executable by PUBLIC by default.
revoke all on function public._km(double precision, double precision, double precision, double precision) from public, anon, authenticated;
revoke all on function public._freeze_user(uuid, text, text) from public, anon, authenticated;
revoke all on function public._abuse_check_catch(uuid, timestamptz, text) from public, anon, authenticated;
revoke all on function public.abuse_scan() from public, anon, authenticated;
revoke all on function public._may_upload_photo() from public, anon;
revoke all on function public._may_report() from public, anon;
grant execute on function public._may_upload_photo() to authenticated;
grant execute on function public._may_report() to authenticated;
revoke all on function public.admin_get_freeze(uuid) from public, anon;
revoke all on function public.admin_unfreeze(uuid) from public, anon;
grant execute on function public.admin_get_freeze(uuid) to authenticated;
grant execute on function public.admin_unfreeze(uuid) to authenticated;

-- 12. The scan every 10 minutes, 7 minutes after the clan race tick.
select cron.schedule('abuse-scan', '7-59/10 * * * *', $$select public.abuse_scan();$$);
