-- Нагрузка на бесплатный Supabase, блок Г (13.11.2026): два представления без перебора на каждую строку.
--
-- profiles_with_stats (профиль игрока, монеты, клан — 13 тыс. запросов с 03.09, 139 мс в среднем):
--   territories_count считался одним запросом «сектор мой ИЛИ (не удалён И я совладелец)». Из-за ИЛИ индекс по
--   владельцу не работал, и на каждый профиль перебирались все 8 856 секторов (13 из 14 мс на «тёплой» базе).
--   Теперь две части по индексам: мои сектора + не удалённые совместные, где владелец не я (части не пересекаются,
--   совладелец у сектора один раз — первичный ключ territory_shares). Число то же.
-- territories_with_stats (сектора на карте — 70–210 мс на город):
--   co_holders, hot_until и legend_id считались подзапросом для каждого сектора (для Москвы ≈5 000 раз за запрос,
--   в том числе перебор territory_shares — «49 млн переборов» из чек-листа). Теперь каждый считается один раз на
--   запрос (группировка по сектору) и присоединяется; фильтр по id сектора при этом по-прежнему проходит внутрь.
--   capturer_id не тронут: он и так считается только для совместных секторов.
--
-- Всё остальное — слово в слово как было (из pg_get_viewdef 13.11): те же столбцы, тот же порядок и типы, поэтому
-- CREATE OR REPLACE и права (GRANT) сохраняются. Права владельца (без security_invoker) не меняются намеренно:
-- игроки читают монеты и профиль только через это представление.
-- Прогон (dry_run_05.sql): ответы старого и нового представления совпали построчно (все столбцы), время — в README.
-- Откат: 05_views_without_per_row_scans_ROLLBACK.sql.

set local lock_timeout = '3s';
set local search_path = public, extensions;

create or replace view public.profiles_with_stats as
 SELECT p.id,
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
     LEFT JOIN clans cl ON cl.id = cm.clan_id;

create or replace view public.territories_with_stats as
 SELECT t.id,
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
  ORDER BY t.id;
