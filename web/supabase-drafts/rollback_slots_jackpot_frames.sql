-- Откат slots_jackpot_frames.sql: магазин без признака purchasable, джекпот снова ищет frame_jackpot.
-- Сначала убрать рамки-призы, если релизный jackpot_frames.sql уже применён:
delete from public.user_inventory where item_id in ('frame_katran', 'frame_som');
update public.profiles set equipped_frame = null where equipped_frame in ('frame_katran', 'frame_som');
delete from public.shop_items where id in ('frame_katran', 'frame_som');

create or replace function public.buy_shop_item(p_item_id text)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_uid uuid := auth.uid();
  v_price int;
  v_name text;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  select price, name into v_price, v_name from public.shop_items where id = p_item_id;
  if v_price is null then
    raise exception 'unknown item';
  end if;

  if exists (select 1 from public.user_inventory where user_id = v_uid and item_id = p_item_id) then
    raise exception 'already owned';
  end if;

  update public.profiles set coins = coins - v_price
  where id = v_uid and coins >= v_price;
  if not found then
    raise exception 'not enough coins';
  end if;

  insert into public.user_inventory (user_id, item_id) values (v_uid, p_item_id);
  insert into public.coin_transactions (user_id, amount, reason, label) values (v_uid, -v_price, 'buy_item', v_name);
end;
$function$;

create or replace function public.admin_refund_shop_item(p_user_id uuid, p_item_id text)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare v_price int; v_name text;
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and is_super_admin) then
    raise exception 'not authorized';
  end if;
  select price, name into v_price, v_name from public.shop_items where id = p_item_id;
  if not found then raise exception 'unknown item'; end if;
  if not exists (select 1 from public.user_inventory where user_id = p_user_id and item_id = p_item_id) then
    raise exception 'not owned';
  end if;

  delete from public.user_inventory where user_id = p_user_id and item_id = p_item_id;
  update public.profiles set
    equipped_frame = case when equipped_frame = p_item_id then null else equipped_frame end,
    hero_bg = case when hero_bg = p_item_id then 'default' else hero_bg end,
    equipped_name_style = case when equipped_name_style = p_item_id then null else equipped_name_style end,
    equipped_skin = case when equipped_skin = p_item_id then null else equipped_skin end,
    coins = coins + v_price
  where id = p_user_id;

  insert into public.admin_actions (admin_id, action, target_user_id, details)
  values (auth.uid(), 'refund_item', p_user_id, 'Вернул покупку «' || v_name || '», +' || v_price || ' монет');
  insert into public.coin_transactions (user_id, amount, reason, label) values (p_user_id, v_price, 'admin_refund', v_name);
end;
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
  v_bonus int;
  v_use_bonus boolean;
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

  if v_r < 0.001 then
    v_reels := array['katran', 'katran', 'katran'];
    if exists (select 1 from public.shop_items where id = 'frame_jackpot')
       and not exists (select 1 from public.user_inventory where user_id = v_uid and item_id = 'frame_jackpot') then
      v_prize := 'jackpot';
      insert into public.user_inventory (user_id, item_id) values (v_uid, 'frame_jackpot');
    else
      v_prize := 'jackpot_coins';
      v_coins := 300;
    end if;
  elsif v_r < 0.031 then
    v_reels := array['hex', 'hex', 'hex'];
    v_prize := 'shield';
    update public.profiles set free_shields = free_shields + 1 where id = v_uid;
  elsif v_r < 0.071 then
    v_reels := array['hook', 'hook', 'hook'];
    v_prize := 'double';
    insert into public.active_buffs (user_id, buff_id, expires_at)
    values (v_uid, 'double_coins', greatest(now(), coalesce((
      select max(expires_at) from public.active_buffs where user_id = v_uid and buff_id = 'double_coins' and expires_at > now()
    ), now())) + interval '24 hours');
  elsif v_r < 0.096 then
    v_reels := array['lufar', 'lufar', 'lufar'];
    v_prize := 'lufar';
    v_coins := 100;
  elsif v_r < 0.196 then
    v_a := (array['stavrida', 'skorpena'])[1 + floor(random() * 2)::int];
    v_reels := array[v_a, v_a, v_a];
    v_prize := 'triple';
    v_coins := 25;
  elsif v_r < 0.496 then
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
$function$;

alter table public.shop_items drop column if exists purchasable;
