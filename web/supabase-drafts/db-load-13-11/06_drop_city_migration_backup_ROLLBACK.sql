-- Откат 06_drop_city_migration_backup.sql: таблица _city_migration_backup как была 13.11.2026 — те же столбцы,
-- RLS включён без правил, права только у postgres и service_role, все 33 строки (выгружены 13.11 через API).
set local lock_timeout = '3s';

create table public._city_migration_backup (
  fn_oid oid not null,
  proname text not null,
  def text not null,
  saved_at timestamptz not null default now()
);
alter table public._city_migration_backup enable row level security;
revoke all on public._city_migration_backup from public, anon, authenticated;
grant all on public._city_migration_backup to service_role;

insert into public._city_migration_backup (fn_oid, proname, def, saved_at) values
(17624, 'territories_with_stats', $bk$create or replace view public.territories_with_stats as  SELECT t.id,
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
    p.territory_color AS owner_territory_color
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
  ORDER BY t.id;$bk$, '2026-10-19T21:42:44.272455+00:00'),
(18607, 'notification_deliver_after_from', $bk$CREATE OR REPLACE FUNCTION public.notification_deliver_after_from(p_city text, p_from timestamp with time zone)
 RETURNS timestamp with time zone
 LANGUAGE plpgsql
 STABLE
AS $function$
declare
  v_tz text := case p_city when 'moscow' then 'Europe/Moscow' else 'Asia/Tbilisi' end;
  v_local timestamp := (p_from at time zone v_tz);
  v_hour int := extract(hour from v_local)::int;
begin
  if v_hour >= 23 then
    return ((date_trunc('day', v_local) + interval '1 day' + interval '8 hours') at time zone v_tz);
  elsif v_hour < 8 then
    return ((date_trunc('day', v_local) + interval '8 hours') at time zone v_tz);
  else
    return p_from;
  end if;
end;
$function$
$bk$, '2026-10-19T21:42:44.272455+00:00'),
(18862, 'swap_challenge', $bk$CREATE OR REPLACE FUNCTION public.swap_challenge(p_user_challenge_id bigint, p_city text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_uid uuid := auth.uid();
  v_prefix text := case when p_city = 'moscow' then 'M' else 'B' end;
  v_price int;
  v_buff_name text;
  v_week_start timestamptz;
  v_tier text;
  v_current_challenge_id text;
  v_new_id text;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;

  select price, name into v_price, v_buff_name from public.buffs where id = 'challenge_swap';

  select uc.week_start, c.tier, uc.challenge_id
  into v_week_start, v_tier, v_current_challenge_id
  from public.user_challenges uc
  join public.challenges c on c.id = uc.challenge_id
  where uc.id = p_user_challenge_id and uc.user_id = v_uid and uc.settled = false;
  if not found then raise exception 'not swappable'; end if;

  if v_tier not in ('medium', 'hard') then
    raise exception 'only medium/hard challenges can be swapped';
  end if;

  insert into public.user_challenge_weeks (user_id, week_start) values (v_uid, v_week_start) on conflict do nothing;

  update public.profiles set coins = coins - v_price where id = v_uid and coins >= v_price;
  if not found then raise exception 'not enough coins'; end if;

  select ch.id into v_new_id from public.challenges ch
  where ch.tier = v_tier and public._challenge_eligible(v_uid, ch.metric) and (ch.city_scope is null or ch.city_scope = p_city)
    and ch.id <> v_current_challenge_id
    and ch.id not in (
      select uc2.challenge_id from public.user_challenges uc2
      where uc2.user_id = v_uid and uc2.week_start >= v_week_start - interval '14 days'
    )
  order by random() limit 1;
  if v_new_id is null then
    select ch.id into v_new_id from public.challenges ch
    where ch.tier = v_tier and public._challenge_eligible(v_uid, ch.metric) and (ch.city_scope is null or ch.city_scope = p_city) and ch.id <> v_current_challenge_id
    order by random() limit 1;
  end if;
  if v_new_id is null then raise exception 'no alternative challenge available'; end if;

  update public.user_challenges uc set
    challenge_id = v_new_id,
    completed_at = null,
    target = case when (select metric from public.challenges where id = v_new_id) = 'territory_kind_variety' then
      (select count(distinct kind) from public.territories where id like v_prefix || '%' and is_deleted = false)
    else (select target from public.challenges where id = v_new_id) end,
    coin_reward = (select coin_reward from public.challenges where id = v_new_id)
  where uc.id = p_user_challenge_id;

  update public.user_challenge_weeks set swap_used = true where user_id = v_uid and week_start = v_week_start;
  insert into public.coin_transactions (user_id, amount, reason, label) values (v_uid, -v_price, 'swap_challenge', v_buff_name);
end;
$function$
$bk$, '2026-10-19T21:42:44.272455+00:00'),
(18863, 'buy_extra_challenge', $bk$CREATE OR REPLACE FUNCTION public.buy_extra_challenge(p_city text, p_timezone text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_uid uuid := auth.uid();
  v_prefix text := case when p_city = 'moscow' then 'M' else 'B' end;
  v_price int;
  v_buff_name text;
  v_week_start timestamptz;
  v_new_id text;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;

  select price, name into v_price, v_buff_name from public.buffs where id = 'extra_challenge';
  v_week_start := date_trunc('week', now() at time zone p_timezone) at time zone p_timezone;

  insert into public.user_challenge_weeks (user_id, week_start) values (v_uid, v_week_start) on conflict do nothing;

  if (select extra_slot_bought from public.user_challenge_weeks where user_id = v_uid and week_start = v_week_start) then
    raise exception 'extra slot already bought this week';
  end if;

  update public.profiles set coins = coins - v_price where id = v_uid and coins >= v_price;
  if not found then raise exception 'not enough coins'; end if;

  select ch.id into v_new_id from public.challenges ch
  where public._challenge_eligible(v_uid, ch.metric) and (ch.city_scope is null or ch.city_scope = p_city)
    and ch.id not in (
      select uc.challenge_id from public.user_challenges uc
      where uc.user_id = v_uid and uc.week_start = v_week_start
    )
    and ch.id not in (
      select uc2.challenge_id from public.user_challenges uc2
      where uc2.user_id = v_uid and uc2.week_start >= v_week_start - interval '14 days'
    )
  order by random() limit 1;
  if v_new_id is null then
    select ch.id into v_new_id from public.challenges ch
    where public._challenge_eligible(v_uid, ch.metric) and (ch.city_scope is null or ch.city_scope = p_city)
      and ch.id not in (select uc.challenge_id from public.user_challenges uc where uc.user_id = v_uid and uc.week_start = v_week_start)
    order by random() limit 1;
  end if;
  if v_new_id is null then raise exception 'no challenge available'; end if;

  insert into public.user_challenges (user_id, week_start, challenge_id, target, coin_reward, city)
  select v_uid, v_week_start, ch.id,
    case when ch.metric = 'territory_kind_variety' then
      (select count(distinct kind) from public.territories where id like v_prefix || '%' and is_deleted = false)
    else ch.target end,
    ch.coin_reward, p_city
  from public.challenges ch where ch.id = v_new_id;

  update public.user_challenge_weeks set extra_slot_bought = true where user_id = v_uid and week_start = v_week_start;
  insert into public.coin_transactions (user_id, amount, reason, label) values (v_uid, -v_price, 'buy_extra_challenge', v_buff_name);
end;
$function$
$bk$, '2026-10-19T21:42:44.272455+00:00'),
(18869, 'sync_my_challenges', $bk$CREATE OR REPLACE FUNCTION public.sync_my_challenges(p_city text, p_timezone text)
 RETURNS TABLE(id bigint, challenge_id text, name text, description text, tier text, coin_reward integer, target integer, progress integer, completed_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_uid uuid := auth.uid();
  v_prefix text := case when p_city = 'moscow' then 'M' else 'B' end;
  v_week_start timestamptz;
  v_row record;
  v_row_city text;
  v_progress int;
  v_payout int;
  v_credited int;
  v_soft_id text;
  v_light_id text;
  v_third_tier text;
  v_third_id text;
  v_any_completed boolean := false;
  v_week_coins int;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  v_week_start := date_trunc('week', now() at time zone p_timezone) at time zone p_timezone;

  for v_row in
    select uc.id as row_id, uc.week_start, uc.target, uc.coin_reward, uc.city, c.metric, c.params, c.name as challenge_name
    from public.user_challenges uc
    join public.challenges c on c.id = uc.challenge_id
    where uc.user_id = v_uid and uc.settled = false
  loop
    -- Прогресс — по городу, для которого челлендж создан: московские уловы
    -- не закрывают батумскую неделю и наоборот, кто бы ни вызвал проверку.
    v_row_city := coalesce(v_row.city,
      case when (floor(extract(epoch from v_row.week_start) / 3600)::bigint % 24) = 21 then 'moscow' else 'batumi' end);
    v_progress := public.compute_challenge_progress(
      v_uid, v_row.metric, v_row.params, v_row.week_start, v_row.week_start + interval '7 days',
      case when v_row_city = 'moscow' then 'M' else 'B' end, public._city_tz(v_row_city)
    );

    if v_progress >= v_row.target then
      -- «and settled = false» + found: две одновременные проверки не
      -- заплатят дважды — вторая просто не найдёт незакрытую строку.
      update public.user_challenges uc set settled = true, completed_at = now() where uc.id = v_row.row_id and uc.settled = false;
      if found then
        v_credited := v_row.coin_reward * public.coin_multiplier(v_uid);
        update public.profiles p set coins = p.coins + v_credited where p.id = v_uid;
        insert into public.coin_transactions (user_id, amount, reason, label) values (v_uid, v_credited, 'challenge_reward', v_row.challenge_name);
        insert into public.notifications (user_id, kind, payload)
          values (v_uid, 'challenge_completed', jsonb_build_object('title', v_row.challenge_name, 'coins', v_credited));
        v_any_completed := true;
      end if;
    elsif v_row.week_start + interval '7 days' <= now() then
      update public.user_challenges uc set settled = true where uc.id = v_row.row_id and uc.settled = false;
      if found then
        v_payout := floor(v_progress::numeric / v_row.target * v_row.coin_reward);
        if v_payout > 0 then
          v_credited := v_payout * public.coin_multiplier(v_uid);
          update public.profiles p set coins = p.coins + v_credited where p.id = v_uid;
          insert into public.coin_transactions (user_id, amount, reason, label) values (v_uid, v_credited, 'challenge_reward', v_row.challenge_name || ' (частично)');
        end if;
      end if;
    end if;
  end loop;

  -- Fires exactly once — the moment the LAST still-open slot for this week
  -- settles, this call's own diff already found at least one fresh
  -- completion, and afterward none of this week's rows are still open. Any
  -- earlier or later sync for an already-fully-done week won't re-enter
  -- this branch, since v_any_completed stays false when nothing changed.
  if v_any_completed and not exists (
    select 1 from public.user_challenges uc4
    where uc4.user_id = v_uid and uc4.week_start = v_week_start and uc4.completed_at is null
  ) then
    select coalesce(sum(uc5.coin_reward), 0) * public.coin_multiplier(v_uid) into v_week_coins
    from public.user_challenges uc5
    where uc5.user_id = v_uid and uc5.week_start = v_week_start;

    insert into public.notifications (user_id, kind, payload)
      values (v_uid, 'challenges_week_done', jsonb_build_object('coins', v_week_coins));
  end if;

  if not exists (select 1 from public.user_challenges uc2 where uc2.user_id = v_uid and uc2.week_start = v_week_start) then
    select ch.id into v_soft_id from public.challenges ch
    where ch.tier = 'soft' and public._challenge_eligible(v_uid, ch.metric) and (ch.city_scope is null or ch.city_scope = p_city)
      and ch.id not in (
        select uc3.challenge_id from public.user_challenges uc3
        where uc3.user_id = v_uid and uc3.week_start >= v_week_start - interval '14 days'
      )
    order by random() limit 1;
    if v_soft_id is null then
      select ch.id into v_soft_id from public.challenges ch
      where ch.tier = 'soft' and public._challenge_eligible(v_uid, ch.metric) and (ch.city_scope is null or ch.city_scope = p_city)
      order by random() limit 1;
    end if;

    select ch.id into v_light_id from public.challenges ch
    where ch.tier = 'light' and public._challenge_eligible(v_uid, ch.metric) and (ch.city_scope is null or ch.city_scope = p_city)
      and ch.id not in (
        select uc3.challenge_id from public.user_challenges uc3
        where uc3.user_id = v_uid and uc3.week_start >= v_week_start - interval '14 days'
      )
    order by random() limit 1;
    if v_light_id is null then
      select ch.id into v_light_id from public.challenges ch
      where ch.tier = 'light' and public._challenge_eligible(v_uid, ch.metric) and (ch.city_scope is null or ch.city_scope = p_city)
      order by random() limit 1;
    end if;

    v_third_tier := case when random() < 0.5 then 'medium' else 'hard' end;
    select ch.id into v_third_id from public.challenges ch
    where ch.tier = v_third_tier and public._challenge_eligible(v_uid, ch.metric) and (ch.city_scope is null or ch.city_scope = p_city)
      and ch.id not in (
        select uc3.challenge_id from public.user_challenges uc3
        where uc3.user_id = v_uid and uc3.week_start >= v_week_start - interval '14 days'
      )
    order by random() limit 1;
    if v_third_id is null then
      select ch.id into v_third_id from public.challenges ch
      where ch.tier = v_third_tier and public._challenge_eligible(v_uid, ch.metric) and (ch.city_scope is null or ch.city_scope = p_city)
      order by random() limit 1;
    end if;

    insert into public.user_challenges (user_id, week_start, challenge_id, target, coin_reward, city)
    select v_uid, v_week_start, ch.id,
      case when ch.metric = 'territory_kind_variety' then
        (select count(distinct t2.kind) from public.territories t2 where t2.id like v_prefix || '%' and t2.is_deleted = false)
      else ch.target end,
      ch.coin_reward, p_city
    from public.challenges ch
    where ch.id in (v_soft_id, v_light_id, v_third_id);
  end if;

  return query
  select uc.id, uc.challenge_id, c.name, c.description, c.tier, uc.coin_reward, uc.target,
    least(public.compute_challenge_progress(v_uid, c.metric, c.params, uc.week_start, uc.week_start + interval '7 days', v_prefix, p_timezone), uc.target),
    uc.completed_at
  from public.user_challenges uc
  join public.challenges c on c.id = uc.challenge_id
  where uc.user_id = v_uid and uc.week_start = v_week_start
  order by array_position(array['soft','light','medium','hard'], c.tier);
end;
$function$
$bk$, '2026-10-19T21:42:44.272455+00:00'),
(19239, '_sync_achievements_for_user', $bk$CREATE OR REPLACE FUNCTION public._sync_achievements_for_user(p_user_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_city text;
  v_is_moscow boolean;
  v_tz text;
  v_catches_count int;
  v_territories_count int;
  v_species_collector_count int;
  v_max_len numeric;
  v_max_weight numeric;
  v_has_early boolean;
  v_has_night boolean;
  v_has_marine boolean;
  v_has_freshwater boolean;
  v_methods_used int;
  v_baits_used int;
  v_water_kinds_caught int;
  v_max_same_species int;
  v_followers_count int;
  v_has_conquered boolean;
  v_required_kinds text[];
  v_all_baits_count int := 16;
  v_all_methods_count int := 5;
  v_key text;
  v_title text;
  v_reward int;
  v_multiplier int;
  v_unlocked text[] := '{}';
begin
  select coalesce(p.city::text, 'batumi') into v_city from public.profiles p where p.id = p_user_id;
  v_is_moscow := v_city = 'moscow';
  v_tz := case when v_is_moscow then 'Europe/Moscow' else 'Asia/Tbilisi' end;
  v_required_kinds := case when v_is_moscow then array['river','lake','pond'] else array['sea','river','lake','pond'] end;

  select count(*) into v_catches_count from public.catches c where c.user_id = p_user_id;
  select count(*) into v_territories_count from public.territories t where t.is_deleted = false and (t.owner_id = p_user_id or exists (select 1 from public.territory_shares s where s.territory_id = t.id and s.user_id = p_user_id));
  select count(*) into v_followers_count from public.follows f where f.followee_id = p_user_id;

  select
    coalesce(max(c.length_cm), 0),
    coalesce(max(c.weight_kg), 0),
    bool_or(extract(hour from c.caught_at at time zone v_tz) < 7),
    bool_or(extract(hour from c.caught_at at time zone v_tz) < 4),
    count(distinct c.method),
    count(distinct c.bait)
  into v_max_len, v_max_weight, v_has_early, v_has_night, v_methods_used, v_baits_used
  from public.catches c
  where c.user_id = p_user_id;

  select
    bool_or(s.category = 'marine'),
    bool_or(s.category = 'freshwater')
  into v_has_marine, v_has_freshwater
  from public.catches c join public.species s on s.key = c.species
  where c.user_id = p_user_id;

  if v_is_moscow then
    select count(distinct c.species) into v_species_collector_count
    from public.catches c
    where c.user_id = p_user_id and c.territory_id like 'M%';
  else
    select count(distinct c.species) into v_species_collector_count
    from public.catches c join public.species s on s.key = c.species
    where c.user_id = p_user_id and s.category = 'marine';
  end if;

  select count(distinct t.kind) into v_water_kinds_caught
  from public.catches c
  join public.territories t on t.id = c.territory_id
  where c.user_id = p_user_id and t.kind::text = any(v_required_kinds);

  select coalesce(max(cnt), 0) into v_max_same_species
  from (select count(*) as cnt from public.catches c where c.user_id = p_user_id group by c.species) s2;

  select exists(
    select 1 from public.activity_log al
    where al.user_id = p_user_id and al.kind = 'claim' and al.previous_owner_id is not null
  ) into v_has_conquered;

  if v_catches_count >= 1 then v_unlocked := array_append(v_unlocked, 'first'); end if;
  if v_territories_count >= 3 then v_unlocked := array_append(v_unlocked, 'territory'); end if;
  if v_species_collector_count >= 5 then v_unlocked := array_append(v_unlocked, 'species'); end if;
  if coalesce(v_has_early,false) then v_unlocked := array_append(v_unlocked, 'sunrise'); end if;
  if v_max_len >= 40 then v_unlocked := array_append(v_unlocked, 'record'); end if;
  if v_catches_count >= 10 then v_unlocked := array_append(v_unlocked, 'ten'); end if;
  if coalesce(v_has_night,false) then v_unlocked := array_append(v_unlocked, 'nightowl'); end if;
  if not v_is_moscow and coalesce(v_has_marine,false) and coalesce(v_has_freshwater,false) then v_unlocked := array_append(v_unlocked, 'universal'); end if;
  if v_methods_used >= v_all_methods_count then v_unlocked := array_append(v_unlocked, 'allmethods'); end if;
  if v_baits_used >= v_all_baits_count then v_unlocked := array_append(v_unlocked, 'allbaits'); end if;
  if v_water_kinds_caught >= array_length(v_required_kinds,1) then v_unlocked := array_append(v_unlocked, 'allwaters'); end if;
  if v_max_weight >= 1 then v_unlocked := array_append(v_unlocked, 'heavy'); end if;
  if v_max_len >= 60 then v_unlocked := array_append(v_unlocked, 'giant'); end if;
  if v_max_same_species >= 5 then v_unlocked := array_append(v_unlocked, 'loyal'); end if;
  if v_territories_count >= 10 then v_unlocked := array_append(v_unlocked, 'landlord'); end if;
  if v_followers_count >= 10 then v_unlocked := array_append(v_unlocked, 'popular'); end if;
  if v_has_conquered then v_unlocked := array_append(v_unlocked, 'conqueror'); end if;

  v_multiplier := public.coin_multiplier(p_user_id);

  foreach v_key in array v_unlocked loop
    if not exists (select 1 from public.user_achievements ua where ua.user_id = p_user_id and ua.achievement_key = v_key) then
      v_title := case v_key
        when 'first' then 'Первый улов'
        when 'territory' then 'Три территории'
        when 'species' then 'Коллекционер видов'
        when 'sunrise' then 'Ранний рыбак'
        when 'record' then 'Личный рекорд 40 см'
        when 'ten' then 'Десять уловов'
        when 'nightowl' then 'Ночной клёв'
        when 'universal' then 'Универсал'
        when 'allmethods' then 'Всеядный'
        when 'allbaits' then 'Экспериментатор'
        when 'allwaters' then 'Обошёл всё побережье'
        when 'heavy' then 'Тяжеловес'
        when 'giant' then 'Гигант'
        when 'loyal' then 'Постоянный клиент'
        when 'landlord' then 'Хозяин побережья'
        when 'popular' then 'Известный рыбак'
        when 'conqueror' then 'Отбил территорию'
      end;
      v_reward := case v_key
        when 'first' then 30
        when 'territory' then 60
        when 'sunrise' then 40
        when 'nightowl' then 40
        when 'species' then 80
        when 'record' then 70
        when 'ten' then 80
        when 'universal' then 60
        when 'heavy' then 70
        when 'loyal' then 80
        when 'allwaters' then 100
        when 'conqueror' then 100
        when 'allmethods' then 120
        when 'allbaits' then 140
        when 'giant' then 160
        when 'popular' then 160
        when 'landlord' then 200
      end;
      v_reward := v_reward * v_multiplier;

      insert into public.user_achievements (user_id, achievement_key) values (p_user_id, v_key);
      update public.profiles set coins = coins + v_reward where id = p_user_id;
      insert into public.coin_transactions (user_id, amount, reason, label)
      values (p_user_id, v_reward, 'achievement_reward', v_title);
      insert into public.notifications (user_id, kind, payload)
      values (p_user_id, 'award_granted', jsonb_build_object('title', v_title, 'subtitle', 'Достижение открыто', 'coins', v_reward));
    end if;
  end loop;
end;
$function$
$bk$, '2026-10-19T21:42:44.272455+00:00'),
(19750, 'admin_set_territory_kind', $bk$CREATE OR REPLACE FUNCTION public.admin_set_territory_kind(p_territory_id text, p_kind text, p_lat double precision DEFAULT NULL::double precision, p_lng double precision DEFAULT NULL::double precision)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_old text;
  v_found boolean;
  v_prefix text := left(p_territory_id, 1);
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and is_super_admin) then
    raise exception 'not authorized';
  end if;
  if p_kind not in ('sea', 'river', 'lake', 'pond') then
    raise exception 'unknown kind %', p_kind;
  end if;

  select t.kind::text into v_old from public.territories t where t.id = p_territory_id and t.is_deleted = false;
  v_found := found;
  if not v_found and exists (select 1 from public.territories t where t.id = p_territory_id) then
    raise exception 'territory % is deleted', p_territory_id;
  end if;
  if v_found and v_old = p_kind then
    return;
  end if;

  if v_found then
    update public.territories set kind = p_kind::territory_kind where id = p_territory_id;
  else
    insert into public.territories (id, kind, lat, lng) values (p_territory_id, p_kind::territory_kind, p_lat, p_lng);
  end if;

  -- Цель «Картографа» = число типов в городе; тип мог появиться или
  -- исчезнуть, открытые челленджи этого города пересчитываются.
  update public.user_challenges uc
  set target = (
    select count(distinct t.kind) from public.territories t
    where t.id like v_prefix || '%' and t.is_deleted = false
  )
  from public.challenges c, public.profiles p
  where c.id = uc.challenge_id and p.id = uc.user_id
    and c.metric = 'territory_kind_variety' and uc.settled = false
    and (case when coalesce(p.city::text, 'batumi') = 'moscow' then 'M' else 'B' end) = v_prefix;

  insert into public.admin_actions (admin_id, action, territory_id, details)
  values (
    auth.uid(), 'set_territory_kind', p_territory_id,
    'Сменил тип сектора ' || p_territory_id || ' на «' ||
      case p_kind when 'sea' then 'Море' when 'river' then 'Река' when 'lake' then 'Озеро' else 'Пруд' end || '»'
  );
end;
$function$
$bk$, '2026-10-19T21:42:44.272455+00:00'),
(20043, 'list_clans', $bk$CREATE OR REPLACE FUNCTION public.list_clans(p_city text, p_query text DEFAULT NULL::text)
 RETURNS TABLE(id bigint, name text, motto text, crest jsonb, background text, level integer, trophies integer, members integer, capacity integer, join_type text, min_sectors integer, sectors_held integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select c.id, c.name, c.motto, c.crest, c.background, public._clan_level(c.xp), c.trophies,
    (select count(*)::int from public.clan_members cm where cm.clan_id = c.id and cm.left_at is null),
    public._clan_capacity(public._clan_level(c.xp)) + c.extra_slots,
    c.join_type, c.min_sectors,
    (select count(*)::int from public.territories t
      join public.clan_members cm2 on cm2.user_id = t.owner_id and cm2.left_at is null
      where cm2.clan_id = c.id and t.is_deleted = false
        and t.id like (case when c.city = 'moscow' then 'M' else 'B' end) || '%')
  from public.clans c
  where c.disbanded_at is null
    and (
      -- Номер клана (как в «ID 15», можно с «#» или «id»): точное совпадение
      -- в любом городе — номером обычно делятся, чтобы найти конкретный клан.
      c.id::text = regexp_replace(coalesce(btrim(p_query), ''), '^(#|id\s*)', '', 'i')
      or (c.city = p_city
          and (p_query is null or btrim(p_query) = '' or c.name ilike '%' || btrim(p_query) || '%'))
    )
  order by c.id::text = regexp_replace(coalesce(btrim(p_query), ''), '^(#|id\s*)', '', 'i') desc,
    c.trophies desc, c.xp desc, c.created_at
  limit 100;
$function$
$bk$, '2026-10-19T21:42:44.272455+00:00'),
(20044, 'get_clan', $bk$CREATE OR REPLACE FUNCTION public.get_clan(p_clan_id bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_uid uuid := auth.uid();
  v_clan public.clans;
  v_my_role text;
  v_tz text;
  v_week_start timestamptz;
  v_prefix text;
begin
  select * into v_clan from public.clans c where c.id = p_clan_id;
  if not found then return null; end if;
  select cm.role into v_my_role from public.clan_members cm where cm.clan_id = p_clan_id and cm.user_id = v_uid and cm.left_at is null;
  v_tz := case when v_clan.city = 'moscow' then 'Europe/Moscow' else 'Asia/Tbilisi' end;
  v_week_start := date_trunc('week', now() at time zone v_tz) at time zone v_tz;
  v_prefix := case when v_clan.city = 'moscow' then 'M' else 'B' end;
  return jsonb_build_object(
    'id', v_clan.id,
    'city', v_clan.city,
    'name', v_clan.name,
    'motto', v_clan.motto,
    'announcement', case when v_my_role is not null then v_clan.announcement end,
    'crest', v_clan.crest,
    'background', v_clan.background,
    'join_type', v_clan.join_type,
    'min_sectors', v_clan.min_sectors,
    'xp', v_clan.xp,
    'level', public._clan_level(v_clan.xp),
    'capacity', public._clan_capacity(public._clan_level(v_clan.xp)) + v_clan.extra_slots, 'extra_slots', v_clan.extra_slots,
    'trophies', v_clan.trophies,
    'created_at', v_clan.created_at,
    'renamed_at', v_clan.renamed_at,
    'disbanded', v_clan.disbanded_at is not null,
    'my_role', v_my_role,
    'my_request_pending', exists (select 1 from public.clan_join_requests r where r.clan_id = p_clan_id and r.user_id = v_uid),
    'my_invite', exists (select 1 from public.clan_invites i where i.clan_id = p_clan_id and i.user_id = v_uid),
    'race_wins', (select count(*) from public.clan_weeks w where w.clan_id = p_clan_id and w.race_won),
    'won_last_week', exists (select 1 from public.clan_weeks w where w.clan_id = p_clan_id and w.race_won
                             and w.week_start = public._city_week_start(v_clan.city) - interval '7 days'),
    'sectors_held', (select count(*) from public.territories t
                     join public.clan_members cm2 on cm2.user_id = t.owner_id and cm2.left_at is null
                     where cm2.clan_id = p_clan_id and t.is_deleted = false and t.id like v_prefix || '%'),
    'members', coalesce((
      select jsonb_agg(jsonb_build_object(
        'user_id', cm.user_id,
        'display_name', p.display_name,
        'avatar_url', p.avatar_url,
        'name_style', p.equipped_name_style,
        'role', cm.role,
        'joined_at', cm.joined_at,
        'week_catches', (select count(*) from public.catches k where k.user_id = cm.user_id and k.caught_at >= v_week_start
                          and k.territory_id like v_prefix || '%'),
        'sectors', (select count(*) from public.territories t2 where t2.owner_id = cm.user_id and t2.is_deleted = false
                    and t2.id like v_prefix || '%')
      ) order by public._clan_role_rank(cm.role) desc, cm.joined_at)
      from public.clan_members cm join public.profiles p on p.id = cm.user_id
      where cm.clan_id = p_clan_id and cm.left_at is null), '[]'::jsonb),
    'requests', case when public._clan_role_rank(v_my_role) >= 2 then coalesce((
      select jsonb_agg(jsonb_build_object('user_id', r.user_id, 'display_name', p.display_name, 'avatar_url', p.avatar_url,
        'sectors', public._claimed_sectors_count(r.user_id), 'created_at', r.created_at) order by r.created_at)
      from public.clan_join_requests r join public.profiles p on p.id = r.user_id
      where r.clan_id = p_clan_id), '[]'::jsonb) end,
    'events', coalesce((
      select jsonb_agg(e) from (
        select jsonb_build_object('kind', ce.kind, 'actor_name', ap.display_name, 'target_name', tp.display_name,
          'payload', ce.payload, 'created_at', ce.created_at) e
        from public.clan_events ce
        left join public.profiles ap on ap.id = ce.actor_id
        left join public.profiles tp on tp.id = ce.target_id
        where ce.clan_id = p_clan_id
        order by ce.created_at desc limit 20) x), '[]'::jsonb)
  );
end;
$function$
$bk$, '2026-10-19T21:42:44.272455+00:00'),
(20052, 'get_catch_comments', $bk$CREATE OR REPLACE FUNCTION public.get_catch_comments(p_catch_id bigint)
 RETURNS TABLE(id bigint, parent_id bigint, user_id uuid, display_name text, avatar_url text, equipped_name_style text, reply_to_user_id uuid, reply_to_name text, body text, created_at timestamp with time zone, deleted boolean, clan_crest jsonb, clan_name text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  with k as (
    select case when left(ck.territory_id, 1) = 'M' then 'moscow' else 'batumi' end as city
    from public.catches ck where ck.id = p_catch_id
  )
  select cc.id, cc.parent_id, cc.user_id, p.display_name, p.avatar_url, p.equipped_name_style,
    cc.reply_to_user_id, rp.display_name,
    case when cc.deleted_at is null then cc.body end,
    cc.created_at, cc.deleted_at is not null,
    cl.crest, cl.name
  from public.catch_comments cc
  join public.profiles p on p.id = cc.user_id
  left join public.profiles rp on rp.id = cc.reply_to_user_id
  left join public.clan_members cm on cm.user_id = cc.user_id and cm.left_at is null and cm.city = (select k.city from k)
  left join public.clans cl on cl.id = cm.clan_id
  where cc.catch_id = p_catch_id
    and (cc.deleted_at is null or (cc.parent_id is null and exists (
      select 1 from public.catch_comments r where r.parent_id = cc.id and r.deleted_at is null)))
  order by cc.created_at;
$function$
$bk$, '2026-10-19T21:42:44.272455+00:00'),
(20094, '_clan_week_events', $bk$CREATE OR REPLACE FUNCTION public._clan_week_events(p_clan_id bigint, p_week_start timestamp with time zone)
 RETURNS TABLE(user_id uuid, at timestamp with time zone, kind text, meters integer, points integer)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  with clan as (
    select c.id, case when c.city = 'moscow' then 'M' else 'B' end as prefix
    from public.clans c where c.id = p_clan_id
  )
  select k.user_id, k.caught_at, 'catch'::text, 10, 1
  from clan
  join public.clan_members cm on cm.clan_id = clan.id
  join public.catches k on k.user_id = cm.user_id
  where cm.joined_at <= k.caught_at and (cm.left_at is null or cm.left_at > k.caught_at)
    and k.caught_at >= p_week_start and k.caught_at < p_week_start + interval '7 days'
    and k.territory_id like clan.prefix || '%'
  union all
  select al.user_id, al.created_at, 'capture'::text,
    case when exists (
      select 1 from public.clan_members pm
      where pm.user_id = al.previous_owner_id and pm.clan_id <> p_clan_id
        and pm.joined_at <= al.created_at and (pm.left_at is null or pm.left_at > al.created_at)
    ) then 50 else 30 end,
    3
  from clan
  join public.clan_members cm on cm.clan_id = clan.id
  join public.activity_log al on al.user_id = cm.user_id and al.kind = 'claim'
  where cm.joined_at <= al.created_at and (cm.left_at is null or cm.left_at > al.created_at)
    and al.created_at >= p_week_start and al.created_at < p_week_start + interval '7 days'
    and al.territory_id like clan.prefix || '%'
  union all
  select uc.user_id, uc.completed_at, 'challenge'::text, 20, 2
  from clan
  join public.clan_members cm on cm.clan_id = clan.id
  join public.user_challenges uc on uc.user_id = cm.user_id and uc.completed_at is not null
  where cm.joined_at <= uc.completed_at and (cm.left_at is null or cm.left_at > uc.completed_at)
    and uc.completed_at >= p_week_start and uc.completed_at < p_week_start + interval '7 days'
    -- Челлендж — клану того города, где сделан улов, закрывший его (последний
    -- улов игрока к этому моменту): у игрока может быть клан в каждом городе,
    -- а выполнение засчитывается одному. Без уловов — город профиля.
    and coalesce(
      (select left(k.territory_id, 1) from public.catches k
       where k.user_id = uc.user_id and k.caught_at <= uc.completed_at
       order by k.caught_at desc limit 1),
      case when (select p.city from public.profiles p where p.id = uc.user_id) = 'moscow' then 'M' else 'B' end
    ) = clan.prefix;
$function$
$bk$, '2026-10-19T21:42:44.272455+00:00'),
(20365, '_clan_member_left_shares', $bk$CREATE OR REPLACE FUNCTION public._clan_member_left_shares()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  begin
    if old.left_at is null and new.left_at is not null then
      delete from public.territory_shares s
      using public.territories t
      where t.id = s.territory_id
        and case when left(t.id, 1) = 'M' then 'moscow' else 'batumi' end = new.city
        and (s.user_id = new.user_id or t.owner_id = new.user_id);
    end if;
  exception when others then
    raise warning 'clan share cleanup failed for %: %', new.user_id, sqlerrm;
  end;
  return new;
end;
$function$
$bk$, '2026-10-19T21:42:44.272455+00:00'),
(20517, 'get_city_feed', $bk$CREATE OR REPLACE FUNCTION public.get_city_feed(p_city text, p_limit integer DEFAULT 60)
 RETURNS TABLE(catch_id bigint, user_id uuid, display_name text, avatar_url text, territory_id text, territory_kind territory_kind, species_name text, species_category text, length_cm smallint, weight_kg numeric, photo_url text, caught_at timestamp with time zone, claimed boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select c.id, c.user_id, p.display_name, p.avatar_url, c.territory_id, t.kind, s.name, s.category,
         c.length_cm, c.weight_kg, c.photo_url, c.caught_at,
         exists (select 1 from public.activity_log a where a.user_id = c.user_id and a.catch_id = c.id and a.kind = 'claim')
  from public.catches c
  join public.profiles p on p.id = c.user_id and not coalesce(p.is_blocked, false)
  left join public.territories t on t.id = c.territory_id
  left join public.species s on s.key = c.species
  where auth.uid() is not null
    and c.user_id <> auth.uid()
    and case when left(c.territory_id, 1) = 'M' then 'moscow' else 'batumi' end = p_city
  order by c.caught_at desc
  limit least(greatest(coalesce(p_limit, 60), 1), 100);
$function$
$bk$, '2026-10-19T21:42:44.272455+00:00'),
(21256, 'get_slot_state', $bk$CREATE OR REPLACE FUNCTION public.get_slot_state()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_uid uuid := auth.uid();
  v record;
  v_bonus int;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;
  select * into v from public._slot_day_state(v_uid);
  v_bonus := coalesce((select b.spins from public.slot_bonus_spins b where b.user_id = v_uid), 0);
  return jsonb_build_object(
    'total', v.total,
    'used', v.used,
    'left', greatest(v.total - v.used, 0) + v_bonus,
    'bonus', v_bonus,
    'next_reset', v.next_reset,
    'free_shields', (select free_shields from public.profiles where id = v_uid),
    'has_jackpot_frame', exists (
      select 1 from public.user_inventory where user_id = v_uid
        and item_id = case when public._profile_city(v_uid) = 'moscow' then 'frame_som' else 'frame_katran' end
    )
  );
end;
$function$
$bk$, '2026-10-19T21:42:44.272455+00:00'),
(21257, 'spin_slots', $bk$CREATE OR REPLACE FUNCTION public.spin_slots()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_uid uuid := auth.uid();
  v_state record;
  v_bonus int;
  v_use_bonus boolean;
  v_frame text;
  v_r double precision := random();
  v_symbols text[] := array['stavrida', 'skorpena', 'lufar', 'katran', 'hook', 'hex'];
  v_reels text[];
  v_prize text;
  v_coins int := 0;
  v_a text;
  v_b text;
  v_pos int;
  v_label text;
  v_balance int;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;
  -- One spin at a time per player: two taps in parallel must not both pass the count.
  perform 1 from public.profiles where id = v_uid for update;

  select * into v_state from public._slot_day_state(v_uid);
  v_bonus := coalesce((select b.spins from public.slot_bonus_spins b where b.user_id = v_uid), 0);
  v_use_bonus := v_state.used >= v_state.total;
  if v_use_bonus and v_bonus <= 0 then
    raise exception 'SLOTS:no_spins';
  end if;

  -- Odds (decided 06.10, «сильно»): jackpot 0,3% · shield 5% · ×2 coins 6% · 100 coins 4% ·
  -- 3 ставриды 25 coins 14% · 3 скорпены a free spin 8% · a pair 10 coins 38% · miss ~24,7%.
  if v_r < 0.003 then
    v_reels := array['katran', 'katran', 'katran'];
    -- The jackpot frame is the player's city's own: «Катран» in Batumi, «Сом» in Moscow.
    v_frame := case when public._profile_city(v_uid) = 'moscow' then 'frame_som' else 'frame_katran' end;
    if exists (select 1 from public.shop_items where id = v_frame)
       and not exists (select 1 from public.user_inventory where user_id = v_uid and item_id = v_frame) then
      v_prize := 'jackpot';
      insert into public.user_inventory (user_id, item_id) values (v_uid, v_frame);
    else
      v_prize := 'jackpot_coins';
      v_coins := 300;
    end if;
  elsif v_r < 0.053 then
    v_reels := array['hex', 'hex', 'hex'];
    v_prize := 'shield';
    -- At most 3 shields in reserve: one won on top of a full reserve pays 70 coins.
    if (select free_shields from public.profiles where id = v_uid) >= 3 then
      v_coins := 70;
    else
      update public.profiles set free_shields = free_shields + 1 where id = v_uid;
    end if;
  elsif v_r < 0.113 then
    v_reels := array['hook', 'hook', 'hook'];
    v_prize := 'double';
    insert into public.active_buffs (user_id, buff_id, expires_at)
    values (v_uid, 'double_coins', greatest(now(), coalesce((
      select max(expires_at) from public.active_buffs where user_id = v_uid and buff_id = 'double_coins' and expires_at > now()
    ), now())) + interval '24 hours');
  elsif v_r < 0.153 then
    v_reels := array['lufar', 'lufar', 'lufar'];
    v_prize := 'lufar';
    v_coins := 100;
  elsif v_r < 0.293 then
    v_reels := array['stavrida', 'stavrida', 'stavrida'];
    v_prize := 'triple';
    v_coins := 25;
  elsif v_r < 0.373 then
    -- 3 скорпены (3 леща in Moscow): a free spin into the same store as gift
    -- spins — it doesn't burn at midnight and goes after the day's own.
    v_reels := array['skorpena', 'skorpena', 'skorpena'];
    v_prize := 'free_spin';
    insert into public.slot_bonus_spins as b (user_id, spins) values (v_uid, 1)
    on conflict (user_id) do update set spins = b.spins + 1;
    v_bonus := v_bonus + 1;
  elsif v_r < 0.753 then
    v_a := v_symbols[1 + floor(random() * 6)::int];
    v_b := (select s from unnest(v_symbols) s where s <> v_a order by random() limit 1);
    v_pos := 1 + floor(random() * 3)::int;
    v_reels := array[v_a, v_a, v_a];
    v_reels[v_pos] := v_b;
    v_prize := 'pair';
    v_coins := 10;
  else
    v_reels := (select array_agg(s) from (select s from unnest(v_symbols) s order by random() limit 3) x);
    v_prize := 'none';
  end if;

  if v_coins > 0 then
    update public.profiles set coins = coins + v_coins where id = v_uid;
    v_label := case v_prize
      when 'jackpot_coins' then 'Слоты: джекпот'
      when 'lufar' then 'Слоты: 100 монет'
      when 'triple' then 'Слоты: три в ряд'
      when 'shield' then 'Слоты: щит, запас полон'
      else 'Слоты: два одинаковых'
    end;
    insert into public.coin_transactions (user_id, amount, reason, label) values (v_uid, v_coins, 'slots_prize', v_label);
  end if;

  if v_use_bonus then
    update public.slot_bonus_spins b set spins = b.spins - 1 where b.user_id = v_uid;
    v_bonus := v_bonus - 1;
  end if;
  insert into public.slot_spins (user_id, reels, prize, coins, bonus) values (v_uid, v_reels, v_prize, v_coins, v_use_bonus);
  select coins into v_balance from public.profiles where id = v_uid;

  return jsonb_build_object(
    'reels', to_jsonb(v_reels),
    'prize', v_prize,
    'coins', v_coins,
    'balance', v_balance,
    'left', greatest(v_state.total - v_state.used - case when v_use_bonus then 0 else 1 end, 0) + v_bonus,
    'total', v_state.total,
    'bonus', v_bonus,
    'free_shields', (select free_shields from public.profiles where id = v_uid)
  );
end;
$function$
$bk$, '2026-10-19T21:42:44.272455+00:00'),
(21402, 'pick_hot_sectors', $bk$CREATE OR REPLACE FUNCTION public.pick_hot_sectors(p_city text)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_tz text := public._city_tz(p_city);
  v_prefix text := case when p_city = 'moscow' then 'M' else 'B' end;
  v_local_now timestamp := now() at time zone v_tz;
  v_ends timestamptz;
  v_popular text;
  v_neighbor text;
  v_n int := 0;
begin
  if exists (select 1 from public.hot_sectors where city = p_city and ends_at > now()) then
    return 0;
  end if;
  -- Sunday 23:59:59 of this week, local time — or of next week when less than a day is left.
  v_ends := ((date_trunc('week', v_local_now) + interval '7 days' - interval '1 second') at time zone v_tz);
  if v_ends - now() < interval '1 day' then
    v_ends := v_ends + interval '7 days';
  end if;

  select t.id into v_popular
  from public.territories t
  join public.catches c on c.territory_id = t.id and c.caught_at > now() - interval '30 days'
  where t.id like v_prefix || '%' and not t.is_deleted
    and not exists (select 1 from public.hot_sectors h where h.territory_id = t.id and h.ends_at > now() - interval '8 days')
  group by t.id
  order by count(*) desc, max(c.caught_at) desc
  limit 1;

  if v_popular is not null then
    insert into public.hot_sectors (territory_id, city, kind, starts_at, ends_at) values (v_popular, p_city, 'popular', now(), v_ends);
    v_n := v_n + 1;
  end if;

  -- The second one touches the first: hex centres of neighbours are 600 m apart and
  -- the next ring is over 1 km away, so «under 800 m» is exactly the six around it.
  -- A free neighbour if there is one (something to take), otherwise any.
  if v_popular is not null then
    select f.id into v_neighbor
    from public.territories f
    join public.territories p on p.id = v_popular
    where f.id like v_prefix || '%' and not f.is_deleted and f.id <> p.id
      and sqrt(power((f.lat - p.lat) * 111.0, 2) + power((f.lng - p.lng) * 111.0 * cos(radians(p.lat)), 2)) < 0.8
      and not exists (select 1 from public.hot_sectors h where h.territory_id = f.id and h.ends_at > now() - interval '8 days')
    order by (f.owner_id is null) desc, random()
    limit 1;
  end if;

  if v_neighbor is not null then
    insert into public.hot_sectors (territory_id, city, kind, starts_at, ends_at) values (v_neighbor, p_city, 'neighbor', now(), v_ends);
    v_n := v_n + 1;
  end if;
  return v_n;
end;
$function$
$bk$, '2026-10-19T21:42:44.272455+00:00'),
(21529, 'get_sector_insights', $bk$CREATE OR REPLACE FUNCTION public.get_sector_insights(p_territory_id text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_uid uuid := auth.uid();
  v_kind text;
  v_tz text := public._city_tz(case when left(p_territory_id, 1) = 'M' then 'moscow' else 'batumi' end);
  v_scope text;
  v_out jsonb;
begin
  select t.kind::text into v_kind from public.territories t where t.id = p_territory_id;
  if not found then
    raise exception 'unknown sector';
  end if;

  if (select count(*) from public.catches c
      join public.profiles p on p.id = c.user_id and not coalesce(p.is_blocked, false)
      where c.territory_id = p_territory_id and c.caught_at > now() - interval '90 days') >= 3 then
    v_scope := 'sector';
  else
    v_scope := 'sector_all';
  end if;

  with src as (
    select c.species, c.method, c.bait, c.caught_at
    from public.catches c
    join public.profiles p on p.id = c.user_id and not coalesce(p.is_blocked, false)
    where c.territory_id = p_territory_id
      and (v_scope = 'sector_all' or c.caught_at > now() - interval '90 days')
  )
  select jsonb_build_object(
    'scope', v_scope,
    'kind', v_kind,
    'total', (select count(*) from src),
    'species', coalesce((select jsonb_agg(jsonb_build_object('key', x.species, 'count', x.n) order by x.n desc, x.species)
                         from (select species, count(*) as n from src group by species order by count(*) desc, species limit 5) x), '[]'::jsonb),
    'hours', (select jsonb_agg(coalesce(h.n, 0) order by g.h)
              from generate_series(0, 23) g(h)
              left join (select extract(hour from caught_at at time zone v_tz)::int as hr, count(*)::int as n from src group by 1) h on h.hr = g.h),
    'methods', coalesce((select jsonb_agg(jsonb_build_object('name', x.method, 'count', x.n) order by x.n desc)
                         from (select method, count(*) as n from src where method is not null group by method order by count(*) desc limit 3) x), '[]'::jsonb),
    'baits', coalesce((select jsonb_agg(jsonb_build_object('name', x.bait, 'count', x.n) order by x.n desc)
                       from (select bait, count(*) as n from src where bait is not null group by bait order by count(*) desc limit 3) x), '[]'::jsonb),
    'last_catch_at', (select max(c.caught_at) from public.catches c where c.territory_id = p_territory_id),
    'legend', (select jsonb_build_object('id', l.user_id, 'name', p.display_name, 'avatar_url', p.avatar_url, 'count', l.catches)
               from public._sector_legend(p_territory_id) l join public.profiles p on p.id = l.user_id),
    'my_count', case when v_uid is null then null else
      (select count(*) from public.catches c where c.territory_id = p_territory_id and c.user_id = v_uid
         and c.caught_at > now() - interval '90 days') end
  ) into v_out;
  return v_out;
end;
$function$
$bk$, '2026-10-19T21:42:44.272455+00:00'),
(21532, 'get_city_pulse', $bk$CREATE OR REPLACE FUNCTION public.get_city_pulse(p_city text)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  with week as (
    select c.id, c.user_id, c.territory_id, c.species, c.photo_url, c.caught_at
    from public.catches c
    join public.profiles p on p.id = c.user_id and not coalesce(p.is_blocked, false)
    where c.caught_at > now() - interval '7 days'
      and left(c.territory_id, 1) = case when p_city = 'moscow' then 'M' else 'B' end
  )
  select jsonb_build_object(
    'catches', (select count(*) from week),
    'anglers', (select count(distinct user_id) from week),
    'captures', (select count(*) from public.activity_log a
                 join public.profiles p on p.id = a.user_id and not coalesce(p.is_blocked, false)
                 where a.kind = 'claim' and a.created_at > now() - interval '7 days'
                   and left(a.territory_id, 1) = case when p_city = 'moscow' then 'M' else 'B' end),
    'recent', coalesce((
      select jsonb_agg(jsonb_build_object(
        'catch_id', w.id, 'user_id', w.user_id, 'name', p.display_name, 'avatar_url', p.avatar_url,
        'species', s.name, 'photo_url', w.photo_url, 'territory_id', w.territory_id, 'caught_at', w.caught_at
      ) order by w.caught_at desc)
      from (select * from week order by caught_at desc limit 8) w
      join public.profiles p on p.id = w.user_id
      left join public.species s on s.key = w.species
    ), '[]'::jsonb)
  )
  where auth.uid() is not null;
$function$
$bk$, '2026-10-19T21:42:44.272455+00:00'),
(21554, 'log_app_events', $bk$CREATE OR REPLACE FUNCTION public.log_app_events(p_device uuid, p_session uuid, p_events jsonb)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_n integer;
begin
  if p_device is null or p_session is null or jsonb_typeof(p_events) is distinct from 'array' then
    return 0;
  end if;
  if (select count(*) from public.app_events where device_id = p_device and created_at > now() - interval '1 hour') > 600
     or (select count(*) from public.app_events where created_at > now() - interval '1 minute') > 5000 then
    return 0;
  end if;
  insert into public.app_events (device_id, session_id, user_id, name, props, city, client_at)
  select p_device, p_session, auth.uid(), e->>'name',
         case when jsonb_typeof(e->'props') = 'object' and pg_column_size(e->'props') <= 1024 then e->'props' else '{}'::jsonb end,
         case when e->>'city' in ('batumi', 'moscow') then e->>'city' end,
         case when jsonb_typeof(e->'at') = 'number'
              then greatest(least(to_timestamp((e->>'at')::double precision / 1000), now()), now() - interval '2 days') end
  from (select value as e from jsonb_array_elements(p_events) limit 100) x
  where jsonb_typeof(e) = 'object' and (e->>'name') ~ '^[a-z][a-z0-9_]{1,39}$';
  get diagnostics v_n = row_count;
  return v_n;
end;
$function$
$bk$, '2026-10-19T21:42:44.272455+00:00'),
(21645, 'get_city_week_recap', $bk$CREATE OR REPLACE FUNCTION public.get_city_week_recap(p_city text, p_week_offset integer DEFAULT 1, p_user uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
$bk$, '2026-10-19T21:42:44.272455+00:00'),
(21691, 'onboarding_due', $bk$CREATE OR REPLACE FUNCTION public.onboarding_due(p_limit integer DEFAULT 200)
 RETURNS TABLE(chat_id bigint, user_id uuid, step text, city text, name text, data jsonb)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  with
  reg as (
    select p.id, p.telegram_id as chat_id, p.city, p.display_name, p.created_at,
           now() at time zone public._city_tz(p.city) as local_now
    from public.profiles p
    where p.telegram_id is not null
      and not coalesce(p.is_blocked, false)
      and coalesce(p.tg_notifications_enabled, false)
      and p.tg_unreachable_at is null
      and not exists (select 1 from public.catches c where c.user_id = p.id)
  ),
  reg_steps as (
    select r.*, s.step, s.prio
    from reg r
    cross join lateral (values
      ('new_2h', 1, now() - r.created_at between interval '2 hours' and interval '26 hours'),
      ('new_day14', 2, now() - r.created_at between interval '14 days' and interval '15 days'),
      ('new_day7', 3, now() - r.created_at between interval '7 days' and interval '8 days'),
      ('new_friday', 4, extract(isodow from r.local_now) = 5 and extract(hour from r.local_now) between 18 and 20
                        and now() - r.created_at between interval '12 hours' and interval '8 days'),
      ('old_friday', 5, extract(isodow from r.local_now) = 5 and extract(hour from r.local_now) between 18 and 20
                        and now() - r.created_at > interval '15 days')
    ) as s(step, prio, due)
    where s.due and extract(hour from r.local_now) between 10 and 20
  ),
  starts as (
    select s.chat_id, s.started_at, now() at time zone 'Asia/Tbilisi' as local_now
    from public.telegram_bot_starts s
    where s.stopped_at is null
      and not exists (select 1 from public.profiles p where p.telegram_id = s.chat_id)
  ),
  start_steps as (
    select st.chat_id, null::uuid as id, null::text as city, null::text as display_name, x.step, x.prio
    from starts st
    cross join lateral (values
      ('start_day1', 1, now() - st.started_at between interval '1 day' and interval '2 days'),
      ('start_day4', 2, now() - st.started_at between interval '4 days' and interval '5 days')
    ) as x(step, prio, due)
    where x.due and extract(hour from st.local_now) between 10 and 20
  ),
  candidates as (
    select chat_id, id as user_id, city, display_name, step, prio from reg_steps
    union all
    select chat_id, id, city, display_name, step, prio from start_steps
  ),
  fresh as (
    select c.* from candidates c
    where not exists (select 1 from public.onboarding_messages m where m.chat_id = c.chat_id and m.step = c.step)
      and not exists (select 1 from public.onboarding_messages m where m.chat_id = c.chat_id and m.sent_at > now() - interval '20 hours')
  ),
  one_per_chat as (
    select distinct on (chat_id) * from fresh order by chat_id, prio
  )
  select o.chat_id, o.user_id, o.step, o.city, o.display_name,
    case
      when o.step = 'new_2h' then (
        select jsonb_build_object(
          'free', (select count(*) from public.territories t
                   where not t.is_deleted and t.owner_id is null and left(t.id, 1) = case when o.city = 'moscow' then 'M' else 'B' end),
          'sector', x.territory_id, 'sector_catches', x.n)
        from (select c.territory_id, count(*) as n from public.catches c
              where c.caught_at > now() - interval '7 days' and left(c.territory_id, 1) = case when o.city = 'moscow' then 'M' else 'B' end
              group by c.territory_id order by count(*) desc limit 1) x)
      when o.step in ('new_day7', 'old_friday') then (
        select jsonb_build_object(
          'catches', count(*),
          'best_species', (select s.name from public.catches c2 join public.species s on s.key = c2.species
                           where c2.caught_at > now() - interval '7 days' and left(c2.territory_id, 1) = case when o.city = 'moscow' then 'M' else 'B' end
                             and c2.length_cm is not null order by c2.length_cm desc limit 1),
          'best_cm', (select max(c3.length_cm) from public.catches c3
                      where c3.caught_at > now() - interval '7 days' and left(c3.territory_id, 1) = case when o.city = 'moscow' then 'M' else 'B' end))
        from public.catches c
        where c.caught_at > now() - interval '7 days' and left(c.territory_id, 1) = case when o.city = 'moscow' then 'M' else 'B' end)
      else '{}'::jsonb
    end
  from one_per_chat o
  limit least(greatest(coalesce(p_limit, 200), 1), 500);
$function$
$bk$, '2026-10-19T21:42:44.272455+00:00'),
(22060, 'confirm_catch', $bk$CREATE OR REPLACE FUNCTION public.confirm_catch(p_territory_id text, p_species text, p_photo_url text, p_length_cm integer DEFAULT NULL::integer, p_weight_kg numeric DEFAULT NULL::numeric, p_method text DEFAULT NULL::text, p_bait text DEFAULT NULL::text, p_caught_at timestamp with time zone DEFAULT NULL::timestamp with time zone)
 RETURNS TABLE(species_coins integer, capture_coins integer, clan_support boolean, late boolean, attacked boolean, defense integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_uid uuid := auth.uid();
  v_prev_owner uuid;
  v_shield_until timestamptz;
  v_catch public.catches;
  v_is_privileged boolean;
  v_is_blocked boolean;
  v_last_catch_at timestamptz;
  v_remaining_seconds integer;
  v_tide_consumed_id bigint;
  v_echo_consumed_id bigint;
  v_capture_coins int := 0;
  v_species_coins int := 0;
  v_multiplier int;
  v_clan_mate boolean := false;
  v_at timestamptz := coalesce(p_caught_at, now());
  v_late boolean := false;
  v_defense smallint;
  v_defense_at timestamptz;
  v_def_now int := 0;
  v_def_after int := 0;
  v_attack boolean := false;
  v_hot boolean := false;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;

  select p.is_blocked, (p.is_admin or p.is_super_admin) into v_is_blocked, v_is_privileged
  from public.profiles p where p.id = v_uid;
  if coalesce(v_is_blocked, false) then
    raise exception 'account blocked';
  end if;

  if p_caught_at is not null and (p_caught_at < now() - interval '24 hours' or p_caught_at > now() + interval '2 minutes') then
    raise exception 'CAUGHT_AT_INVALID';
  end if;

  if not coalesce(v_is_privileged, false) then
    if p_caught_at is null then
      select max(caught_at) into v_last_catch_at from public.catches where user_id = v_uid;
      if v_last_catch_at is not null and now() - v_last_catch_at < interval '2 minutes 30 seconds' then
        v_remaining_seconds := ceil(extract(epoch from (v_last_catch_at + interval '2 minutes 30 seconds' - now())));
        raise exception 'COOLDOWN:%', v_remaining_seconds;
      end if;
    elsif exists (select 1 from public.catches where user_id = v_uid
                  and caught_at > p_caught_at - interval '2 minutes 30 seconds'
                  and caught_at < p_caught_at + interval '2 minutes 30 seconds') then
      raise exception 'COOLDOWN:0';
    end if;
  end if;

  insert into public.territories (id) values (p_territory_id) on conflict (id) do nothing;

  select owner_id, shield_until, t.defense, t.defense_at into v_prev_owner, v_shield_until, v_defense, v_defense_at
  from public.territories t where t.id = p_territory_id and not is_deleted for update;
  if not found then raise exception 'unknown territory %', p_territory_id; end if;
  -- Защита на сейчас: без уловов владельца тает на 1 в сутки.
  if v_prev_owner is not null then
    v_def_now := greatest(0, v_defense - floor(extract(epoch from (now() - coalesce(v_defense_at, now()))) / 86400)::int);
  end if;

  -- Владелец — соклановец по клану города этого сектора: сектор остаётся за ним.
  if v_prev_owner is not null and v_prev_owner <> v_uid then
    select exists (
      select 1 from public.clan_members a
      join public.clan_members b on b.clan_id = a.clan_id and b.left_at is null
      where a.user_id = v_uid and a.left_at is null and b.user_id = v_prev_owner
        and a.city = case when left(p_territory_id, 1) = 'M' then 'moscow' else 'batumi' end
    ) into v_clan_mate;
  end if;

  if p_caught_at is not null then
    -- Улов без сети опоздал: после снимка здесь уже ловил кто-то другой, или сейчас
    -- на секторе чужой щит. Улов сохраняется, но сектор не переходит.
    v_late := exists (select 1 from public.catches c where c.territory_id = p_territory_id and c.user_id <> v_uid and c.caught_at > p_caught_at)
      or (v_prev_owner is not null and v_prev_owner <> v_uid and not v_clan_mate and v_shield_until is not null and v_shield_until > now());
  elsif v_prev_owner is not null and v_prev_owner <> v_uid and not v_clan_mate
     and v_shield_until is not null and v_shield_until > now() then
    -- A sector under an active Щит/Прилив shield can't change hands — only
    -- its current owner (re-confirming, ownership doesn't change) can still
    -- catch there. A clan-mate's catch doesn't change hands either, so it's
    -- allowed through a shield too.
    raise exception 'SHIELDED:%', extract(epoch from v_shield_until)::bigint;
  end if;

  -- Чужой улов на секторе с защитой — атака, а не захват.
  v_attack := not v_late and v_prev_owner is not null and v_prev_owner <> v_uid and not v_clan_mate and v_def_now > 0;

  insert into public.catches (territory_id, user_id, species, length_cm, weight_kg, method, bait, photo_url, caught_at)
  values (p_territory_id, v_uid, p_species, p_length_cm, p_weight_kg, p_method, p_bait, p_photo_url, v_at)
  returning * into v_catch;
  if v_late then
    v_def_after := v_def_now; -- сектор не трогаем
  elsif v_attack then
    v_def_after := v_def_now - 1;
    update public.territories t set defense = v_def_after, defense_at = now() where t.id = p_territory_id;
  elsif not v_clan_mate then
    -- Захват (защита 1) или улов владельца на своём секторе (+1, до 3).
    v_def_after := case when v_prev_owner is distinct from v_uid then 1 else least(3, v_def_now + 1) end;
    update public.territories t set owner_id = v_uid, claimed_at = now(),
      shield_until = case when v_prev_owner is distinct from v_uid then null else shield_until end,
      defense = v_def_after, defense_at = now()
      where t.id = p_territory_id;
  else
    -- Соклановец входит в долю сектора: до 4 владельцев вместе с хозяином.
    -- Пятый просто поддерживает сектор. Защиту укрепляет любой из них.
    insert into public.territory_shares (territory_id, user_id)
    select p_territory_id, v_uid
    where (select count(*) from public.territory_shares s where s.territory_id = p_territory_id) < 3
    on conflict do nothing;
    v_def_after := least(3, v_def_now + 1);
    update public.territories t set defense = v_def_after, defense_at = now() where t.id = p_territory_id;
  end if;
  insert into public.activity_log (user_id, territory_id, kind, catch_id) values (v_uid, p_territory_id, 'catch', v_catch.id);

  v_multiplier := public.coin_multiplier(v_uid);
  v_hot := exists (select 1 from public.hot_sectors hs where hs.territory_id = p_territory_id and v_at >= hs.starts_at and v_at < hs.ends_at);

  -- Every catch pays out by species rarity (see species.coin_value — a flat
  -- table from a real tournament's point scale, x5), whether or not it also
  -- happens to take the sector. Tagged with catch_id so a later moderation
  -- takedown (admin_delete_catch) can look up and reverse exactly what this
  -- specific catch actually paid, instead of re-deriving it (species prices
  -- or the double-coins multiplier could both have changed by then).
  select coin_value into v_species_coins from public.species s where s.key = p_species;
  if v_species_coins is not null then
    -- Горячий сектор — ×2 за улов, вместе с «Двойными монетами» ×3, не ×4.
    v_species_coins := v_species_coins * case when v_hot then v_multiplier + 1 else v_multiplier end;
    update public.profiles p set coins = coins + v_species_coins where p.id = v_uid;
    insert into public.coin_transactions (user_id, amount, reason, label, catch_id)
    values (v_uid, v_species_coins, 'catch_reward',
            coalesce((select s2.name from public.species s2 where s2.key = p_species), p_species) || case when v_hot then ' · горячий сектор ×' || (v_multiplier + 1) else '' end,
            v_catch.id);
  else
    v_species_coins := 0;
  end if;

  if v_attack then
    -- Владельцу — «твой сектор атакуют», не чаще раза в час на сектор.
    if not exists (select 1 from public.notifications n
                   where n.user_id = v_prev_owner and n.kind = 'sector_attacked' and n.territory_id = p_territory_id
                     and n.created_at > now() - interval '1 hour') then
      insert into public.notifications (user_id, kind, actor_id, territory_id, payload)
      values (v_prev_owner, 'sector_attacked', v_uid, p_territory_id, jsonb_build_object('defense', v_def_after));
    end if;
  end if;

  if v_prev_owner is distinct from v_uid and not v_clan_mate and not v_late and not v_attack then
    insert into public.activity_log (user_id, territory_id, kind, catch_id, previous_owner_id)
    values (v_uid, p_territory_id, 'claim', v_catch.id, v_prev_owner);

    -- A fresh capture (not just re-confirming your own sector) consumes an
    -- armed Прилив, if the catcher has one: the sector just taken gets 48h
    -- protection instead of the usual none.
    select ab.id into v_tide_consumed_id from public.active_buffs ab
    -- На горячем секторе Прилив не срабатывает — щит туда не ставится.
    where not v_hot and ab.user_id = v_uid and ab.buff_id = 'tide' and ab.consumed = false and ab.expires_at > now()
    order by ab.activated_at limit 1;
    if v_tide_consumed_id is not null then
      update public.active_buffs ab set consumed = true where ab.id = v_tide_consumed_id;
      update public.territories t set shield_until = now() + interval '48 hours' where t.id = p_territory_id;
    end if;

    -- A flat reward for actually taking a sector, also tagged with catch_id
    -- for the same moderation-reversal reason as above. Once a day per
    -- player per sector: two players taking one sector back and forth
    -- farmed it (05.10: 32 of 66 captures within 30 min of the last one).
    if not exists (select 1 from public.coin_transactions ct
                   join public.catches c2 on c2.id = ct.catch_id
                   where ct.user_id = v_uid and ct.reason = 'sector_capture' and c2.territory_id = p_territory_id
                     and ct.created_at > now() - interval '24 hours') then
      v_capture_coins := 25 * v_multiplier;
      update public.profiles p set coins = coins + v_capture_coins where p.id = v_uid;
      insert into public.coin_transactions (user_id, amount, reason, label, catch_id)
      values (v_uid, v_capture_coins, 'sector_capture', 'Захват сектора ' || p_territory_id, v_catch.id);
    end if;
  end if;

  -- Any catch (yours or a fresh capture) can consume an armed Эхо, making
  -- it count double for the count-based challenge metrics.
  select ab.id into v_echo_consumed_id from public.active_buffs ab
  where ab.user_id = v_uid and ab.buff_id = 'echo' and ab.consumed = false and ab.expires_at > now()
  order by ab.activated_at limit 1;
  if v_echo_consumed_id is not null then
    update public.active_buffs ab set consumed = true where ab.id = v_echo_consumed_id;
    update public.catches c set echo = true where c.id = v_catch.id;
  end if;

  return query select v_species_coins, v_capture_coins, v_clan_mate, v_late, v_attack, v_def_after;
end;
$function$
$bk$, '2026-10-19T21:42:44.272455+00:00'),
(22079, 'announce_hot_sectors', $bk$CREATE OR REPLACE FUNCTION public.announce_hot_sectors(p_city text)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_ids text[];
  v_until timestamptz;
  v_n int;
begin
  select array_agg(h.territory_id order by h.territory_id), max(h.ends_at) into v_ids, v_until
  from public.hot_sectors h
  where now() between h.starts_at and h.ends_at
    and left(h.territory_id, 1) = case when p_city = 'moscow' then 'M' else 'B' end;
  if v_ids is null then return 0; end if;

  insert into public.notifications (user_id, kind, territory_id, payload)
  select p.id, 'hot_sector_week', v_ids[1], jsonb_build_object('sectors', to_jsonb(v_ids), 'until', v_until)
  from public.profiles p
  where p.city = p_city and p.onboarding_completed and not coalesce(p.is_blocked, false)
    and not exists (select 1 from public.notifications n
                    where n.user_id = p.id and n.kind = 'hot_sector_week' and n.created_at > now() - interval '5 days');
  get diagnostics v_n = row_count;
  return v_n;
end;
$function$
$bk$, '2026-10-19T21:42:44.272455+00:00'),
(22090, 'queue_bite_forecast', $bk$CREATE OR REPLACE FUNCTION public.queue_bite_forecast(p_city text, p_for_date date, p_score integer, p_from text, p_to text)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_week_start date := date_trunc('week', p_for_date)::date;
  v_n int;
begin
  if p_city not in ('batumi', 'moscow') or p_score < 4 then
    return 0;
  end if;
  if (select count(*) from public.forecast_alerts a where a.city = p_city and a.for_date >= v_week_start and a.for_date < v_week_start + 7) >= 2
     or exists (select 1 from public.forecast_alerts a where a.city = p_city and a.for_date between p_for_date - 2 and p_for_date) then
    return 0;
  end if;
  insert into public.forecast_alerts (city, for_date, score) values (p_city, p_for_date, p_score);
  insert into public.notifications (user_id, kind, payload)
  select p.id, 'bite_forecast', jsonb_build_object('score', p_score, 'city', p_city, 'from', p_from, 'to', p_to, 'date', p_for_date)
  from public.profiles p
  where p.city = p_city and not coalesce(p.is_blocked, false)
    and exists (select 1 from public.catches c where c.user_id = p.id and c.caught_at > now() - interval '60 days');
  get diagnostics v_n = row_count;
  return v_n;
end;
$function$
$bk$, '2026-10-19T21:42:44.272455+00:00'),
(22924, 'submit_geo_guess', $bk$CREATE OR REPLACE FUNCTION public.submit_geo_guess(p_territory_id text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_uid uuid := auth.uid();
  v_city text;
  v_today date;
  v_id bigint;
  v_pano public.geo_panoramas;
  v_sector public.territories;
  v_correct boolean;
  v_distance integer;
  v_coins integer;
  v_balance integer;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;
  perform 1 from public.profiles where id = v_uid and not coalesce(is_blocked, false) for update;
  if not found then
    raise exception 'GEO:blocked';
  end if;
  v_city := public._profile_city(v_uid);
  v_today := (now() at time zone public._city_tz(v_city))::date;
  if exists (select 1 from public.geo_guesses where user_id = v_uid and day = v_today) then
    raise exception 'GEO:already';
  end if;
  select * into v_sector from public.territories
  where id = p_territory_id and not is_deleted and left(id, 1) = case v_city when 'moscow' then 'M' else 'B' end;
  if not found then
    raise exception 'GEO:bad_sector';
  end if;
  v_id := public._geo_pick(v_city, v_today);
  if v_id is null then
    raise exception 'GEO:none';
  end if;
  select * into v_pano from public.geo_panoramas where id = v_id;
  v_correct := v_sector.id = v_pano.territory_id;
  v_distance := round(public._geo_distance_m(v_sector.lat, v_sector.lng, v_pano.lat, v_pano.lng));
  v_coins := case when v_correct then 30 else 0 end;
  insert into public.geo_guesses (user_id, day, city, panorama_id, territory_id, correct, distance_m, coins)
  values (v_uid, v_today, v_city, v_id, v_sector.id, v_correct, v_distance, v_coins);
  if v_coins > 0 then
    update public.profiles set coins = coins + v_coins where id = v_uid returning coins into v_balance;
    insert into public.coin_transactions (user_id, amount, reason, label)
    values (v_uid, v_coins, 'geo_guess', 'Где это? · угадан сектор ' || v_sector.id);
  else
    select coins into v_balance from public.profiles where id = v_uid;
  end if;
  return public._geo_result(v_uid, v_today) || jsonb_build_object('balance', v_balance);
end;
$function$
$bk$, '2026-10-19T21:42:44.272455+00:00'),
(22931, '_geo_catch_bonus', $bk$CREATE OR REPLACE FUNCTION public._geo_catch_bonus()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_city text := case when left(new.territory_id, 1) = 'M' then 'moscow' else 'batumi' end;
  v_day date;
begin
  begin
    v_day := (coalesce(new.caught_at, now()) at time zone public._city_tz(v_city))::date;
    update public.geo_guesses g
    set bonus_coins = 50, bonus_at = now()
    from public.geo_panoramas p
    where g.user_id = new.user_id and g.day = v_day and g.bonus_at is null
      and p.id = g.panorama_id and p.territory_id = new.territory_id;
    if found then
      update public.profiles set coins = coins + 50 where id = new.user_id;
      insert into public.coin_transactions (user_id, amount, reason, label)
      values (new.user_id, 50, 'geo_bonus', 'Где это? · улов в секторе ' || new.territory_id);
      insert into public.notifications (user_id, kind, territory_id, catch_id, payload)
      values (new.user_id, 'geo_bonus', new.territory_id, new.id, jsonb_build_object('coins', 50));
    end if;
  exception when others then
    raise warning 'geo bonus failed for %: %', new.user_id, sqlerrm;
  end;
  return new;
end;
$function$
$bk$, '2026-10-19T21:42:44.272455+00:00'),
(23083, '_geo_supply_alert', $bk$CREATE OR REPLACE FUNCTION public._geo_supply_alert(p_city text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_today date := (now() at time zone public._city_tz(p_city))::date;
  v_days bigint;
  v_text text;
begin
  select (select count(*) from public.geo_days d where d.city = p_city and d.day > v_today)
       + (select count(*) from public.geo_panoramas p
          join public.territories t on t.id = p.territory_id and not t.is_deleted
          where p.city = p_city and p.status = 'approved'
            and not exists (select 1 from public.geo_days d where d.panorama_id = p.id))
  into v_days;
  if v_days > 3 then
    return;
  end if;
  if exists (select 1 from public.notifications n where n.kind = 'system_alert'
             and n.payload->>'key' = 'geo_low:' || p_city and n.created_at > now() - interval '20 hours') then
    return;
  end if;
  v_text := format(E'Кончаются панорамы «Где это?»\nЧто случилось: в %s новых одобренных панорам %s — дальше игра будет повторять уже показанные.\nЧто сделать: одобри ещё в Профиль → «Панорамы «Где это?»» и заполни план.',
    case p_city when 'moscow' then 'Москве' else 'Батуми' end,
    case when v_days = 0 then 'больше нет' else 'осталось на ' || public._ru_count(v_days, 'день', 'дня', 'дней') end);
  perform public._system_alert('geo_low:' || p_city, v_text);
  insert into public.notifications (user_id, kind, payload)
  select p.id, 'system_alert', jsonb_build_object('key', 'geo_low:' || p_city, 'text', v_text)
  from public.profiles p where p.is_admin and p.can_review_panoramas and not p.is_super_admin;
end;
$function$
$bk$, '2026-10-19T21:42:44.272455+00:00'),
(23408, '_challenge_progress_new', $bk$CREATE OR REPLACE FUNCTION public._challenge_progress_new(p_user_id uuid, p_metric text, p_params jsonb, p_week_start timestamp with time zone, p_week_end timestamp with time zone, p_city_prefix text, p_timezone text)
 RETURNS integer
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_result int := 0;
  v_city text := case when p_city_prefix = 'M' then 'moscow' else 'batumi' end;
begin
  if p_metric = 'comments_written' then
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
    select coalesce(sum(case when echo then 2 else 1 end), 0) into v_result from public.catches
    where user_id = p_user_id and caught_at >= p_week_start and caught_at < p_week_end
      and territory_id like p_city_prefix || '%'
      and weight_kg is not null and weight_kg > (p_params->>'min')::numeric;

  elsif p_metric = 'catch_hot_sector' then
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
$function$
$bk$, '2026-10-19T21:42:44.272455+00:00'),
(23083, '_geo_supply_alert', $bk$CREATE OR REPLACE FUNCTION public._geo_supply_alert(p_city text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_today date := (now() at time zone public._city_tz(p_city))::date;
  v_days bigint;
  v_text text;
begin
  select (select count(*) from public.geo_days d where d.city = p_city and d.day > v_today)
       + (select count(*) from public.geo_panoramas p
          join public.territories t on t.id = p.territory_id and not t.is_deleted
          where p.city = p_city and p.status = 'approved'
            and not exists (select 1 from public.geo_days d where d.panorama_id = p.id))
  into v_days;
  if v_days > 3 then
    return;
  end if;
  if exists (select 1 from public.notifications n where n.kind = 'system_alert'
             and n.payload->>'key' = 'geo_low:' || p_city and n.created_at > now() - interval '20 hours') then
    return;
  end if;
  v_text := format(E'Кончаются панорамы «Где это?»\nЧто случилось: в %s новых одобренных панорам %s — дальше игра будет повторять уже показанные.\nЧто сделать: одобри ещё в Профиль → «Панорамы «Где это?»» и заполни план.',
    public._city_name_in(p_city),
    case when v_days = 0 then 'больше нет' else 'осталось на ' || public._ru_count(v_days, 'день', 'дня', 'дней') end);
  perform public._system_alert('geo_low:' || p_city, v_text);
  insert into public.notifications (user_id, kind, payload)
  select p.id, 'system_alert', jsonb_build_object('key', 'geo_low:' || p_city, 'text', v_text)
  from public.profiles p where p.is_admin and p.can_review_panoramas and not p.is_super_admin;
end;
$function$
$bk$, '2026-10-19T21:44:30.686288+00:00'),
(18863, 'buy_extra_challenge', $bk$CREATE OR REPLACE FUNCTION public.buy_extra_challenge(p_city text, p_timezone text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_uid uuid := auth.uid();
  v_prefix text := public._city_prefix(p_city);
  v_price int;
  v_buff_name text;
  v_week_start timestamptz;
  v_new_id text;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;

  select price, name into v_price, v_buff_name from public.buffs where id = 'extra_challenge';
  v_week_start := date_trunc('week', now() at time zone p_timezone) at time zone p_timezone;

  insert into public.user_challenge_weeks (user_id, week_start) values (v_uid, v_week_start) on conflict do nothing;

  if (select extra_slot_bought from public.user_challenge_weeks where user_id = v_uid and week_start = v_week_start) then
    raise exception 'extra slot already bought this week';
  end if;

  update public.profiles set coins = coins - v_price where id = v_uid and coins >= v_price;
  if not found then raise exception 'not enough coins'; end if;

  select ch.id into v_new_id from public.challenges ch
  where public._challenge_eligible(v_uid, ch.metric) and (ch.city_scope is null or ch.city_scope = p_city)
    and ch.id not in (
      select uc.challenge_id from public.user_challenges uc
      where uc.user_id = v_uid and uc.week_start = v_week_start
    )
    and ch.id not in (
      select uc2.challenge_id from public.user_challenges uc2
      where uc2.user_id = v_uid and uc2.week_start >= v_week_start - interval '14 days'
    )
  order by random() limit 1;
  if v_new_id is null then
    select ch.id into v_new_id from public.challenges ch
    where public._challenge_eligible(v_uid, ch.metric) and (ch.city_scope is null or ch.city_scope = p_city)
      and ch.id not in (select uc.challenge_id from public.user_challenges uc where uc.user_id = v_uid and uc.week_start = v_week_start)
    order by random() limit 1;
  end if;
  if v_new_id is null then raise exception 'no challenge available'; end if;

  insert into public.user_challenges (user_id, week_start, challenge_id, target, coin_reward, city)
  select v_uid, v_week_start, ch.id,
    case when ch.metric = 'territory_kind_variety' then
      (select count(distinct kind) from public.territories where id like v_prefix || '%' and is_deleted = false)
    else ch.target end,
    ch.coin_reward, p_city
  from public.challenges ch where ch.id = v_new_id;

  update public.user_challenge_weeks set extra_slot_bought = true where user_id = v_uid and week_start = v_week_start;
  insert into public.coin_transactions (user_id, amount, reason, label) values (v_uid, -v_price, 'buy_extra_challenge', v_buff_name);
end;
$function$
$bk$, '2026-10-19T22:06:57.569418+00:00'),
(18869, 'sync_my_challenges', $bk$CREATE OR REPLACE FUNCTION public.sync_my_challenges(p_city text, p_timezone text)
 RETURNS TABLE(id bigint, challenge_id text, name text, description text, tier text, coin_reward integer, target integer, progress integer, completed_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_uid uuid := auth.uid();
  v_prefix text := public._city_prefix(p_city);
  v_week_start timestamptz;
  v_row record;
  v_row_city text;
  v_progress int;
  v_payout int;
  v_credited int;
  v_soft_id text;
  v_light_id text;
  v_third_tier text;
  v_third_id text;
  v_any_completed boolean := false;
  v_week_coins int;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  v_week_start := date_trunc('week', now() at time zone p_timezone) at time zone p_timezone;

  for v_row in
    select uc.id as row_id, uc.week_start, uc.target, uc.coin_reward, uc.city, c.metric, c.params, c.name as challenge_name
    from public.user_challenges uc
    join public.challenges c on c.id = uc.challenge_id
    where uc.user_id = v_uid and uc.settled = false
  loop
    -- Прогресс — по городу, для которого челлендж создан: московские уловы
    -- не закрывают батумскую неделю и наоборот, кто бы ни вызвал проверку.
    v_row_city := coalesce(v_row.city,
      case when (floor(extract(epoch from v_row.week_start) / 3600)::bigint % 24) = 21 then 'moscow' else 'batumi' end);
    v_progress := public.compute_challenge_progress(
      v_uid, v_row.metric, v_row.params, v_row.week_start, v_row.week_start + interval '7 days',
      public._city_prefix(v_row_city), public._city_tz(v_row_city)
    );

    if v_progress >= v_row.target then
      -- «and settled = false» + found: две одновременные проверки не
      -- заплатят дважды — вторая просто не найдёт незакрытую строку.
      update public.user_challenges uc set settled = true, completed_at = now() where uc.id = v_row.row_id and uc.settled = false;
      if found then
        v_credited := v_row.coin_reward * public.coin_multiplier(v_uid);
        update public.profiles p set coins = p.coins + v_credited where p.id = v_uid;
        insert into public.coin_transactions (user_id, amount, reason, label) values (v_uid, v_credited, 'challenge_reward', v_row.challenge_name);
        insert into public.notifications (user_id, kind, payload)
          values (v_uid, 'challenge_completed', jsonb_build_object('title', v_row.challenge_name, 'coins', v_credited));
        v_any_completed := true;
      end if;
    elsif v_row.week_start + interval '7 days' <= now() then
      update public.user_challenges uc set settled = true where uc.id = v_row.row_id and uc.settled = false;
      if found then
        v_payout := floor(v_progress::numeric / v_row.target * v_row.coin_reward);
        if v_payout > 0 then
          v_credited := v_payout * public.coin_multiplier(v_uid);
          update public.profiles p set coins = p.coins + v_credited where p.id = v_uid;
          insert into public.coin_transactions (user_id, amount, reason, label) values (v_uid, v_credited, 'challenge_reward', v_row.challenge_name || ' (частично)');
        end if;
      end if;
    end if;
  end loop;

  -- Fires exactly once — the moment the LAST still-open slot for this week
  -- settles, this call's own diff already found at least one fresh
  -- completion, and afterward none of this week's rows are still open. Any
  -- earlier or later sync for an already-fully-done week won't re-enter
  -- this branch, since v_any_completed stays false when nothing changed.
  if v_any_completed and not exists (
    select 1 from public.user_challenges uc4
    where uc4.user_id = v_uid and uc4.week_start = v_week_start and uc4.completed_at is null
  ) then
    select coalesce(sum(uc5.coin_reward), 0) * public.coin_multiplier(v_uid) into v_week_coins
    from public.user_challenges uc5
    where uc5.user_id = v_uid and uc5.week_start = v_week_start;

    insert into public.notifications (user_id, kind, payload)
      values (v_uid, 'challenges_week_done', jsonb_build_object('coins', v_week_coins));
  end if;

  if not exists (select 1 from public.user_challenges uc2 where uc2.user_id = v_uid and uc2.week_start = v_week_start) then
    select ch.id into v_soft_id from public.challenges ch
    where ch.tier = 'soft' and public._challenge_eligible(v_uid, ch.metric) and (ch.city_scope is null or ch.city_scope = p_city)
      and ch.id not in (
        select uc3.challenge_id from public.user_challenges uc3
        where uc3.user_id = v_uid and uc3.week_start >= v_week_start - interval '14 days'
      )
    order by random() limit 1;
    if v_soft_id is null then
      select ch.id into v_soft_id from public.challenges ch
      where ch.tier = 'soft' and public._challenge_eligible(v_uid, ch.metric) and (ch.city_scope is null or ch.city_scope = p_city)
      order by random() limit 1;
    end if;

    select ch.id into v_light_id from public.challenges ch
    where ch.tier = 'light' and public._challenge_eligible(v_uid, ch.metric) and (ch.city_scope is null or ch.city_scope = p_city)
      and ch.id not in (
        select uc3.challenge_id from public.user_challenges uc3
        where uc3.user_id = v_uid and uc3.week_start >= v_week_start - interval '14 days'
      )
    order by random() limit 1;
    if v_light_id is null then
      select ch.id into v_light_id from public.challenges ch
      where ch.tier = 'light' and public._challenge_eligible(v_uid, ch.metric) and (ch.city_scope is null or ch.city_scope = p_city)
      order by random() limit 1;
    end if;

    v_third_tier := case when random() < 0.5 then 'medium' else 'hard' end;
    select ch.id into v_third_id from public.challenges ch
    where ch.tier = v_third_tier and public._challenge_eligible(v_uid, ch.metric) and (ch.city_scope is null or ch.city_scope = p_city)
      and ch.id not in (
        select uc3.challenge_id from public.user_challenges uc3
        where uc3.user_id = v_uid and uc3.week_start >= v_week_start - interval '14 days'
      )
    order by random() limit 1;
    if v_third_id is null then
      select ch.id into v_third_id from public.challenges ch
      where ch.tier = v_third_tier and public._challenge_eligible(v_uid, ch.metric) and (ch.city_scope is null or ch.city_scope = p_city)
      order by random() limit 1;
    end if;

    insert into public.user_challenges (user_id, week_start, challenge_id, target, coin_reward, city)
    select v_uid, v_week_start, ch.id,
      case when ch.metric = 'territory_kind_variety' then
        (select count(distinct t2.kind) from public.territories t2 where t2.id like v_prefix || '%' and t2.is_deleted = false)
      else ch.target end,
      ch.coin_reward, p_city
    from public.challenges ch
    where ch.id in (v_soft_id, v_light_id, v_third_id);
  end if;

  return query
  select uc.id, uc.challenge_id, c.name, c.description, c.tier, uc.coin_reward, uc.target,
    least(public.compute_challenge_progress(v_uid, c.metric, c.params, uc.week_start, uc.week_start + interval '7 days', v_prefix, p_timezone), uc.target),
    uc.completed_at
  from public.user_challenges uc
  join public.challenges c on c.id = uc.challenge_id
  where uc.user_id = v_uid and uc.week_start = v_week_start
  order by array_position(array['soft','light','medium','hard'], c.tier);
end;
$function$
$bk$, '2026-10-19T22:06:57.569418+00:00'),
(19116, 'get_my_challenge_week_state', $bk$CREATE OR REPLACE FUNCTION public.get_my_challenge_week_state(p_timezone text)
 RETURNS TABLE(swap_used boolean, extra_slot_bought boolean, slot_count integer, week_ends_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_uid uuid := auth.uid();
  v_week_start timestamptz;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  v_week_start := date_trunc('week', now() at time zone p_timezone) at time zone p_timezone;

  return query
  select coalesce(w.swap_used, false), coalesce(w.extra_slot_bought, false),
    (select count(*)::int from public.user_challenges uc where uc.user_id = v_uid and uc.week_start = v_week_start),
    v_week_start + interval '7 days'
  from (select 1) dummy
  left join public.user_challenge_weeks w on w.user_id = v_uid and w.week_start = v_week_start;
end;
$function$
$bk$, '2026-10-19T22:06:57.569418+00:00'),
(19117, 'notify_challenge_deadline_approaching', $bk$CREATE OR REPLACE FUNCTION public.notify_challenge_deadline_approaching(p_city text, p_timezone text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_week_start timestamptz;
begin
  v_week_start := date_trunc('week', now() at time zone p_timezone) at time zone p_timezone;

  -- Runs once a week, right at the 48h-remaining mark for this city (see the
  -- pg_cron schedule) — every user of that city who has this week's slate
  -- but hasn't cleared it yet gets exactly one nudge, never a duplicate,
  -- since the job only ever fires this once per week per city.
  insert into public.notifications (user_id, kind, payload)
  select distinct uc.user_id, 'challenge_deadline_soon', jsonb_build_object('hours', 48)
  from public.user_challenges uc
  join public.profiles p on p.id = uc.user_id
  where uc.week_start = v_week_start
    and p.city = p_city
    and exists (
      select 1 from public.user_challenges uc2
      where uc2.user_id = uc.user_id and uc2.week_start = v_week_start and uc2.completed_at is null
    );
end;
$function$
$bk$, '2026-10-19T22:06:57.569418+00:00');
