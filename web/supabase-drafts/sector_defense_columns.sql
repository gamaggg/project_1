-- Большое обновление: «Защита сектора» — колонки и защита «на сейчас» в territories_with_stats.
-- Нынешний клиент этого не видит (новые колонки, новая колонка в конце представления).
-- Логика — атака/укрепление в confirm_catch, начальные значения, уведомление — в релизной
-- миграции (release/confirm_catch_offline.sql, release/game_notifications.sql).
--
-- defense      — защита 0–3 на момент defense_at;
-- defense_at   — когда её последний раз меняли (укрепление, атака, захват).
-- Без уловов владельца защита тает на 1 в сутки — считается на лету от defense_at, без cron:
-- greatest(0, defense - полных суток с defense_at).

set local lock_timeout = '10s';
-- Сначала представления, потом таблица — в том же порядке, что запросы приложения
-- (иначе 27.09 прогон упёрся в взаимную блокировку с живыми чтениями).
lock table public.territories_with_stats, public.profiles_with_stats in access exclusive mode;
lock table public.territories in access exclusive mode;

do $$
begin
  if md5(pg_get_viewdef('public.territories_with_stats'::regclass)) <> '568c204cbbffbf205c5928ffe597530f' then
    raise exception 'territories_with_stats изменилось после написания черновика';
  end if;
end $$;

alter table public.territories
  add column defense smallint not null default 0 check (defense between 0 and 3),
  add column defense_at timestamptz;

-- CREATE OR REPLACE: права представления сохраняются. Новая колонка — в конце.
create or replace view public.territories_with_stats as
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
         LIMIT 1) AS legend_id,
        CASE
            WHEN (t.owner_id IS NULL) THEN 0
            ELSE GREATEST(0, (t.defense - (floor((EXTRACT(epoch FROM (now() - COALESCE(t.defense_at, now()))) / (86400)::numeric)))::integer))
        END AS defense
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
