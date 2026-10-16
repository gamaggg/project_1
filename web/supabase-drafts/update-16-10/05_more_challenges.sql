-- 21 new weekly challenges on the new features (comments, likes and followers
-- received, clan chat, «Где это?», slots, treasury, daily reward, hot sectors,
-- claims) and bigger catch targets. The weekly set is still soft + light +
-- (medium | hard); nothing about how the set is drawn changes except that a
-- challenge that needs a clan (clan_messages_sent) is never given to someone
-- without one.
--
-- How, without retyping the two big functions:
--   * the new metrics live in a new helper _challenge_progress_new();
--   * compute_challenge_progress() gets an `else` that calls it (every existing
--     branch is untouched);
--   * sync_my_challenges() gets `_challenge_eligible()` in the six places that
--     draw a challenge (soft/light/third, each with its fallback); swap_challenge()
--     and buy_extra_challenge() in their two each.
-- Each patch asserts it applied exactly where expected. rollback.sql undoes it.

-- ---------------------------------------------------------------- helpers

create or replace function public._challenge_eligible(p_uid uuid, p_metric text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when p_metric = 'clan_messages_sent'
      then exists (select 1 from public.clan_members m where m.user_id = p_uid and m.left_at is null)
    else true
  end;
$$;

create or replace function public._challenge_progress_new(
  p_user_id uuid, p_metric text, p_params jsonb,
  p_week_start timestamptz, p_week_end timestamptz, p_city_prefix text, p_timezone text
) returns integer
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_result int := 0;
  v_city text := case when p_city_prefix = 'M' then 'moscow' else 'batumi' end;
begin
  if p_metric = 'comments_written' then
    -- under other people's catches, not deleted
    select count(*) into v_result
    from public.catch_comments cm join public.catches c on c.id = cm.catch_id
    where cm.user_id = p_user_id and cm.deleted_at is null and c.user_id <> p_user_id
      and cm.created_at >= p_week_start and cm.created_at < p_week_end;

  elsif p_metric = 'comments_received' then
    select count(*) into v_result
    from public.catch_comments cm join public.catches c on c.id = cm.catch_id
    where c.user_id = p_user_id and cm.user_id <> p_user_id and cm.deleted_at is null
      and cm.created_at >= p_week_start and cm.created_at < p_week_end;

  elsif p_metric = 'likes_received' then
    select count(*) into v_result
    from public.catch_likes l join public.catches c on c.id = l.catch_id
    where c.user_id = p_user_id and l.user_id <> p_user_id
      and l.created_at >= p_week_start and l.created_at < p_week_end;

  elsif p_metric = 'followers_gained' then
    select count(*) into v_result from public.follows
    where followee_id = p_user_id and follower_id <> p_user_id
      and created_at >= p_week_start and created_at < p_week_end;

  elsif p_metric = 'slot_spins' then
    select count(*) into v_result from public.slot_spins
    where user_id = p_user_id and created_at >= p_week_start and created_at < p_week_end;

  elsif p_metric = 'treasury_collected' then
    select count(*) into v_result from public.treasury_collections
    where user_id = p_user_id and collected_at >= p_week_start and collected_at < p_week_end;

  elsif p_metric = 'daily_reward_days' then
    select count(distinct day) into v_result from public.daily_rewards
    where user_id = p_user_id and claimed_at >= p_week_start and claimed_at < p_week_end;

  elsif p_metric = 'geo_days' then
    select count(distinct day) into v_result from public.geo_guesses
    where user_id = p_user_id and city = v_city
      and created_at >= p_week_start and created_at < p_week_end;

  elsif p_metric = 'geo_correct' then
    select count(*) into v_result from public.geo_guesses
    where user_id = p_user_id and city = v_city and correct
      and created_at >= p_week_start and created_at < p_week_end;

  elsif p_metric = 'clan_messages_sent' then
    select count(*) into v_result from public.clan_messages
    where user_id = p_user_id and created_at >= p_week_start and created_at < p_week_end;

  elsif p_metric = 'catch_over_kg' then
    -- like the other catch metrics: an Echo catch counts twice
    select coalesce(sum(case when echo then 2 else 1 end), 0) into v_result from public.catches
    where user_id = p_user_id and caught_at >= p_week_start and caught_at < p_week_end
      and territory_id like p_city_prefix || '%'
      and weight_kg is not null and weight_kg > (p_params->>'min')::numeric;

  elsif p_metric = 'catch_hot_sector' then
    -- a catch in a sector while it was the city's hot sector
    select coalesce(sum(case when c.echo then 2 else 1 end), 0) into v_result
    from public.catches c
    where c.user_id = p_user_id and c.caught_at >= p_week_start and c.caught_at < p_week_end
      and c.territory_id like p_city_prefix || '%'
      and exists (
        select 1 from public.hot_sectors h
        where h.territory_id = c.territory_id and c.caught_at >= h.starts_at and c.caught_at < h.ends_at
      );

  elsif p_metric = 'claims_made' then
    select count(distinct territory_id) into v_result from public.activity_log
    where user_id = p_user_id and kind = 'claim' and territory_id like p_city_prefix || '%'
      and created_at >= p_week_start and created_at < p_week_end;
  end if;

  return coalesce(v_result, 0);
end;
$$;

revoke all on function public._challenge_eligible(uuid, text) from public, anon, authenticated;
revoke all on function public._challenge_progress_new(uuid, text, jsonb, timestamptz, timestamptz, text, text) from public, anon, authenticated;

-- ---------------------------------------------------------------- patches

do $patch$
declare
  v_def text;
  v_new text;
begin
  -- compute_challenge_progress: unknown metrics go to the new helper
  v_def := pg_get_functiondef('public.compute_challenge_progress'::regproc);
  if position('_challenge_progress_new' in v_def) = 0 then
    v_new := replace(
      v_def,
      E'  end if;\n\n  return coalesce(v_result, 0);',
      E'  else\n    v_result := public._challenge_progress_new(p_user_id, p_metric, p_params, p_week_start, p_week_end, p_city_prefix, p_timezone);\n  end if;\n\n  return coalesce(v_result, 0);'
    );
    if v_new = v_def then raise exception 'compute_challenge_progress: end marker not found'; end if;
    execute v_new;
  end if;

  -- sync_my_challenges: a clan-only challenge is never drawn for someone without a clan
  v_def := pg_get_functiondef('public.sync_my_challenges'::regproc);
  if position('_challenge_eligible' in v_def) = 0 then
    v_new := replace(v_def, E'ch.tier = ''soft'' and (ch.city_scope', E'ch.tier = ''soft'' and public._challenge_eligible(v_uid, ch.metric) and (ch.city_scope');
    v_new := replace(v_new, E'ch.tier = ''light'' and (ch.city_scope', E'ch.tier = ''light'' and public._challenge_eligible(v_uid, ch.metric) and (ch.city_scope');
    v_new := replace(v_new, E'ch.tier = v_third_tier and (ch.city_scope', E'ch.tier = v_third_tier and public._challenge_eligible(v_uid, ch.metric) and (ch.city_scope');
    if (length(v_new) - length(replace(v_new, '_challenge_eligible', ''))) / length('_challenge_eligible') <> 6 then
      raise exception 'sync_my_challenges: expected 6 draw queries';
    end if;
    execute v_new;
  end if;

  -- the swap and the bought 4th task draw challenges too: same rule there
  v_def := pg_get_functiondef('public.swap_challenge'::regproc);
  if position('_challenge_eligible' in v_def) = 0 then
    v_new := replace(v_def, E'where ch.tier = v_tier and (ch.city_scope', E'where ch.tier = v_tier and public._challenge_eligible(v_uid, ch.metric) and (ch.city_scope');
    if (length(v_new) - length(replace(v_new, '_challenge_eligible', ''))) / length('_challenge_eligible') <> 2 then
      raise exception 'swap_challenge: expected 2 draw queries';
    end if;
    execute v_new;
  end if;

  v_def := pg_get_functiondef('public.buy_extra_challenge'::regproc);
  if position('_challenge_eligible' in v_def) = 0 then
    v_new := replace(v_def, E'where (ch.city_scope is null or ch.city_scope = p_city)', E'where public._challenge_eligible(v_uid, ch.metric) and (ch.city_scope is null or ch.city_scope = p_city)');
    if (length(v_new) - length(replace(v_new, '_challenge_eligible', ''))) / length('_challenge_eligible') <> 2 then
      raise exception 'buy_extra_challenge: expected 2 draw queries';
    end if;
    execute v_new;
  end if;
end
$patch$;

-- ---------------------------------------------------------------- the challenges

insert into public.challenges (id, tier, name, description, metric, target, params, coin_reward, city_scope, sort_order) values
  -- soft: things to do around the app, no fishing needed
  ('boltun',          'soft',   'Болтун',                  'Оставь три комментария под чужими уловами',              'comments_written',   3, '{}',            10, null,  7),
  ('azart',           'soft',   'Азарт',                   'Крутани барабаны в слотах пять раз',                     'slot_spins',         5, '{}',            10, null,  8),
  ('kaznachey',       'soft',   'Казначей',                'Забери монеты из казны три раза',                        'treasury_collected', 3, '{}',            10, null,  9),
  ('ezhednevnik',     'soft',   'Каждый день понемногу',   'Забери ежедневную награду в четыре разных дня',          'daily_reward_days',  4, '{}',            15, null, 17),
  ('geograf',         'soft',   'Географ',                 'Сыграй в «Где это?» в три разных дня',                   'geo_days',           3, '{}',            15, null, 18),
  -- light
  ('populyarnyy',     'light',  'Популярный',              'Собери три лайка под своими уловами',                    'likes_received',     3, '{}',            25, null, 19),
  ('razgovor',        'light',  'Есть о чём поговорить',   'Получи комментарий под своим уловом',                    'comments_received',  1, '{}',            25, null, 20),
  ('komandnyy_duh',   'light',  'Командный дух',           'Напиши три сообщения в чате своего клана',               'clan_messages_sent', 3, '{}',            20, null, 21),
  -- medium
  ('pyaterka',        'medium', 'Пятёрка',                 'Пять уловов за неделю',                                  'catch_any',          5, '{}',            55, null, 27),
  ('tyazhelovec',     'medium', 'Тяжеловес',               'Улов тяжелее 2 кг',                                      'catch_over_kg',      1, '{"min": 2}',    55, null, 28),
  ('krupnyak',        'medium', 'Крупняк',                 'Улов длиннее 50 см',                                     'catch_over_cm',      1, '{"min": 50}',   60, null, 29),
  ('goryachaya',      'medium', 'На горячем',              'Поймай рыбу в горячем секторе, пока он горит',           'catch_hot_sector',   1, '{}',            50, null, 36),
  ('flag',            'medium', 'Флаг на карте',           'Захвати любой сектор',                                   'claims_made',        1, '{}',            50, null, 37),
  ('dusha_kompanii',  'medium', 'Душа компании',           'Собери десять лайков под своими уловами',                'likes_received',    10, '{}',            55, null, 38),
  ('svoi_lyudi',      'medium', 'Свои люди',               'Получи двух новых подписчиков',                          'followers_gained',   2, '{}',            45, null, 39),
  ('metkiy_glaz',     'medium', 'Меткий глаз',             'Дважды верно угадай место в «Где это?»',                 'geo_correct',        2, '{}',            45, null, 40),
  ('golos_klana',     'medium', 'Голос клана',             'Напиши десять сообщений в чате своего клана',            'clan_messages_sent',10, '{}',            40, null, 41),
  -- hard
  ('desyatka',        'hard',   'Десятка',                 'Десять уловов за неделю',                                'catch_any',         10, '{}',           130, null, 35),
  ('bez_vyhodnyh',    'hard',   'Без выходных',            'Уловы в пять разных дней одной недели',                  'distinct_days',      5, '{}',           120, null, 42),
  ('professor',       'hard',   'Профессор',               'Пять разных видов рыбы за неделю',                       'distinct_species',   5, '{}',           120, null, 43),
  ('ekspansiya',      'hard',   'Экспансия',               'Захвати три разных сектора за неделю',                   'claims_made',        3, '{}',           140, null, 44)
on conflict (id) do nothing;
