do $dry$
declare
  h_before text := md5(split_part(pg_get_functiondef('public.grant_weekly_rank_awards(text,text)'::regprocedure), '$function$', 2));
  out text := ''; wk text; t0 bigint;
begin
  execute $m10$-- Награды за рейтинг недели (25.11.2026). ЧЕРНОВИК, применять только после «применяй». Применяется после 09.
--
-- Владелец: «в недельном рейтинге будем давать монеты топ-3: 300 + ключ, 200, 100».
--   1 место — 300 монет + ключ (бесплатное открытие секретного бокса, как 3 ключа в слотах), 2 место — 200, 3 место — 100.
--   В каждом городе, в конце недели, тем же заданием, что ставит медали места (grant_weekly_rank_awards).
--   Только тем, у кого за неделю есть хотя бы 1 сектор недели (в маленьком городе иначе в топ-3 попадают почти даром).
--   Один раз: монеты даются, только когда место недели записывается впервые (повторный запуск ничего не добавит).
--   Включается вместе с боксом: пока feature_release('secret_box') не выпущен, ничего не начисляется.
-- В истории монет: «Рейтинг недели: N место» (причина weekly_rank_prize). Монеты не удваиваются.

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
  v_placed int;
  v_prize int;
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
    get diagnostics v_placed = row_count;
    -- 25.11.2026: монеты топ-3 недели — 300 + ключ (бесплатное открытие бокса), 200, 100. Только с выпуском бокса,
    -- только тем, у кого есть хотя бы 1 сектор недели, и один раз за неделю (место записано впервые).
    if v_placed = 1 and r.sectors_cnt >= 1
       and coalesce((select f.released from public.feature_release f where f.key = 'secret_box'), false) then
      v_prize := case r.rnk when 1 then 300 when 2 then 200 else 100 end;
      update public.profiles set coins = coins + v_prize where id = r.uid;
      insert into public.coin_transactions (user_id, amount, reason, label)
      values (r.uid, v_prize, 'weekly_rank_prize', 'Рейтинг недели: ' || r.rnk || ' место');
      if r.rnk = 1 then
        insert into public.secret_box_free as f (user_id, opens) values (r.uid, 1)
        on conflict (user_id) do update set opens = f.opens + 1;
      end if;
    end if;
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
$m10$;
  select max(id) into t0 from public.coin_transactions;
  wk := to_char(((date_trunc('week', now() at time zone 'Asia/Tbilisi') at time zone 'Asia/Tbilisi') - interval '7 days') at time zone 'Asia/Tbilisi', 'YYYY-MM-DD');
  out := 'week=' || wk || ' places before=' || (select jsonb_agg(jsonb_build_object('rank', rank, 'uid', left(user_id::text, 8)) order by rank) from public.weekly_places where city_prefix = 'B' and week_key = wk)::text;

  -- 1) бокс не выпущен: ничего
  delete from public.weekly_places where city_prefix = 'B' and week_key = wk;
  perform public.grant_weekly_rank_awards('B', 'Asia/Tbilisi');
  out := out || E'\nnot released: prize tx=' || (select count(*) from public.coin_transactions where id > t0 and reason = 'weekly_rank_prize');

  -- 2) выпущен: топ-3 получают
  update public.feature_release set released = true where key = 'secret_box';
  delete from public.weekly_places where city_prefix = 'B' and week_key = wk;
  perform public.grant_weekly_rank_awards('B', 'Asia/Tbilisi');
  out := out || E'\nreleased: ' || coalesce((select jsonb_agg(jsonb_build_object('uid', left(t.user_id::text, 8), 'amount', t.amount, 'label', t.label,
        'key', (select f.opens from public.secret_box_free f where f.user_id = t.user_id)) order by t.amount desc)
      from public.coin_transactions t where t.id > t0 and t.reason = 'weekly_rank_prize')::text, 'none');
  -- 3) повторный запуск: ничего не добавляет
  perform public.grant_weekly_rank_awards('B', 'Asia/Tbilisi');
  out := out || E'\nrerun: prize tx=' || (select count(*) from public.coin_transactions where id > t0 and reason = 'weekly_rank_prize')
    || ' keys=' || coalesce((select sum(opens) from public.secret_box_free), 0);
  -- Москва для сравнения
  delete from public.weekly_places where city_prefix = 'M' and week_key = to_char(((date_trunc('week', now() at time zone 'Europe/Moscow') at time zone 'Europe/Moscow') - interval '7 days') at time zone 'Europe/Moscow', 'YYYY-MM-DD');
  perform public.grant_weekly_rank_awards('M', 'Europe/Moscow');
  out := out || E'\nmoscow total prize tx=' || (select count(*) from public.coin_transactions where id > t0 and reason = 'weekly_rank_prize');

  execute $rb10$-- Откат 10 (25.11.2026): рейтинг недели снова только с медалями, без монет и ключа — функция как до 10.
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
$rb10$;
  out := out || E'\nrollback: fn same=' || (md5(split_part(pg_get_functiondef('public.grant_weekly_rank_awards(text,text)'::regprocedure), '$function$', 2)) = h_before)
    || ' acl=' || (select proacl::text from pg_proc where proname = 'grant_weekly_rank_awards');
  raise exception 'DRYRUN: %', out;
end $dry$;
