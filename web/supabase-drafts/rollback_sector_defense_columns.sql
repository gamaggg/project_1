-- Откат sector_defense_columns.sql (только если что-то пошло не так до релиза).
-- Колонку представления CREATE OR REPLACE убрать не может — представление пересоздаётся,
-- поэтому права выдаются заново ровно такими, какими были (relacl 05.10: arwdDxtm для
-- postgres, anon, authenticated, service_role).
set local lock_timeout = '10s';
lock table public.territories_with_stats, public.profiles_with_stats in access exclusive mode;
lock table public.territories in access exclusive mode;

drop view public.territories_with_stats;
create view public.territories_with_stats as
 SELECT t.id,
    t.kind,
    t.lat,
    t.lng,
    t.owner_id,
    t.claimed_at,
    t.created_at,
    COALESCE(c.catch_count, (0)::bigint) AS catch_count,
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
    ( SELECT jsonb_agg(jsonb_build_object('id', s.user_id, 'avatar_url', sp.avatar_url, 'display_name', sp.display_name) ORDER BY s.joined_at) AS jsonb_agg
           FROM (territory_shares s
             JOIN profiles sp ON ((sp.id = s.user_id)))
          WHERE (s.territory_id = t.id)) AS co_holders,
        CASE
            WHEN (EXISTS ( SELECT 1
               FROM territory_shares s
              WHERE (s.territory_id = t.id))) THEN ( SELECT ch.user_id
               FROM catches ch
              WHERE ((ch.territory_id = t.id) AND ((ch.user_id = t.owner_id) OR (EXISTS ( SELECT 1
                       FROM territory_shares s2
                      WHERE ((s2.territory_id = t.id) AND (s2.user_id = ch.user_id))))))
              ORDER BY ch.caught_at DESC
             LIMIT 1)
            ELSE NULL::uuid
        END AS capturer_id,
    ( SELECT max(hs.ends_at) AS max
           FROM hot_sectors hs
          WHERE ((hs.territory_id = t.id) AND (now() >= hs.starts_at) AND (now() < hs.ends_at))) AS hot_until,
    ( SELECT c_1.user_id
           FROM (catches c_1
             JOIN profiles lp ON (((lp.id = c_1.user_id) AND (NOT COALESCE(lp.is_blocked, false)))))
          WHERE ((c_1.territory_id = t.id) AND (c_1.caught_at > (now() - '90 days'::interval)))
          GROUP BY c_1.user_id
         HAVING (count(*) >= 10)
          ORDER BY (count(*)) DESC, (min(c_1.caught_at))
         LIMIT 1) AS legend_id
   FROM ((((territories t
     LEFT JOIN ( SELECT catches.territory_id,
            count(*) AS catch_count,
            max(catches.caught_at) AS last_catch_at
           FROM catches
          GROUP BY catches.territory_id) c ON ((c.territory_id = t.id)))
     LEFT JOIN profiles p ON ((p.id = t.owner_id)))
     LEFT JOIN clan_members cm ON (((cm.user_id = t.owner_id) AND (cm.left_at IS NULL) AND (cm.city =
        CASE
            WHEN ("left"(t.id, 1) = 'M'::text) THEN 'moscow'::text
            ELSE 'batumi'::text
        END))))
     LEFT JOIN clans cl ON ((cl.id = cm.clan_id)))
  ORDER BY t.id;

grant all on public.territories_with_stats to anon, authenticated, service_role;

alter table public.territories drop column defense, drop column defense_at;
