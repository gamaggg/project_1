-- Прогон 05, часть 1 (13.11.2026): живые представления не трогаются вовсе. Новое определение создаётся временным
-- представлением (pg_temp), его ответ сравнивается с живым, время замеряется на запросах приложения.
-- Ответ — в тексте ошибки «ПРОГОН 05-1 …»; временные представления исчезают с откатом.
do $dry$
declare
  claims text[] := array[
    null,
    json_build_object('sub', '77c8ade9-7df4-4f81-a32c-61153d9a859e', 'role', 'authenticated')::text,
    json_build_object('sub', 'eb34bf9e-090f-4942-a7e7-85db5cd43048', 'role', 'authenticated')::text];
  cl text; d1 bigint; d2 bigint; res jsonb := '{}'; j json; q text;
  sample uuid[]; k int := 0;
begin
  set local search_path = public, extensions;
  set local statement_timeout = '60s';
  execute $v$create temp view tws_new as SELECT t.id,
    t.kind,
    t.lat,
    t.lng,
    t.owner_id,
    t.claimed_at,
    t.created_at,
    COALESCE(c.catch_count, 0::bigint) AS catch_count,
    c.last_catch_at,
    t.is_deleted,
    t.corners,
    p.avatar_url AS owner_avatar_url,
    p.display_name AS owner_display_name,
    t.shield_until,
    p.equipped_skin AS owner_equipped_skin,
    cm.clan_id AS owner_clan_id,
    cl.name AS owner_clan_name,
    cl.crest AS owner_clan_crest,
    sh.co_holders,
        CASE
            WHEN (EXISTS ( SELECT 1
               FROM territory_shares s
              WHERE s.territory_id = t.id)) THEN ( SELECT ch.user_id
               FROM catches ch
              WHERE ch.territory_id = t.id AND (ch.user_id = t.owner_id OR (EXISTS ( SELECT 1
                       FROM territory_shares s2
                      WHERE s2.territory_id = t.id AND s2.user_id = ch.user_id)))
              ORDER BY ch.caught_at DESC
             LIMIT 1)
            ELSE NULL::uuid
        END AS capturer_id,
    hs.hot_until,
    lg.legend_id,
        CASE
            WHEN t.owner_id IS NULL THEN 0
            ELSE GREATEST(0, t.defense - floor(EXTRACT(epoch FROM now() - COALESCE(t.defense_at, now())) / 86400::numeric)::integer)
        END AS defense,
    p.territory_color AS owner_territory_color,
    t.kind_changed_at
   FROM territories t
     LEFT JOIN ( SELECT catches.territory_id,
            count(*) AS catch_count,
            max(catches.caught_at) AS last_catch_at
           FROM catches
          GROUP BY catches.territory_id) c ON c.territory_id = t.id
     LEFT JOIN profiles p ON p.id = t.owner_id
     LEFT JOIN clan_members cm ON cm.user_id = t.owner_id AND cm.left_at IS NULL AND cm.city = _prefix_city("left"(t.id, 1))
     LEFT JOIN clans cl ON cl.id = cm.clan_id
     LEFT JOIN ( SELECT s.territory_id,
            jsonb_agg(jsonb_build_object('id', s.user_id, 'avatar_url', sp.avatar_url, 'display_name', sp.display_name, 'equipped_skin', sp.equipped_skin, 'territory_color', sp.territory_color) ORDER BY s.joined_at) AS co_holders
           FROM territory_shares s
             JOIN profiles sp ON sp.id = s.user_id
          GROUP BY s.territory_id) sh ON sh.territory_id = t.id
     LEFT JOIN ( SELECT hs_1.territory_id,
            max(hs_1.ends_at) AS hot_until
           FROM hot_sectors hs_1
          WHERE now() >= hs_1.starts_at AND now() < hs_1.ends_at
          GROUP BY hs_1.territory_id) hs ON hs.territory_id = t.id
     LEFT JOIN ( SELECT DISTINCT ON (x.territory_id) x.territory_id,
            x.user_id AS legend_id
           FROM ( SELECT c_1.territory_id,
                    c_1.user_id,
                    count(*) AS n,
                    min(c_1.caught_at) AS first_at
                   FROM catches c_1
                     JOIN profiles lp ON lp.id = c_1.user_id AND NOT COALESCE(lp.is_blocked, false)
                  WHERE c_1.caught_at > (now() - '90 days'::interval)
                  GROUP BY c_1.territory_id, c_1.user_id
                 HAVING count(*) >= 10) x
          ORDER BY x.territory_id, x.n DESC, x.first_at) lg ON lg.territory_id = t.id
  ORDER BY t.id$v$;
  execute $v$create temp view pws_new as SELECT p.id,
    p.display_name,
    p.location,
    p.avatar_url,
    p.created_at,
    ( SELECT count(*) AS count
           FROM follows f
          WHERE f.followee_id = p.id) AS followers_count,
    ( SELECT count(*) AS count
           FROM follows f
          WHERE f.follower_id = p.id) AS following_count,
    p.bio,
    p.is_admin,
    p.is_blocked,
    p.public_id,
    p.is_super_admin,
        CASE
            WHEN p.id = auth.uid() THEN p.birth_date
            ELSE NULL::date
        END AS birth_date,
        CASE
            WHEN p.id = auth.uid() THEN p.gender
            ELSE NULL::text
        END AS gender,
        CASE
            WHEN p.id = auth.uid() THEN p.height_cm
            ELSE NULL::smallint
        END AS height_cm,
        CASE
            WHEN p.id = auth.uid() THEN p.weight_kg
            ELSE NULL::numeric
        END AS weight_kg,
    p.territory_color,
    p.onboarding_completed,
    ( SELECT count(*) AS count
           FROM catches c
          WHERE c.user_id = p.id) AS catches_count,
    (( SELECT count(*) AS count
           FROM territories t
          WHERE t.owner_id = p.id) + ( SELECT count(*) AS count
           FROM territory_shares s
             JOIN territories t ON t.id = s.territory_id
          WHERE s.user_id = p.id AND NOT COALESCE(t.is_deleted, false) AND t.owner_id IS DISTINCT FROM p.id)) AS territories_count,
        CASE
            WHEN p.id = auth.uid() THEN p.can_moderate_reports
            ELSE NULL::boolean
        END AS can_moderate_reports,
        CASE
            WHEN p.id = auth.uid() THEN p.can_block_users
            ELSE NULL::boolean
        END AS can_block_users,
        CASE
            WHEN p.id = auth.uid() THEN p.can_add_catch_manually
            ELSE NULL::boolean
        END AS can_add_catch_manually,
        CASE
            WHEN p.id = auth.uid() THEN p.can_view_all_users
            ELSE NULL::boolean
        END AS can_view_all_users,
    p.city,
    p.hero_bg,
    p.equipped_frame,
        CASE
            WHEN p.id = auth.uid() OR (EXISTS ( SELECT 1
               FROM profiles me
              WHERE me.id = auth.uid() AND me.is_super_admin)) THEN p.coins
            ELSE NULL::integer
        END AS coins,
    p.equipped_name_style,
    p.equipped_skin,
        CASE
            WHEN p.id = auth.uid() THEN p.can_add_catch_from_gallery
            ELSE NULL::boolean
        END AS can_add_catch_from_gallery,
    cm.clan_id,
    cl.name AS clan_name,
    cl.crest AS clan_crest,
    cm.role AS clan_role,
        CASE
            WHEN p.id = auth.uid() THEN p.can_review_panoramas
            ELSE NULL::boolean
        END AS can_review_panoramas,
        CASE
            WHEN p.id = auth.uid() THEN p.can_view_stats
            ELSE NULL::boolean
        END AS can_view_stats,
        CASE
            WHEN p.id = auth.uid() THEN p.can_view_limits
            ELSE NULL::boolean
        END AS can_view_limits,
        CASE
            WHEN p.id = auth.uid() THEN p.can_message_players
            ELSE NULL::boolean
        END AS can_message_players
   FROM profiles p
     LEFT JOIN clan_members cm ON cm.user_id = p.id AND cm.left_at IS NULL AND cm.city = COALESCE(p.city, 'batumi'::text)
     LEFT JOIN clans cl ON cl.id = cm.clan_id$v$;

  -- Сектора: все 8 856 строк, все столбцы, в обе стороны.
  select count(*) into d1 from (select * from public.territories_with_stats except all select * from pg_temp.tws_new) x;
  select count(*) into d2 from (select * from pg_temp.tws_new except all select * from public.territories_with_stats) x;
  res := res || jsonb_build_object('territories_rows', (select count(*) from pg_temp.tws_new), 'territories_only_old', d1, 'territories_only_new', d2);
  res := res || jsonb_build_object('nonnull', jsonb_build_object(
    'co_holders', (select count(*) from pg_temp.tws_new where co_holders is not null),
    'hot_until', (select count(*) from pg_temp.tws_new where hot_until is not null),
    'legend_id', (select count(*) from pg_temp.tws_new where legend_id is not null),
    'capturer_id', (select count(*) from pg_temp.tws_new where capturer_id is not null)));

  -- Профили: число секторов у всех — против независимого подсчёта (объединение «владею» и «совладею, не удалён»).
  select count(*) into d1 from public.profiles p
  left join pg_temp.pws_new n on n.id = p.id
  left join (select u, count(distinct tid) k from (
      select owner_id u, id tid from public.territories where owner_id is not null
      union select s.user_id, t.id from public.territory_shares s join public.territories t on t.id = s.territory_id where not coalesce(t.is_deleted, false)) z group by u) e on e.u = p.id
  where n.territories_count is distinct from coalesce(e.k, 0);
  res := res || jsonb_build_object('profiles', (select count(*) from public.profiles), 'territories_count_mismatch', d1,
    'profiles_with_sectors', (select count(*) from pg_temp.pws_new where territories_count > 0));

  -- Профили: все столбцы старого и нового — у совладельцев, у 20 самых крупных владельцев и 10 случайных,
  -- под тремя «кто спрашивает»: никто, обычный игрок, суперадмин (от этого зависят монеты и личные поля).
  select array_agg(id) into sample from (
    (select distinct user_id id from public.territory_shares)
    union (select owner_id from public.territories where owner_id is not null group by owner_id order by count(*) desc limit 20)
    union (select id from public.profiles order by random() limit 10)) s;
  foreach cl in array claims loop
    perform set_config('request.jwt.claims', coalesce(cl, ''), true);
    select count(*) into d1 from (select * from public.profiles_with_stats where id = any(sample) except all select * from pg_temp.pws_new where id = any(sample)) x;
    select count(*) into d2 from (select * from pg_temp.pws_new where id = any(sample) except all select * from public.profiles_with_stats where id = any(sample)) x;
    res := res || jsonb_build_object('profiles_diff_' || coalesce(cl::json->>'sub', 'anon'), d1 + d2);
  end loop;
  res := res || jsonb_build_object('profiles_sampled', cardinality(sample));

  -- Время на запросах приложения (мс, «тёплая» база): старое → новое.
  foreach q in array array[
    $q$select id, co_holders, capturer_id, hot_until, legend_id, defense, catch_count, owner_clan_id from %s where (id like 'M%%' and (owner_id is not null or catch_count > 0 or last_catch_at is not null or shield_until is not null or hot_until is not null or legend_id is not null or capturer_id is not null or co_holders is not null or defense > 0 or kind_changed_at is not null or created_at > '2026-11-01')) or owner_id = 'eb34bf9e-090f-4942-a7e7-85db5cd43048' order by id limit 1000$q$,
    $q$select id, co_holders, capturer_id, hot_until, legend_id, defense, catch_count from %s where (id like 'B%%' and (owner_id is not null or catch_count > 0 or last_catch_at is not null or shield_until is not null or hot_until is not null or legend_id is not null or capturer_id is not null or co_holders is not null or defense > 0 or kind_changed_at is not null or created_at > '2026-11-01')) or owner_id = 'eb34bf9e-090f-4942-a7e7-85db5cd43048' order by id limit 1000$q$,
    $q$select * from %s where id in ('B0144', 'M0167', 'P0001')$q$]
  loop
    execute 'explain (analyze, format json) ' || format(q, 'public.territories_with_stats') into j;
    execute 'explain (analyze, format json) ' || format(q, 'public.territories_with_stats') into j;
    d1 := round((j->0->>'Execution Time')::numeric);
    execute 'explain (analyze, format json) ' || format(q, 'pg_temp.tws_new') into j;
    execute 'explain (analyze, format json) ' || format(q, 'pg_temp.tws_new') into j;
    k := k + 1;
    res := res || jsonb_build_object('ms_territories_' || k, (d1::text || ' → ' || round((j->0->>'Execution Time')::numeric, 1)::text));
  end loop;
  execute $e$explain (analyze, format json) select * from public.profiles_with_stats where id = 'a44d3028-7f05-418e-82b8-84da341bd7ed'$e$ into j;
  execute $e$explain (analyze, format json) select * from public.profiles_with_stats where id = 'a44d3028-7f05-418e-82b8-84da341bd7ed'$e$ into j;
  q := round((j->0->>'Execution Time')::numeric, 1)::text;
  execute $e$explain (analyze, format json) select * from pg_temp.pws_new where id = 'a44d3028-7f05-418e-82b8-84da341bd7ed'$e$ into j;
  execute $e$explain (analyze, format json) select * from pg_temp.pws_new where id = 'a44d3028-7f05-418e-82b8-84da341bd7ed'$e$ into j;
  res := res || jsonb_build_object('ms_profile', q || ' → ' || round((j->0->>'Execution Time')::numeric, 1)::text);

  raise exception 'ПРОГОН 05-1 (откатано): %', res;
end
$dry$;
