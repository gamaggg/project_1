-- «Статистика» супер-админа с любым периодом (замена get_app_stats(days)): период от и до (до = сейчас, если null),
-- ряд по часам или по дням, итоги и сравнение с предыдущим таким же отрезком, список новых игроков, воронка,
-- возвраты, экраны, онбординг. Только чтение. Время ряда — по p_tz (по умолчанию Тбилиси, как и раньше).
-- Откат: 01_get_app_stats_range_ROLLBACK.sql (старая get_app_stats остаётся нетронутой).
create function public.get_app_stats_range(
  p_from timestamptz default null,
  p_to timestamptz default null,
  p_bucket text default 'auto',
  p_tz text default 'Asia/Tbilisi'
)
 returns jsonb
 language plpgsql
 stable
 security definer
 set search_path to 'public'
as $function$
declare
  v_to timestamptz := least(coalesce(p_to, now()), now());
  v_from timestamptz;
  v_span interval;
  v_prev_from timestamptz;
  v_unit text;
  v_step interval;
begin
  if not exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_super_admin) then
    raise exception 'not authorized';
  end if;
  v_from := greatest(coalesce(p_from, v_to - interval '7 days'), v_to - interval '366 days');
  if v_from >= v_to then
    v_from := v_to - interval '1 hour';
  end if;
  v_span := v_to - v_from;
  v_prev_from := v_from - v_span;
  -- по часам — только для коротких периодов (до 14 суток), иначе по дням
  v_unit := case
    when p_bucket = 'hour' and v_span <= interval '14 days' then 'hour'
    when p_bucket = 'auto' and v_span <= interval '3 days' then 'hour'
    else 'day' end;
  v_step := case v_unit when 'hour' then interval '1 hour' else interval '1 day' end;

  return jsonb_build_object(
    'from', v_from,
    'to', v_to,
    'bucket', v_unit,
    'tz', p_tz,
    'series', (
      with b as (
        select g as t from generate_series(date_trunc(v_unit, v_from, p_tz), v_to, v_step) g
      ), ev as (
        select date_trunc(v_unit, e.created_at, p_tz) as t,
               count(distinct coalesce(e.user_id::text, e.device_id::text)) as active,
               count(distinct e.user_id) as signed_in
        from public.app_events e where e.created_at >= v_from and e.created_at <= v_to group by 1
      ), nu as (
        select date_trunc(v_unit, p.created_at, p_tz) as t, count(*) as n,
               count(*) filter (where p.onboarding_completed) as onboarded
        from public.profiles p where p.created_at >= v_from and p.created_at <= v_to group by 1
      ), ca as (
        select date_trunc(v_unit, c.caught_at, p_tz) as t, count(*) as n
        from public.catches c where c.caught_at >= v_from and c.caught_at <= v_to group by 1
      )
      select jsonb_agg(jsonb_build_object(
        't', b.t, 'active', coalesce(ev.active, 0), 'signed_in', coalesce(ev.signed_in, 0),
        'new_users', coalesce(nu.n, 0), 'onboarded', coalesce(nu.onboarded, 0), 'catches', coalesce(ca.n, 0)
      ) order by b.t)
      from b left join ev using (t) left join nu using (t) left join ca using (t)
    ),
    'totals', (
      select jsonb_build_object(
        'new_users', (select count(*) from public.profiles p where p.created_at >= v_from and p.created_at <= v_to),
        'onboarded', (select count(*) from public.profiles p where p.created_at >= v_from and p.created_at <= v_to and p.onboarding_completed),
        'via_telegram', (select count(*) from public.profiles p where p.created_at >= v_from and p.created_at <= v_to and p.telegram_id is not null),
        'first_catch', (select count(*) from public.profiles p where p.created_at >= v_from and p.created_at <= v_to
                          and exists (select 1 from public.catches x where x.user_id = p.id)),
        'active', (select count(distinct coalesce(e.user_id::text, e.device_id::text)) from public.app_events e where e.created_at >= v_from and e.created_at <= v_to),
        'signed_in', (select count(distinct e.user_id) from public.app_events e where e.created_at >= v_from and e.created_at <= v_to),
        'catches', (select count(*) from public.catches c where c.caught_at >= v_from and c.caught_at <= v_to),
        'catchers', (select count(distinct c.user_id) from public.catches c where c.caught_at >= v_from and c.caught_at <= v_to),
        'players_total', (select count(*) from public.profiles)
      )
    ),
    'prev', (
      select jsonb_build_object(
        'new_users', (select count(*) from public.profiles p where p.created_at >= v_prev_from and p.created_at < v_from),
        'active', (select count(distinct coalesce(e.user_id::text, e.device_id::text)) from public.app_events e where e.created_at >= v_prev_from and e.created_at < v_from),
        'catches', (select count(*) from public.catches c where c.caught_at >= v_prev_from and c.caught_at < v_from),
        'first_catch', (select count(*) from public.profiles p where p.created_at >= v_prev_from and p.created_at < v_from
                          and exists (select 1 from public.catches x where x.user_id = p.id))
      )
    ),
    'by_city', coalesce((
      select jsonb_agg(jsonb_build_object('city', x.city, 'n', x.n) order by x.n desc)
      from (select coalesce(p.city, '?') as city, count(*) as n from public.profiles p
            where p.created_at >= v_from and p.created_at <= v_to group by 1) x
    ), '[]'::jsonb),
    'new_players', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', x.id, 'name', x.display_name, 'public_id', x.public_id, 'at', x.created_at, 'city', x.city,
        'telegram', x.telegram_id is not null, 'onboarded', x.onboarding_completed,
        'catches', (select count(*) from public.catches c where c.user_id = x.id),
        'seen', (select max(e.created_at) from public.app_events e where e.user_id = x.id)
      ) order by x.created_at desc)
      from (select p.* from public.profiles p where p.created_at >= v_from and p.created_at <= v_to
            order by p.created_at desc limit 100) x
    ), '[]'::jsonb),
    'funnel', (
      with cohort as (
        select p.id, p.created_at, p.onboarding_completed from public.profiles p
        where p.created_at >= v_from and p.created_at <= v_to
      )
      select jsonb_build_object(
        'registered', (select count(*) from cohort),
        'onboarded', (select count(*) from cohort where onboarding_completed),
        'camera', (select count(*) from cohort c where exists (select 1 from public.app_events e where e.user_id = c.id and e.name = 'camera_open')),
        'first_catch', (select count(*) from cohort c where exists (select 1 from public.catches x where x.user_id = c.id)),
        'second_day', (select count(*) from cohort c where exists (
          select 1 from public.app_events e where e.user_id = c.id and e.created_at >= c.created_at + interval '1 day'))
      )
    ),
    'retention', (
      with cohort as (
        select p.id, p.created_at from public.profiles p
        where p.created_at >= v_from and p.created_at <= v_to and p.created_at < now() - interval '8 days'
      )
      select jsonb_build_object(
        'cohort', (select count(*) from cohort),
        'd1', (select count(*) from cohort c where exists (select 1 from public.app_events e where e.user_id = c.id
                 and e.created_at >= c.created_at + interval '1 day' and e.created_at < c.created_at + interval '2 days')),
        'w1', (select count(*) from cohort c where exists (select 1 from public.app_events e where e.user_id = c.id
                 and e.created_at >= c.created_at + interval '1 day' and e.created_at < c.created_at + interval '8 days'))
      )
    ),
    'screens', coalesce((
      select jsonb_agg(jsonb_build_object('screen', x.screen, 'views', x.n, 'people', x.people) order by x.n desc)
      from (select e.props->>'id' as screen, count(*) as n, count(distinct coalesce(e.user_id::text, e.device_id::text)) as people
            from public.app_events e where e.name = 'screen' and e.created_at >= v_from and e.created_at <= v_to
            group by 1 order by 2 desc limit 20) x
    ), '[]'::jsonb),
    'onboarding', coalesce((
      select jsonb_agg(jsonb_build_object('step', x.step, 'devices', x.n) order by x.n desc)
      from (select e.props->>'step' as step, count(distinct e.device_id) as n
            from public.app_events e where e.name = 'onboarding_step' and e.created_at >= v_from and e.created_at <= v_to
            group by 1) x
    ), '[]'::jsonb)
  );
end;
$function$;
revoke all on function public.get_app_stats_range(timestamptz, timestamptz, text, text) from public, anon;
grant execute on function public.get_app_stats_range(timestamptz, timestamptz, text, text) to authenticated, service_role;
