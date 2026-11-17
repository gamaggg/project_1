-- Dry run of 01_gift_coins.sql: everything inside one DO block that ends with an exception, so nothing stays.
do $dry$
declare r text := 'RESULT';
begin
-- Gift coins (the welcome bonus and the invite bonus) cannot go into a clan treasury.
-- Why: new accounts were made just to drop their starting coins into a clan.
--
-- Rule: gift coins are the first to go on any other spending (shop, shields,
-- challenges…). What is still unspent of them stays on the account but cannot be
-- donated: donatable = coins − max(0, gifts − spent). Donations do not count as
-- spending (otherwise each donation would "use up" gift coins and unlock more),
-- except donations made before this rule (cutoff below), so nobody pays twice.

create or replace function public._clan_gift_locked(p_uid uuid)
returns integer
language sql
stable
security definer
set search_path to 'public'
as $$
  select greatest(0,
    coalesce(sum(amount) filter (where reason in ('welcome_bonus', 'referral_welcome')), 0)
    - coalesce(-sum(amount) filter (
        where amount < 0
          and reason <> 'clan_tax'
          and (reason <> 'clan_donation' or created_at < timestamptz '2026-11-17 15:30:00+00')
      ), 0)
  )::int
  from public.coin_transactions
  where user_id = p_uid
$$;
revoke all on function public._clan_gift_locked(uuid) from public, anon, authenticated;

-- What the caller may put into the treasury right now.
create or replace function public.clan_treasury_donatable()
returns integer
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare v_uid uuid := auth.uid(); v_coins int;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  select coins into v_coins from public.profiles where id = v_uid;
  return greatest(0, coalesce(v_coins, 0) - public._clan_gift_locked(v_uid));
end $$;
revoke all on function public.clan_treasury_donatable() from public, anon;
grant execute on function public.clan_treasury_donatable() to authenticated;

-- Same signature (no defaults), CREATE OR REPLACE keeps the grants.
create or replace function public.clan_treasury_donate(p_amount integer)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare v_uid uuid := auth.uid(); v_m public.clan_members; v_e public.clan_economy; v_added int; v_bal int; v_coins int;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  if p_amount is null or p_amount < 1 or p_amount > 5000 then raise exception 'CLAN:bad_amount'; end if;
  select * into v_m from public._my_clan_membership(v_uid);
  if v_m.id is null then raise exception 'CLAN:not_member'; end if;
  if not public._clan_econ_on(v_m.clan_id) then raise exception 'CLAN:treasury_off'; end if;
  select coins into v_coins from public.profiles where id = v_uid for update;
  if coalesce(v_coins, 0) >= p_amount and p_amount > v_coins - public._clan_gift_locked(v_uid) then
    raise exception 'CLAN:gift_coins';
  end if;
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


  -- 1) newcomer: 150 coins, all of them the welcome bonus
  r := r || ' | A.locked=' || coalesce(public._clan_gift_locked('cf300b78-ae66-4a31-b3e0-3a30015bf2fc')::text,'?');
  perform set_config('request.jwt.claims', '{"sub":"cf300b78-ae66-4a31-b3e0-3a30015bf2fc","role":"authenticated"}', true);
  r := r || ' A.can=' || public.clan_treasury_donatable();
  begin perform public.clan_treasury_donate(10); r := r || ' A10=OK'; exception when others then r := r || ' A10=' || sqlerrm; end;
  begin perform public.clan_treasury_donate(500); r := r || ' A500=OK'; exception when others then r := r || ' A500=' || sqlerrm; end;
  -- 2) 260 coins, 250 of them gifts: 10 may go, 20 may not
  perform set_config('request.jwt.claims', '{"sub":"83d274e2-b4c4-4ae2-af2d-9f35121926aa","role":"authenticated"}', true);
  r := r || ' | B.can=' || public.clan_treasury_donatable();
  begin perform public.clan_treasury_donate(20); r := r || ' B20=OK'; exception when others then r := r || ' B20=' || sqlerrm; end;
  begin perform public.clan_treasury_donate(10); r := r || ' B10=OK'; exception when others then r := r || ' B10=' || sqlerrm; end;
  r := r || ' B.after=' || public.clan_treasury_donatable();
  begin perform public.clan_treasury_donate(10); r := r || ' B10again=OK'; exception when others then r := r || ' B10again=' || sqlerrm; end;
  -- 3) a player with no gift coins left
  perform set_config('request.jwt.claims', '{"sub":"a44d3028-7f05-418e-82b8-84da341bd7ed","role":"authenticated"}', true);
  r := r || ' | C.can=' || public.clan_treasury_donatable();
  begin perform public.clan_treasury_donate(100); r := r || ' C100=OK'; exception when others then r := r || ' C100=' || sqlerrm; end;
  -- grants
  r := r || ' | anon_can_donatable=' || has_function_privilege('anon','public.clan_treasury_donatable()','execute')
         || ' auth_can_donatable=' || has_function_privilege('authenticated','public.clan_treasury_donatable()','execute')
         || ' auth_can_locked=' || has_function_privilege('authenticated','public._clan_gift_locked(uuid)','execute')
         || ' auth_can_donate=' || has_function_privilege('authenticated','public.clan_treasury_donate(integer)','execute');

  raise exception '%', r;
end $dry$;
