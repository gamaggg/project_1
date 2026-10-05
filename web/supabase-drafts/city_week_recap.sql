-- «Неделя в Батуми» (итоги недели города, как итоги года у Яндекс Музыки) — только новое.
-- Прошлая календарная неделя пн–вс по времени города (p_week_offset = 1), сравнение с позапрошлой,
-- и личный слайд для смотрящего. Сервер (service_role) рисует картинки слайдов для «Поделиться»
-- и может передать p_user; для всех остальных личная часть — только про себя (auth.uid()).
create function public.get_city_week_recap(p_city text, p_week_offset integer default 1, p_user uuid default null)
 returns jsonb
 language plpgsql
 stable
 security definer
 set search_path to 'public'
as $function$
declare
  v_prefix text := case when p_city = 'moscow' then 'M' else 'B' end;
  v_tz text := public._city_tz(p_city);
  v_offset integer := least(greatest(coalesce(p_week_offset, 1), 0), 8);
  v_week date := date_trunc('week', now() at time zone v_tz)::date - 7 * v_offset;
  v_from timestamptz := v_week::timestamp at time zone v_tz;
  v_to timestamptz := (v_week + 7)::timestamp at time zone v_tz;
  v_prev_from timestamptz := (v_week - 7)::timestamp at time zone v_tz;
  v_me uuid := case when auth.role() = 'service_role' then p_user else auth.uid() end;
begin
  if auth.uid() is null and auth.role() is distinct from 'service_role' then
    raise exception 'not authenticated';
  end if;
  return (
    with wk as (
      select c.id, c.user_id, c.territory_id, c.species, c.length_cm, c.weight_kg, c.photo_url, c.caught_at
      from public.catches c
      join public.profiles p on p.id = c.user_id and not coalesce(p.is_blocked, false)
      where left(c.territory_id, 1) = v_prefix and c.caught_at >= v_from and c.caught_at < v_to
    ),
    prev as (
      select c.user_id
      from public.catches c
      join public.profiles p on p.id = c.user_id and not coalesce(p.is_blocked, false)
      where left(c.territory_id, 1) = v_prefix and c.caught_at >= v_prev_from and c.caught_at < v_from
    ),
    claims as (
      select a.user_id, a.territory_id, a.created_at
      from public.activity_log a
      join public.profiles p on p.id = a.user_id and not coalesce(p.is_blocked, false)
      where a.kind = 'claim' and left(a.territory_id, 1) = v_prefix and a.created_at >= v_from and a.created_at < v_to
    ),
    per_user as (
      select user_id, count(*) as n, min(caught_at) as first_at,
             dense_rank() over (order by count(*) desc) as place
      from wk group by user_id
    )
    select jsonb_build_object(
      'week_start', v_week,
      'week_end', v_week + 6,
      'catches', (select count(*) from wk),
      'anglers', (select count(distinct user_id) from wk),
      'captures', (select count(*) from claims),
      'new_players', (select count(*) from public.profiles p where p.city = p_city and p.created_at >= v_from and p.created_at < v_to),
      'prev', jsonb_build_object(
        'catches', (select count(*) from prev),
        'anglers', (select count(distinct user_id) from prev),
        'captures', (select count(*) from public.activity_log a
                     join public.profiles p on p.id = a.user_id and not coalesce(p.is_blocked, false)
                     where a.kind = 'claim' and left(a.territory_id, 1) = v_prefix and a.created_at >= v_prev_from and a.created_at < v_from)
      ),
      'top_species', coalesce((
        select jsonb_agg(jsonb_build_object('key', x.species, 'name', s.name, 'count', x.n, 'photo_url', x.photo) order by x.n desc, x.species)
        from (select w.species, count(*) as n,
                     (select w2.photo_url from wk w2 where w2.species = w.species
                      order by w2.length_cm desc nulls last, w2.weight_kg desc nulls last, w2.caught_at desc limit 1) as photo
              from wk w group by w.species order by count(*) desc, w.species limit 3) x
        left join public.species s on s.key = x.species
      ), '[]'::jsonb),
      'trophy', (
        select jsonb_build_object('catch_id', w.id, 'species', s.name, 'length_cm', w.length_cm, 'weight_kg', w.weight_kg,
                                  'photo_url', w.photo_url, 'territory_id', w.territory_id,
                                  'user_id', w.user_id, 'name', p.display_name, 'avatar_url', p.avatar_url)
        from wk w join public.profiles p on p.id = w.user_id left join public.species s on s.key = w.species
        where w.length_cm is not null or w.weight_kg is not null
        order by w.length_cm desc nulls last, w.weight_kg desc nulls last, w.caught_at asc
        limit 1
      ),
      'angler', (
        select jsonb_build_object('user_id', u.user_id, 'name', p.display_name, 'avatar_url', p.avatar_url, 'catches', u.n,
                                  'captures', (select count(*) from claims cl where cl.user_id = u.user_id))
        from per_user u join public.profiles p on p.id = u.user_id
        order by u.n desc, u.first_at asc limit 1
      ),
      'sector', (
        select jsonb_build_object('territory_id', x.territory_id, 'catches', x.n, 'kind', t.kind)
        from (select territory_id, count(*) as n, max(caught_at) as last_at from wk group by territory_id order by count(*) desc, max(caught_at) desc limit 1) x
        left join public.territories t on t.id = x.territory_id
      ),
      'contested', (
        select jsonb_build_object('territory_id', x.territory_id, 'changes', x.n)
        from (select territory_id, count(*) as n from claims group by territory_id having count(*) >= 2 order by count(*) desc, max(created_at) desc limit 1) x
      ),
      'hours', (select jsonb_agg(coalesce(h.n, 0) order by g.h)
                from generate_series(0, 23) g(h)
                left join (select extract(hour from caught_at at time zone v_tz)::int as hr, count(*)::int as n from wk group by 1) h on h.hr = g.h),
      'weekdays', (select jsonb_agg(coalesce(d.n, 0) order by g.d)
                   from generate_series(1, 7) g(d)
                   left join (select extract(isodow from caught_at at time zone v_tz)::int as dw, count(*)::int as n from wk group by 1) d on d.dw = g.d),
      'me', case when v_me is null then null else jsonb_build_object(
        'catches', (select count(*) from wk where user_id = v_me),
        'captures', (select count(*) from claims where user_id = v_me),
        'species', (select count(distinct species) from wk where user_id = v_me),
        'place', (select place from per_user where user_id = v_me),
        'best', (select jsonb_build_object('species', s.name, 'length_cm', w.length_cm, 'weight_kg', w.weight_kg, 'photo_url', w.photo_url)
                 from wk w left join public.species s on s.key = w.species
                 where w.user_id = v_me
                 order by w.length_cm desc nulls last, w.weight_kg desc nulls last, w.caught_at desc limit 1),
        'name', (select display_name from public.profiles where id = v_me),
        'avatar_url', (select avatar_url from public.profiles where id = v_me)
      ) end
    )
  );
end;
$function$;

revoke all on function public.get_city_week_recap(text, integer, uuid) from public, anon;
grant execute on function public.get_city_week_recap(text, integer, uuid) to authenticated, service_role;
