-- Back to the treasury donation as it was before 01_gift_coins.sql (body copied from the live DB on 17.11.2026).
create or replace function public.clan_treasury_donate(p_amount integer)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare v_uid uuid := auth.uid(); v_m public.clan_members; v_e public.clan_economy; v_added int; v_bal int;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  if p_amount is null or p_amount < 1 or p_amount > 5000 then raise exception 'CLAN:bad_amount'; end if;
  select * into v_m from public._my_clan_membership(v_uid);
  if v_m.id is null then raise exception 'CLAN:not_member'; end if;
  if not public._clan_econ_on(v_m.clan_id) then raise exception 'CLAN:treasury_off'; end if;
  perform 1 from public.profiles where id = v_uid for update;
  update public.profiles set coins = coins - p_amount where id = v_uid and coins >= p_amount;
  if not found then raise exception 'not enough coins'; end if;
  v_added := public._clan_treasury_add(v_m.clan_id, p_amount, 'donation', v_uid, null);
  if v_added < p_amount then
    update public.profiles set coins = coins + (p_amount - v_added) where id = v_uid;
  end if;
  insert into public.coin_transactions (user_id, amount, reason, label) values (v_uid, -v_added, 'clan_donation', 'Взнос в общак клана');
  select balance into v_bal from public.clan_treasury where clan_id = v_m.clan_id;
  return jsonb_build_object('added', v_added, 'returned', p_amount - v_added, 'balance', v_bal);
end $function$;
drop function if exists public.clan_treasury_donatable();
drop function if exists public._clan_gift_locked(uuid);
