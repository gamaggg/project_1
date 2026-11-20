-- Rollback of 01_hq_attacker_notices.sql: the three HQ functions as they were before 20.11.2026, the helper dropped,
-- the three kinds out of queue_telegram_notification's list. Notifications already sent stay in «Активность».

CREATE OR REPLACE FUNCTION public.clan_hq_attack(p_territory_id text, p_attacker uuid, p_defense_left integer)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_hq public.clan_hq; v_s public.clan_sieges;
begin
  select * into v_hq from public.clan_hq where territory_id = p_territory_id;
  if v_hq.clan_id is null then return false; end if;
  if exists (select 1 from public.clan_members cm where cm.clan_id = v_hq.clan_id and cm.user_id = p_attacker and cm.left_at is null) then return false; end if;
  if p_defense_left > 0 then return false; end if;
  select * into v_s from public.clan_sieges where territory_id = p_territory_id;
  if v_s.territory_id is not null then return true; end if;
  insert into public.clan_sieges (territory_id, clan_id, attacker_id, ends_at)
  values (p_territory_id, v_hq.clan_id, p_attacker,
          now() + make_interval(mins => 90 + (case public._clan_project_level(v_hq.clan_id, 'beacon') when 1 then 10 when 2 then 20 when 3 then 30 else 0 end)));
  perform public._clan_notify(cm.user_id, 'clan_hq_siege', p_attacker, v_hq.clan_id, jsonb_build_object('territory_id', p_territory_id))
    from public.clan_members cm where cm.clan_id = v_hq.clan_id and cm.left_at is null;
  return true;
end $function$;

CREATE OR REPLACE FUNCTION public.clan_hq_defend(p_territory_id text, p_defender uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_clan bigint;
begin
  select s.clan_id into v_clan from public.clan_sieges s where s.territory_id = p_territory_id;
  if v_clan is null then return false; end if;
  if not exists (select 1 from public.clan_members cm where cm.clan_id = v_clan and cm.user_id = p_defender and cm.left_at is null) then return false; end if;
  delete from public.clan_sieges where territory_id = p_territory_id;
  update public.profiles set coins = coins + 150 where id = p_defender;
  insert into public.coin_transactions (user_id, amount, reason, label) values (p_defender, 150, 'clan_siege_break', 'Осада штаба снята');
  perform public._clan_notify_many(v_clan, 'clan_hq_saved', p_defender, jsonb_build_object('territory_id', p_territory_id), 'all', null);
  return true;
end $function$;

CREATE OR REPLACE FUNCTION public.clan_hq_tick()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare r record; n int := 0; v_loot int; v_att_clan bigint;
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
    n := n + 1;
  end loop;
  return n;
end $function$;

drop function if exists public._clan_hq_attacker_clan(uuid, text);

do $$
declare d text := pg_get_functiondef('public.queue_telegram_notification()'::regprocedure);
begin
  d := replace(d, '''clan_hq_fell'', ''clan_hq_siege_ours'', ''clan_hq_siege_broken'', ''clan_hq_taken'', ''clan_buff_planned''', '''clan_hq_fell'', ''clan_buff_planned''');
  execute d;
end $$;
