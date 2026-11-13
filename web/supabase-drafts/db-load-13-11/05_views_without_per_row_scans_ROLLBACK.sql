-- Откат 05_views_without_per_row_scans.sql: оба представления ровно как были 13.11.2026 (pg_get_viewdef живой базы).
-- CREATE OR REPLACE: столбцы те же, права (GRANT) сохраняются.
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
    ( SELECT count(*) AS count
           FROM territories t
          WHERE t.owner_id = p.id OR NOT COALESCE(t.is_deleted, false) AND (EXISTS ( SELECT 1
                   FROM territory_shares s
                  WHERE s.territory_id = t.id AND s.user_id = p.id))) AS territories_count,
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
    ( SELECT jsonb_agg(jsonb_build_object('id', s.user_id, 'avatar_url', sp.avatar_url, 'display_name', sp.display_name, 'equipped_skin', sp.equipped_skin, 'territory_color', sp.territory_color) ORDER BY s.joined_at) AS jsonb_agg
           FROM territory_shares s
             JOIN profiles sp ON sp.id = s.user_id
          WHERE s.territory_id = t.id) AS co_holders,
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
    ( SELECT max(hs.ends_at) AS max
           FROM hot_sectors hs
          WHERE hs.territory_id = t.id AND now() >= hs.starts_at AND now() < hs.ends_at) AS hot_until,
    ( SELECT c_1.user_id
           FROM catches c_1
             JOIN profiles lp ON lp.id = c_1.user_id AND NOT COALESCE(lp.is_blocked, false)
          WHERE c_1.territory_id = t.id AND c_1.caught_at > (now() - '90 days'::interval)
          GROUP BY c_1.user_id
         HAVING count(*) >= 10
          ORDER BY (count(*)) DESC, (min(c_1.caught_at))
         LIMIT 1) AS legend_id,
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
  ORDER BY t.id;
