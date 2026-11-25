do $dry$
declare
  h_before text := md5(pg_get_functiondef('public.open_secret_box()'::regprocedure) || pg_get_functiondef('public.spin_slots()'::regprocedure) || pg_get_functiondef('public.get_secret_box_state()'::regprocedure));
  out text := ''; v_super uuid; v_player uuid; v_r jsonb; k int; n int := 4000;
  c jsonb := '{}'; c2 jsonb := '{}'; v_bad int := 0; v_c0 int; v_c1 int; v_free int; v_denied boolean := false;
begin
  execute $m9$-- Слоты: сундук и «Ассорти» (25.11.2026). ЧЕРНОВИК, применять только после «применяй». Применяется после 03–08.
--
-- Владелец: «давай сундук добавим и ассорти».
--   3 сундука          → бесплатное открытие секретного бокса (1,5 %). Бесплатные открытия копятся, не сгорают и
--                        тратятся первыми: бокс открывается без списания 500.
--   «Ассорти»          → три разные рыбы, 15 монет (8 %).
--   «Пара»             → 38 % → 28,5 % (10 монет, как было). «Ничего» как было, ≈ 24,7 %. Остальное без изменений.
--
-- До выпуска новое видит только суперадмин: те же условия, что у бокса (_secret_box_open_for). Остальные крутят
-- слоты по-старому, их старый код не знает ни сундука, ни «Ассорти». Выпуск — 05_release.sql (флаг secret_box).

-- Бесплатные открытия бокса (из слотов). Только через функции ниже, напрямую из приложения не читается.
create table if not exists public.secret_box_free (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  opens int not null default 0 check (opens >= 0)
);
alter table public.secret_box_free enable row level security;
revoke all on table public.secret_box_free from public, anon, authenticated;

-- Что показать на карточке бокса: цена и сколько бесплатных открытий. null — бокса для игрока нет (ещё не выпущен).
create or replace function public.get_secret_box_state()
 returns jsonb
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;
  if not public._secret_box_open_for(v_uid) then
    return null;
  end if;
  return jsonb_build_object('price', public._secret_box_price(),
    'free', coalesce((select f.opens from public.secret_box_free f where f.user_id = v_uid), 0));
end;
$function$;
revoke all on function public.get_secret_box_state() from public, anon;
grant execute on function public.get_secret_box_state() to authenticated;

-- Открыть бокс: бесплатное открытие (из слотов) тратится первым, иначе списать цену. Выпавшая группа даёт вещь
-- (3 из 4) или монеты (1 из 4) — 150/250, 500, 1 000, 2 500 по группе. Новая вещь — в инвентарь, повтор — половина
-- её цены монетами; записать.
create or replace function public.open_secret_box()
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_uid uuid := auth.uid();
  v_price int := public._secret_box_price();
  v_super boolean;
  v_coins int;
  v_free boolean;
  v_cost int;
  v_tier int;
  v_item text;
  v_name text;
  v_item_price int;
  v_dup boolean;
  v_refund int := 0;
  v_prize_coins int := 0;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;
  -- Строка профиля под замком: два нажатия подряд открывают два бокса по очереди, а не вперемешку.
  select p.coins, coalesce(p.is_super_admin, false) into v_coins, v_super from public.profiles p
   where p.id = v_uid and not coalesce(p.is_blocked, false) for update;
  if not found then
    raise exception 'account blocked';
  end if;
  if not public._secret_box_open_for(v_uid) then
    raise exception 'BOX_CLOSED';
  end if;
  -- 25.11.2026: бесплатное открытие из слотов (3 сундука) тратится первым.
  update public.secret_box_free set opens = opens - 1 where user_id = v_uid and opens > 0;
  v_free := found;
  v_cost := case when v_free then 0 else v_price end;
  if v_coins < v_cost then
    raise exception 'not enough coins';
  end if;

  v_tier := public._secret_box_roll();
  -- 25.11.2026: каждый четвёртый приз в группе — монеты.
  if random() < 0.25 then
    v_prize_coins := public._secret_box_coin_prize(v_tier);
    update public.profiles set coins = coins - v_cost + v_prize_coins where id = v_uid;
    insert into public.secret_box_opens (user_id, item_id, tier, price, refund, coins) values (v_uid, null, v_tier, v_cost, 0, v_prize_coins);
    if v_cost > 0 then
      insert into public.coin_transactions (user_id, amount, reason, label) values (v_uid, -v_cost, 'secret_box', 'Секретный бокс: монеты');
    end if;
    insert into public.coin_transactions (user_id, amount, reason, label) values (v_uid, v_prize_coins, 'secret_box_coins', 'Секретный бокс: монеты');
    return jsonb_build_object('item_id', null, 'tier', v_tier, 'name', null, 'duplicate', false, 'refund', 0, 'coins', v_prize_coins, 'free', v_free);
  end if;

  select s.id, s.name, s.price into v_item, v_name, v_item_price from public.shop_items s
   where s.purchasable and s.price > 0 and (s.released or v_super) and public._secret_box_tier(s.price) = v_tier
   order by random() limit 1;
  if v_item is null then
    -- В группе нет ни одной вещи (каталог поменяли): любая вещь магазина.
    select s.id, s.name, s.price into v_item, v_name, v_item_price from public.shop_items s
     where s.purchasable and s.price > 0 and (s.released or v_super)
     order by random() limit 1;
    if v_item is null then
      raise exception 'BOX_EMPTY';
    end if;
    v_tier := public._secret_box_tier(v_item_price);
  end if;

  v_dup := exists (select 1 from public.user_inventory i where i.user_id = v_uid and i.item_id = v_item);
  if v_dup then
    v_refund := (v_item_price / 20) * 10;
  end if;

  update public.profiles set coins = coins - v_cost + v_refund where id = v_uid;
  insert into public.secret_box_opens (user_id, item_id, tier, price, refund) values (v_uid, v_item, v_tier, v_cost, v_refund);
  if v_cost > 0 then
    insert into public.coin_transactions (user_id, amount, reason, label) values (v_uid, -v_cost, 'secret_box', 'Секретный бокс: ' || v_name);
  end if;
  if v_dup then
    insert into public.coin_transactions (user_id, amount, reason, label) values (v_uid, v_refund, 'secret_box_refund', 'Секретный бокс: повтор ' || v_name);
  else
    insert into public.user_inventory (user_id, item_id) values (v_uid, v_item);
  end if;
  return jsonb_build_object('item_id', v_item, 'tier', v_tier, 'name', v_name, 'duplicate', v_dup, 'refund', v_refund, 'coins', 0, 'free', v_free);
end;
$function$;
revoke all on function public.open_secret_box() from public, anon;
grant execute on function public.open_secret_box() to authenticated;

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
  v_frame text;
  v_r double precision := random();
  v_new boolean;
  v_shift double precision;
  v_fish text[] := array['stavrida', 'skorpena', 'lufar', 'katran'];
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

  -- 25.11.2026: сундук (1,5 %) и «Ассорти» (8 %) — там, где открыт секретный бокс (до выпуска только суперадмин).
  -- Место для них берётся у «пары»: 38 % → 28,5 %. Остальные шансы прежние, всё после сундука сдвигается на 1,5 %.
  v_new := public._secret_box_open_for(v_uid);
  v_shift := case when v_new then 0.015 else 0 end;
  if v_new then
    v_symbols := v_symbols || 'chest'::text;
  end if;

  -- Odds (decided 06.10, «сильно»): jackpot 0,3% · shield 5% · ×2 coins 6% · 100 coins 4% ·
  -- 3 ставриды 25 coins 14% · 3 скорпены a free spin 8% · a pair 10 coins 38% · miss ~24,7%.
  -- With the box (25.11): + 3 сундука a free box 1,5% · «Ассорти» 15 coins 8% · a pair 28,5%.
  if v_r < 0.003 then
    v_reels := array['katran', 'katran', 'katran'];
    -- The jackpot frame is the player's city's own: «Катран» in Batumi, «Сом» in Moscow.
    v_frame := public._city_frame(public._profile_city(v_uid));
    if exists (select 1 from public.shop_items where id = v_frame)
       and not exists (select 1 from public.user_inventory where user_id = v_uid and item_id = v_frame) then
      v_prize := 'jackpot';
      insert into public.user_inventory (user_id, item_id) values (v_uid, v_frame);
    else
      v_prize := 'jackpot_coins';
      v_coins := 300;
    end if;
  elsif v_new and v_r < 0.018 then
    -- 3 сундука: бесплатное открытие секретного бокса, копится.
    v_reels := array['chest', 'chest', 'chest'];
    v_prize := 'chest';
    insert into public.secret_box_free as f (user_id, opens) values (v_uid, 1)
    on conflict (user_id) do update set opens = f.opens + 1;
  elsif v_r < 0.053 + v_shift then
    v_reels := array['hex', 'hex', 'hex'];
    v_prize := 'shield';
    -- At most 3 shields in reserve: one won on top of a full reserve pays 70 coins.
    if (select free_shields from public.profiles where id = v_uid) >= 3 then
      v_coins := 70;
    else
      update public.profiles set free_shields = free_shields + 1 where id = v_uid;
    end if;
  elsif v_r < 0.113 + v_shift then
    v_reels := array['hook', 'hook', 'hook'];
    v_prize := 'double';
    insert into public.active_buffs (user_id, buff_id, expires_at)
    values (v_uid, 'double_coins', greatest(now(), coalesce((
      select max(expires_at) from public.active_buffs where user_id = v_uid and buff_id = 'double_coins' and expires_at > now()
    ), now())) + interval '24 hours');
  elsif v_r < 0.153 + v_shift then
    v_reels := array['lufar', 'lufar', 'lufar'];
    v_prize := 'lufar';
    v_coins := 100;
  elsif v_r < 0.293 + v_shift then
    v_reels := array['stavrida', 'stavrida', 'stavrida'];
    v_prize := 'triple';
    v_coins := 25;
  elsif v_r < 0.373 + v_shift then
    -- 3 скорпены (3 леща in Moscow): a free spin into the same store as gift
    -- spins — it doesn't burn at midnight and goes after the day's own.
    v_reels := array['skorpena', 'skorpena', 'skorpena'];
    v_prize := 'free_spin';
    insert into public.slot_bonus_spins as b (user_id, spins) values (v_uid, 1)
    on conflict (user_id) do update set spins = b.spins + 1;
    v_bonus := v_bonus + 1;
  elsif v_new and v_r < 0.468 then
    -- «Ассорти»: три разные рыбы.
    v_reels := (select array_agg(s) from (select s from unnest(v_fish) s order by random() limit 3) x);
    v_prize := 'assorti';
    v_coins := 15;
  elsif v_r < 0.753 then
    v_a := v_symbols[1 + floor(random() * array_length(v_symbols, 1))::int];
    v_b := (select s from unnest(v_symbols) s where s <> v_a order by random() limit 1);
    v_pos := 1 + floor(random() * 3)::int;
    v_reels := array[v_a, v_a, v_a];
    v_reels[v_pos] := v_b;
    v_prize := 'pair';
    v_coins := 10;
  else
    -- Мимо: три разных символа; с «Ассорти» — не три рыбы (это уже выигрыш).
    loop
      v_reels := (select array_agg(s) from (select s from unnest(v_symbols) s order by random() limit 3) x);
      exit when not v_new or not (v_reels <@ v_fish);
    end loop;
    v_prize := 'none';
  end if;

  if v_coins > 0 then
    update public.profiles set coins = coins + v_coins where id = v_uid;
    v_label := case v_prize
      when 'jackpot_coins' then 'Слоты: джекпот'
      when 'lufar' then 'Слоты: 100 монет'
      when 'triple' then 'Слоты: три в ряд'
      when 'assorti' then 'Слоты: ассорти'
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
    'free_shields', (select free_shields from public.profiles where id = v_uid),
    'box_free', case when v_new then coalesce((select f.opens from public.secret_box_free f where f.user_id = v_uid), 0) end
  );
end;
$function$;
revoke all on function public.spin_slots() from public, anon;
grant execute on function public.spin_slots() to authenticated;
$m9$;
  select id into v_super from public.profiles where is_super_admin order by created_at limit 1;
  select id into v_player from public.profiles where not coalesce(is_super_admin,false) and not coalesce(is_blocked,false) order by created_at limit 1;
  insert into public.slot_bonus_spins as b (user_id, spins) values (v_super, n + 10), (v_player, n + 10) on conflict (user_id) do update set spins = b.spins + n + 10;

  -- суперадмин: новые шансы
  perform set_config('request.jwt.claims', json_build_object('sub', v_super, 'role','authenticated')::text, true);
  for k in 1..n loop
    v_r := public.spin_slots();
    c := jsonb_set(c, array[v_r->>'prize'], to_jsonb(coalesce((c->>(v_r->>'prize'))::int, 0) + 1));
    if v_r->>'prize' = 'assorti' and not (select bool_and(x in ('stavrida','skorpena','lufar','katran')) and count(distinct x) = 3 from jsonb_array_elements_text(v_r->'reels') x) then v_bad := v_bad + 1; end if;
    if v_r->>'prize' = 'none' and (select bool_and(x in ('stavrida','skorpena','lufar','katran')) from jsonb_array_elements_text(v_r->'reels') x) then v_bad := v_bad + 1; end if;
    if v_r->>'prize' = 'chest' and v_r->'reels' <> '["chest","chest","chest"]' then v_bad := v_bad + 1; end if;
  end loop;
  select opens into v_free from public.secret_box_free where user_id = v_super;
  out := 'super ' || n || ': ' || c::text || ' bad=' || v_bad || ' free opens=' || v_free || ' last=' || v_r::text;

  -- бесплатное открытие: монеты не списываются, счётчик −1
  select coins into v_c0 from public.profiles where id = v_super;
  v_r := public.open_secret_box();
  select coins into v_c1 from public.profiles where id = v_super;
  out := out || E'\nfree open: ' || v_r::text || ' coins delta=' || (v_c1 - v_c0) || ' (prize/refund ' || ((v_r->>'coins')::int + (v_r->>'refund')::int) || ')'
    || ' free left=' || (select opens from public.secret_box_free where user_id = v_super)
    || ' state=' || public.get_secret_box_state()::text
    || ' tx -500 last=' || exists (select 1 from public.coin_transactions where user_id = v_super and reason = 'secret_box' and created_at = now());
  -- без бесплатных — платно
  update public.secret_box_free set opens = 0 where user_id = v_super;
  update public.profiles set coins = 100000 where id = v_super;
  v_r := public.open_secret_box();
  select coins into v_c1 from public.profiles where id = v_super;
  out := out || E'\npaid open: free=' || (v_r->>'free') || ' coins delta=' || (v_c1 - 100000) || ' (prize/refund ' || ((v_r->>'coins')::int + (v_r->>'refund')::int) || ')';

  -- игрок до выпуска: старые шансы
  perform set_config('request.jwt.claims', json_build_object('sub', v_player, 'role','authenticated')::text, true);
  for k in 1..n loop
    v_r := public.spin_slots();
    c2 := jsonb_set(c2, array[v_r->>'prize'], to_jsonb(coalesce((c2->>(v_r->>'prize'))::int, 0) + 1));
  end loop;
  out := out || E'\nplayer ' || n || ': ' || c2::text || ' chest on reels=' || exists (select 1 from public.slot_spins where user_id = v_player and 'chest' = any(reels)) || ' box_free key=' || coalesce(v_r->>'box_free', 'null')
    || ' state=' || coalesce(public.get_secret_box_state()::text, 'null');

  begin
    set local role authenticated;
    perform count(*) from public.secret_box_free;
  exception when insufficient_privilege then v_denied := true;
  end;
  reset role;
  out := out || E'\ntable closed to app=' || v_denied;

  execute $rb9$-- Откат 09 (25.11.2026): слоты снова без сундука и «Ассорти», бокс без бесплатных открытий — функции как до 09.
-- Таблица бесплатных открытий удаляется вместе с ещё не потраченными открытиями. Монеты, вещи и строки истории
-- остаются; прокруты с сундуком/«Ассорти» остаются в slot_spins (prize 'chest' / 'assorti').

create or replace function public.get_secret_box_state()
 returns jsonb
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;
  if not public._secret_box_open_for(v_uid) then
    return null;
  end if;
  return jsonb_build_object('price', public._secret_box_price());
end;
$function$;
revoke all on function public.get_secret_box_state() from public, anon;
grant execute on function public.get_secret_box_state() to authenticated;

-- Открыть бокс: списать цену; выпавшая группа даёт вещь (3 из 4) или монеты (1 из 4) — 150/250, 500, 1 000, 2 500
-- по группе. Новая вещь — в инвентарь, повтор — половина её цены монетами; записать.
create or replace function public.open_secret_box()
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_uid uuid := auth.uid();
  v_price int := public._secret_box_price();
  v_super boolean;
  v_coins int;
  v_tier int;
  v_item text;
  v_name text;
  v_item_price int;
  v_dup boolean;
  v_refund int := 0;
  v_prize_coins int := 0;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;
  -- Строка профиля под замком: два нажатия подряд открывают два бокса по очереди, а не вперемешку.
  select p.coins, coalesce(p.is_super_admin, false) into v_coins, v_super from public.profiles p
   where p.id = v_uid and not coalesce(p.is_blocked, false) for update;
  if not found then
    raise exception 'account blocked';
  end if;
  if not public._secret_box_open_for(v_uid) then
    raise exception 'BOX_CLOSED';
  end if;
  if v_coins < v_price then
    raise exception 'not enough coins';
  end if;

  v_tier := public._secret_box_roll();
  -- 25.11.2026: каждый четвёртый приз в группе — монеты.
  if random() < 0.25 then
    v_prize_coins := public._secret_box_coin_prize(v_tier);
    update public.profiles set coins = coins - v_price + v_prize_coins where id = v_uid;
    insert into public.secret_box_opens (user_id, item_id, tier, price, refund, coins) values (v_uid, null, v_tier, v_price, 0, v_prize_coins);
    insert into public.coin_transactions (user_id, amount, reason, label) values (v_uid, -v_price, 'secret_box', 'Секретный бокс: монеты');
    insert into public.coin_transactions (user_id, amount, reason, label) values (v_uid, v_prize_coins, 'secret_box_coins', 'Секретный бокс: монеты');
    return jsonb_build_object('item_id', null, 'tier', v_tier, 'name', null, 'duplicate', false, 'refund', 0, 'coins', v_prize_coins);
  end if;

  select s.id, s.name, s.price into v_item, v_name, v_item_price from public.shop_items s
   where s.purchasable and s.price > 0 and (s.released or v_super) and public._secret_box_tier(s.price) = v_tier
   order by random() limit 1;
  if v_item is null then
    -- В группе нет ни одной вещи (каталог поменяли): любая вещь магазина.
    select s.id, s.name, s.price into v_item, v_name, v_item_price from public.shop_items s
     where s.purchasable and s.price > 0 and (s.released or v_super)
     order by random() limit 1;
    if v_item is null then
      raise exception 'BOX_EMPTY';
    end if;
    v_tier := public._secret_box_tier(v_item_price);
  end if;

  v_dup := exists (select 1 from public.user_inventory i where i.user_id = v_uid and i.item_id = v_item);
  if v_dup then
    v_refund := (v_item_price / 20) * 10;
  end if;

  update public.profiles set coins = coins - v_price + v_refund where id = v_uid;
  insert into public.secret_box_opens (user_id, item_id, tier, price, refund) values (v_uid, v_item, v_tier, v_price, v_refund);
  insert into public.coin_transactions (user_id, amount, reason, label) values (v_uid, -v_price, 'secret_box', 'Секретный бокс: ' || v_name);
  if v_dup then
    insert into public.coin_transactions (user_id, amount, reason, label) values (v_uid, v_refund, 'secret_box_refund', 'Секретный бокс: повтор ' || v_name);
  else
    insert into public.user_inventory (user_id, item_id) values (v_uid, v_item);
  end if;
  return jsonb_build_object('item_id', v_item, 'tier', v_tier, 'name', v_name, 'duplicate', v_dup, 'refund', v_refund, 'coins', 0);
end;
$function$;
revoke all on function public.open_secret_box() from public, anon;
grant execute on function public.open_secret_box() to authenticated;

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
    v_frame := public._city_frame(public._profile_city(v_uid));
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
$function$;
revoke all on function public.spin_slots() from public, anon;
grant execute on function public.spin_slots() to authenticated;

drop table if exists public.secret_box_free;
$rb9$;
  out := out || E'\nrollback: fns same=' || (md5(pg_get_functiondef('public.open_secret_box()'::regprocedure) || pg_get_functiondef('public.spin_slots()'::regprocedure) || pg_get_functiondef('public.get_secret_box_state()'::regprocedure)) = h_before)
    || ' table gone=' || (to_regclass('public.secret_box_free') is null);
  raise exception 'DRYRUN: %', out;
end $dry$;
