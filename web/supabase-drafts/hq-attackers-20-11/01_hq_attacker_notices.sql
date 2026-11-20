-- 20.11.2026 (owner): «наш соклановец забрал штаб у противника, но нам ничего не пришло — нужно несколько уведомлений,
-- чтобы весь клан знал». Until now only the clan whose HQ it was heard of a siege and a fall (clan_hq_siege,
-- clan_hq_saved, clan_hq_fell). Now the attacker's clan hears too, every member, in «Активность» and in Telegram:
--   clan_hq_siege_ours   — a clanmate has put an enemy HQ under siege (to everyone but the attacker);
--   clan_hq_siege_broken — the defenders broke that siege (to everyone in the attacker's clan);
--   clan_hq_taken        — the siege held, the HQ is taken, the clan's share of the loot (to everyone, the attacker too).
-- The attacker's clan: the one of the sector's city (clan_members.city), else the player's own; a player without a clan
-- gets nothing new (the coins already come with a coin transaction). Payload: the attacker's clan (clan_id, clan_name,
-- crest — to open it) + territory_id + enemy (the HQ's clan) + enemy_crest; clan_hq_taken also loot (the clan's share,
-- 75%) and loot_total (all that was taken from the enemy's treasury, 20% of it, at most 1500).
-- Nothing else in the three functions changes. queue_telegram_notification: the three kinds join its list (patched in place).

create or replace function public._clan_hq_attacker_clan(p_attacker uuid, p_territory_id text)
returns bigint
language sql
stable
security definer
set search_path to 'public'
as $function$
  select coalesce(
    (select cm.clan_id from public.clan_members cm
      where cm.user_id = p_attacker and cm.left_at is null and cm.city = public._prefix_city(left(p_territory_id, 1)) limit 1),
    (select (public._my_clan_membership(p_attacker)).clan_id));
$function$;
revoke all on function public._clan_hq_attacker_clan(uuid, text) from public, anon, authenticated;

CREATE OR REPLACE FUNCTION public.clan_hq_attack(p_territory_id text, p_attacker uuid, p_defense_left integer)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_hq public.clan_hq; v_s public.clan_sieges; v_att_clan bigint; v_enemy public.clans; v_minutes int;
begin
  select * into v_hq from public.clan_hq where territory_id = p_territory_id;
  if v_hq.clan_id is null then return false; end if;
  if exists (select 1 from public.clan_members cm where cm.clan_id = v_hq.clan_id and cm.user_id = p_attacker and cm.left_at is null) then return false; end if;
  if p_defense_left > 0 then return false; end if;
  select * into v_s from public.clan_sieges where territory_id = p_territory_id;
  if v_s.territory_id is not null then return true; end if;
  v_minutes := 90 + (case public._clan_project_level(v_hq.clan_id, 'beacon') when 1 then 10 when 2 then 20 when 3 then 30 else 0 end);
  insert into public.clan_sieges (territory_id, clan_id, attacker_id, ends_at)
  values (p_territory_id, v_hq.clan_id, p_attacker, now() + make_interval(mins => v_minutes));
  perform public._clan_notify(cm.user_id, 'clan_hq_siege', p_attacker, v_hq.clan_id, jsonb_build_object('territory_id', p_territory_id))
    from public.clan_members cm where cm.clan_id = v_hq.clan_id and cm.left_at is null;
  -- 20.11: the attacker's clan hears of the siege too (all but the attacker).
  v_att_clan := public._clan_hq_attacker_clan(p_attacker, p_territory_id);
  if v_att_clan is not null and v_att_clan <> v_hq.clan_id then
    select * into v_enemy from public.clans where id = v_hq.clan_id;
    perform public._clan_notify(cm.user_id, 'clan_hq_siege_ours', p_attacker, v_att_clan,
        jsonb_build_object('territory_id', p_territory_id, 'enemy', v_enemy.name, 'enemy_crest', v_enemy.crest, 'minutes', v_minutes))
      from public.clan_members cm where cm.clan_id = v_att_clan and cm.left_at is null and cm.user_id <> p_attacker;
  end if;
  return true;
end $function$;

CREATE OR REPLACE FUNCTION public.clan_hq_defend(p_territory_id text, p_defender uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_clan bigint; v_attacker uuid; v_att_clan bigint; v_enemy public.clans;
begin
  select s.clan_id, s.attacker_id into v_clan, v_attacker from public.clan_sieges s where s.territory_id = p_territory_id;
  if v_clan is null then return false; end if;
  if not exists (select 1 from public.clan_members cm where cm.clan_id = v_clan and cm.user_id = p_defender and cm.left_at is null) then return false; end if;
  delete from public.clan_sieges where territory_id = p_territory_id;
  update public.profiles set coins = coins + 150 where id = p_defender;
  insert into public.coin_transactions (user_id, amount, reason, label) values (p_defender, 150, 'clan_siege_break', 'Осада штаба снята');
  perform public._clan_notify_many(v_clan, 'clan_hq_saved', p_defender, jsonb_build_object('territory_id', p_territory_id), 'all', null);
  -- 20.11: the attacker's clan hears that the siege was broken (everyone, the attacker too).
  if v_attacker is not null then
    v_att_clan := public._clan_hq_attacker_clan(v_attacker, p_territory_id);
    if v_att_clan is not null and v_att_clan <> v_clan then
      select * into v_enemy from public.clans where id = v_clan;
      perform public._clan_notify(cm.user_id, 'clan_hq_siege_broken', p_defender, v_att_clan,
          jsonb_build_object('territory_id', p_territory_id, 'enemy', v_enemy.name, 'enemy_crest', v_enemy.crest))
        from public.clan_members cm where cm.clan_id = v_att_clan and cm.left_at is null;
    end if;
  end if;
  return true;
end $function$;

CREATE OR REPLACE FUNCTION public.clan_hq_tick()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare r record; n int := 0; v_loot int; v_att_clan bigint; v_enemy public.clans;
begin
  for r in select s.territory_id, s.clan_id, s.attacker_id from public.clan_sieges s where s.ends_at <= now() loop
    select least(1500, floor(coalesce(t.balance, 0) * 0.2))::int into v_loot from public.clan_treasury t where t.clan_id = r.clan_id for update;
    v_loot := coalesce(v_loot, 0);
    select clan_id into v_att_clan from public._my_clan_membership(r.attacker_id);
    if v_loot > 0 then
      perform public._clan_treasury_spend(r.clan_id, v_loot, 'looted', r.attacker_id, r.territory_id);
      if v_att_clan is not null then
        perform public._clan_treasury_add(v_att_clan, floor(v_loot * 0.75)::int, 'loot', r.attacker_id, r.territory_id);
      elsif r.attacker_id is not null then
        update public.profiles set coins = coins + floor(v_loot * 0.75)::int where id = r.attacker_id;
        insert into public.coin_transactions (user_id, amount, reason, label) values (r.attacker_id, floor(v_loot * 0.75)::int, 'clan_hq_loot', 'Добыча при взятии штаба');
      end if;
    end if;
    insert into public.clan_hq_ruins (clan_id, territory_id, by_clan_id, by_user, loot, until)
    values (r.clan_id, r.territory_id, v_att_clan, r.attacker_id, v_loot, now() + interval '24 hours')
    on conflict (clan_id) do update set territory_id = excluded.territory_id, by_clan_id = excluded.by_clan_id, by_user = excluded.by_user,
      loot = excluded.loot, fell_at = now(), until = excluded.until;
    if r.attacker_id is not null then
      update public.territories set owner_id = r.attacker_id, claimed_at = now(), defense = 1, defense_at = now() where id = r.territory_id;
    end if;
    delete from public.clan_hq where territory_id = r.territory_id;
    perform public._clan_notify(cm.user_id, 'clan_hq_fell', r.attacker_id, r.clan_id, jsonb_build_object('territory_id', r.territory_id, 'loot', v_loot))
      from public.clan_members cm where cm.clan_id = r.clan_id and cm.left_at is null;
    -- 20.11: the clan that took it hears too (everyone, the attacker too): the clan whose treasury got the loot.
    if v_att_clan is not null and v_att_clan <> r.clan_id then
      select * into v_enemy from public.clans where id = r.clan_id;
      perform public._clan_notify(cm.user_id, 'clan_hq_taken', r.attacker_id, v_att_clan,
          jsonb_build_object('territory_id', r.territory_id, 'enemy', v_enemy.name, 'enemy_crest', v_enemy.crest,
            'loot', floor(v_loot * 0.75)::int, 'loot_total', v_loot))
        from public.clan_members cm where cm.clan_id = v_att_clan and cm.left_at is null;
    end if;
    n := n + 1;
  end loop;
  return n;
end $function$;

-- Telegram: the three kinds go out like the other clan news (held at night like them, only the defenders' siege is instant).
do $$
declare d text := pg_get_functiondef('public.queue_telegram_notification()'::regprocedure);
begin
  if position('clan_hq_taken' in d) = 0 then
    d := replace(d, '''clan_hq_fell'', ''clan_buff_planned''', '''clan_hq_fell'', ''clan_hq_siege_ours'', ''clan_hq_siege_broken'', ''clan_hq_taken'', ''clan_buff_planned''');
    if position('clan_hq_taken' in d) = 0 then raise exception 'queue_telegram_notification: kind list not found'; end if;
    execute d;
  end if;
end $$;
