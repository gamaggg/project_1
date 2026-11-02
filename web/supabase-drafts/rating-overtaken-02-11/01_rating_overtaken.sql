-- «Тебя обогнали в рейтинге недели» (02.11): every 10 minutes the weekly
-- rating of each city is counted exactly like get_weekly_leaderboard
-- (sectors this week, then catches, then the older account), compared with
-- the last count, and a player who was in the top 10 of their own city and
-- went down gets a notification (Активность + Telegram), at most once in
-- 3 hours. The first count of a week (Monday, or right after this
-- migration) has nothing to compare with, so it stays silent.

-- 1. The last counted place of every player in every city's weekly rating.
create table public.rating_places (
  city text not null,
  week_start timestamptz not null,
  user_id uuid not null references public.profiles(id) on delete cascade,
  rank integer not null,
  notified_at timestamptz,
  primary key (city, week_start, user_id)
);
alter table public.rating_places enable row level security;
-- Only rating_tick (SECURITY DEFINER) reads and writes it; no policies.
revoke all on public.rating_places from anon, authenticated;
grant all on public.rating_places to service_role;

-- 2. One city's count.
create or replace function public.rating_tick(p_city text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_prefix text := public._city_prefix(p_city);
  v_ws timestamptz := public._city_week_start(p_city);
  v_we timestamptz := v_ws + interval '7 days';
begin
  with cur as (
    -- The same rows and order as get_weekly_leaderboard shows.
    select p.id as user_id,
      row_number() over (order by coalesce(s.cnt, 0) desc, coalesce(c.cnt, 0) desc, p.created_at asc)::int as rank
    from public.profiles p
    left join public._weekly_sector_counts(v_ws, v_we, v_prefix) s on s.uid = p.id
    left join (
      select k.user_id as uid, count(*) as cnt
      from public.catches k
      where k.caught_at >= v_ws and k.caught_at < v_we and k.territory_id like v_prefix || '%'
      group by k.user_id
    ) c on c.uid = p.id
    where coalesce(s.cnt, 0) > 0 or coalesce(c.cnt, 0) > 0
  ),
  old as (
    select r.user_id, r.rank, r.notified_at
    from public.rating_places r
    where r.city = p_city and r.week_start = v_ws
  ),
  fell as (
    -- Was in the top 10 of their own city, is lower now, not told in 3 hours.
    select cur.user_id, cur.rank, old.rank as prev_rank
    from cur
    join old on old.user_id = cur.user_id
    join public.profiles p on p.id = cur.user_id
    where old.rank <= 10 and cur.rank > old.rank
      and (old.notified_at is null or old.notified_at < now() - interval '3 hours')
      and p.city = p_city and not coalesce(p.is_blocked, false)
  ),
  told as (
    -- actor = whoever is right above now (their avatar and name in the feed).
    insert into public.notifications (user_id, kind, actor_id, payload)
    select f.user_id, 'rating_overtaken', a.user_id,
      jsonb_build_object('city', p_city, 'rank', f.rank, 'prev_rank', f.prev_rank)
    from fell f
    left join cur a on a.rank = f.rank - 1
    returning user_id
  )
  insert into public.rating_places (city, week_start, user_id, rank, notified_at)
  select p_city, v_ws, cur.user_id, cur.rank,
    case when exists (select 1 from told t where t.user_id = cur.user_id) then now() end
  from cur
  on conflict (city, week_start, user_id) do update
    set rank = excluded.rank,
        notified_at = coalesce(excluded.notified_at, public.rating_places.notified_at);

  -- Old weeks are of no use.
  delete from public.rating_places r where r.city = p_city and r.week_start < v_ws - interval '14 days';
end;
$function$;
revoke all on function public.rating_tick(text) from public, anon, authenticated;
grant execute on function public.rating_tick(text) to service_role;

-- 3. The new kind goes to Telegram too (the trigger's list of kinds).
do $$
declare
  v_old text := '''catch_species_changed'', ''sector_forecast'')';
  v_new text := '''catch_species_changed'', ''sector_forecast'', ''rating_overtaken'')';
  v_def text := pg_get_functiondef('public.queue_telegram_notification()'::regprocedure);
begin
  if (length(v_def) - length(replace(v_def, v_old, ''))) / length(v_old) <> 1 then
    raise exception 'queue_telegram_notification: expected the list of kinds to end once';
  end if;
  execute replace(v_def, v_old, v_new);
end
$$;

-- 4. Every 10 minutes, 3 minutes after the clan race tick.
select cron.schedule('rating-tick', '3-59/10 * * * *',
  $$select public.rating_tick('batumi'); select public.rating_tick('moscow'); select public.rating_tick('spb'); select public.rating_tick('sochi'); select public.rating_tick('tbilisi');$$);
