-- Откат 10 (25.11.2026): рейтинг недели снова только с медалями, без монет и ключа — функция как до 10.
-- Уже начисленные монеты, ключи и строки истории остаются.

create or replace function public.grant_weekly_rank_awards(p_city_prefix text, p_timezone text)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_week_start timestamptz;
  v_week_end timestamptz;
  v_month_ru text;
  v_week_of_month int;
  v_local timestamp;
  r record;
begin
  v_week_start := (date_trunc('week', now() at time zone p_timezone) at time zone p_timezone) - interval '7 days';
  v_week_end := v_week_start + interval '7 days';
  v_local := v_week_start at time zone p_timezone;

  v_month_ru := public.ru_month(extract(month from v_local)::int);
  v_week_of_month := ((extract(day from v_local)::int - 1) / 7) + 1;

  for r in
    with sectors as (select * from public._weekly_sector_counts(v_week_start, v_week_end, p_city_prefix)),
    catches_week as (
      select c.user_id as uid, count(*) as cnt
      from public.catches c
      where c.caught_at >= v_week_start
        and c.caught_at < v_week_end
        and c.territory_id like p_city_prefix || '%'
      group by c.user_id
    ),
    ranked as (
      select
        p.id as uid,
        coalesce(s.cnt, 0) as sectors_cnt,
        coalesce(c.cnt, 0) as catches_cnt,
        row_number() over (
          order by coalesce(s.cnt, 0) desc, coalesce(c.cnt, 0) desc, p.created_at asc
        ) as rnk
      from public.profiles p
      left join sectors s on s.uid = p.id
      left join catches_week c on c.uid = p.id
      where coalesce(s.cnt, 0) > 0 or coalesce(c.cnt, 0) > 0
    )
    select * from ranked where rnk <= 3
  loop
    -- The place itself, kept whatever user_awards_once does with the medal.
    insert into public.weekly_places (city_prefix, week_key, user_id, rank)
    values (p_city_prefix, to_char(v_local, 'YYYY-MM-DD'), r.uid, r.rnk)
    on conflict do nothing;
    insert into public.user_awards (user_id, kind, title, subtitle, description, period_key)
    values (
      r.uid,
      'weekly_rank',
      r.rnk || ' место',
      v_month_ru || ', ' || v_week_of_month || ' неделя',
      'Ты занял ' || r.rnk || ' место в рейтинге недели — ' ||
        r.sectors_cnt || ' ' || public.ru_plural(r.sectors_cnt, 'сектор', 'сектора', 'секторов') || ' и ' ||
        r.catches_cnt || ' ' || public.ru_plural(r.catches_cnt, 'улов', 'улова', 'уловов') || '.',
      to_char(v_local, 'YYYY-MM-DD')
    )
    on conflict (user_id, kind, period_key) where period_key is not null do nothing;
  end loop;
end;
$function$;
revoke all on function public.grant_weekly_rank_awards(text, text) from public, anon, authenticated;
