-- Скины на общих секторах (решение 06.10): в co_holders каждого совладельца добавлен его надетый
-- скин территории (equipped_skin) — карта красит его часть сектора его узором, как часть владельца
-- узором владельца (owner_equipped_skin). Остальное представление без изменений.
-- CREATE OR REPLACE: те же колонки, опций у представления нет, права (anon/authenticated) сохраняются.

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
    ( SELECT jsonb_agg(jsonb_build_object('id', s.user_id, 'avatar_url', sp.avatar_url, 'display_name', sp.display_name, 'equipped_skin', sp.equipped_skin) ORDER BY s.joined_at) AS jsonb_agg
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
        END AS defense
   FROM territories t
     LEFT JOIN ( SELECT catches.territory_id,
            count(*) AS catch_count,
            max(catches.caught_at) AS last_catch_at
           FROM catches
          GROUP BY catches.territory_id) c ON c.territory_id = t.id
     LEFT JOIN profiles p ON p.id = t.owner_id
     LEFT JOIN clan_members cm ON cm.user_id = t.owner_id AND cm.left_at IS NULL AND cm.city =
        CASE
            WHEN "left"(t.id, 1) = 'M'::text THEN 'moscow'::text
            ELSE 'batumi'::text
        END
     LEFT JOIN clans cl ON cl.id = cm.clan_id
  ORDER BY t.id;
