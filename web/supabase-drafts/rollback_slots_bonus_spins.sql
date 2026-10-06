-- Откат slots_bonus_spins.sql: функции слотов как были до 06.10 (джекпот 0,5%, без подарочных прокрутов).

drop function if exists public.admin_grant_spins(uuid, integer);
drop function if exists public.admin_slot_spins(uuid);

create or replace function public._slot_day_state(p_uid uuid)
 returns table(total integer, used integer, day_start timestamp with time zone, next_reset timestamp with time zone)
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  with d as (
    select (date_trunc('day', now() at time zone public._city_tz(public._profile_city(p_uid))) at time zone public._city_tz(public._profile_city(p_uid))) as day_start
  )
  select
    least(4, 1 + (select count(*) from public.catches c where c.user_id = p_uid and c.caught_at >= d.day_start))::int,
    (select count(*) from public.slot_spins s where s.user_id = p_uid and s.created_at >= d.day_start)::int,
    d.day_start,
    d.day_start + interval '1 day'
  from d;
$function$;

create or replace function public.get_slot_state()
 returns jsonb
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
declare
  v_uid uuid := auth.uid();
  v record;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;
  select * into v from public._slot_day_state(v_uid);
  return jsonb_build_object(
    'total', v.total,
    'used', v.used,
    'left', greatest(v.total - v.used, 0),
    'next_reset', v.next_reset,
    'free_shields', (select free_shields from public.profiles where id = v_uid),
    'has_jackpot_frame', exists (select 1 from public.user_inventory where user_id = v_uid and item_id = 'frame_jackpot')
  );
end;
$function$;

create or replace function public.spin_slots()
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_uid uuid := auth.uid();
  v_state record;
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
  if v_state.used >= v_state.total then
    raise exception 'SLOTS:no_spins';
  end if;

  if v_r < 0.005 then
    v_reels := array['katran', 'katran', 'katran'];
    if exists (select 1 from public.shop_items where id = 'frame_jackpot')
       and not exists (select 1 from public.user_inventory where user_id = v_uid and item_id = 'frame_jackpot') then
      v_prize := 'jackpot';
      insert into public.user_inventory (user_id, item_id) values (v_uid, 'frame_jackpot');
    else
      v_prize := 'jackpot_coins';
      v_coins := 300;
    end if;
  elsif v_r < 0.035 then
    v_reels := array['hex', 'hex', 'hex'];
    v_prize := 'shield';
    update public.profiles set free_shields = free_shields + 1 where id = v_uid;
  elsif v_r < 0.075 then
    v_reels := array['hook', 'hook', 'hook'];
    v_prize := 'double';
    insert into public.active_buffs (user_id, buff_id, expires_at)
    values (v_uid, 'double_coins', greatest(now(), coalesce((
      select max(expires_at) from public.active_buffs where user_id = v_uid and buff_id = 'double_coins' and expires_at > now()
    ), now())) + interval '24 hours');
  elsif v_r < 0.100 then
    v_reels := array['lufar', 'lufar', 'lufar'];
    v_prize := 'lufar';
    v_coins := 100;
  elsif v_r < 0.200 then
    v_a := (array['stavrida', 'skorpena'])[1 + floor(random() * 2)::int];
    v_reels := array[v_a, v_a, v_a];
    v_prize := 'triple';
    v_coins := 25;
  elsif v_r < 0.500 then
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
      when 'lufar' then 'Слоты: три луфаря'
      when 'triple' then 'Слоты: три в ряд'
      else 'Слоты: два одинаковых'
    end;
    insert into public.coin_transactions (user_id, amount, reason, label) values (v_uid, v_coins, 'slots_prize', v_label);
  end if;

  insert into public.slot_spins (user_id, reels, prize, coins) values (v_uid, v_reels, v_prize, v_coins);
  select coins into v_balance from public.profiles where id = v_uid;

  return jsonb_build_object(
    'reels', to_jsonb(v_reels),
    'prize', v_prize,
    'coins', v_coins,
    'balance', v_balance,
    'left', greatest(v_state.total - v_state.used - 1, 0),
    'total', v_state.total,
    'free_shields', (select free_shields from public.profiles where id = v_uid)
  );
end;
$function$;

alter table public.slot_spins drop column if exists bonus;
drop table if exists public.slot_bonus_spins;
