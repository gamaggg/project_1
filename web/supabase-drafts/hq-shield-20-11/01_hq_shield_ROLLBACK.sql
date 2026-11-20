-- Rollback of 01_hq_shield.sql: use_free_shield without the siege check, clan_hq_tick as in hq_attacker_notices_20_11
-- (the shield stays on a taken sector).

CREATE OR REPLACE FUNCTION public.use_free_shield(p_territory_id text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;
  if not exists (
    select 1 from public.territories t
    where t.id = p_territory_id and not t.is_deleted
      and (t.owner_id = v_uid
        or exists (select 1 from public.territory_shares s where s.territory_id = t.id and s.user_id = v_uid))
  ) then
    raise exception 'not your sector';
  end if;
  -- Горячий сектор открыт для всех до конца недели: щит на него не ставится.
  if exists (select 1 from public.hot_sectors hs where hs.territory_id = p_territory_id and now() >= hs.starts_at and now() < hs.ends_at) then
    raise exception 'HOT_SECTOR';
  end if;
  update public.profiles set free_shields = free_shields - 1 where id = v_uid and free_shields > 0;
  if not found then
    raise exception 'no free shields';
  end if;
  update public.territories set shield_until = greatest(coalesce(shield_until, now()), now()) + interval '24 hours' where id = p_territory_id;
end;
$function$;

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
