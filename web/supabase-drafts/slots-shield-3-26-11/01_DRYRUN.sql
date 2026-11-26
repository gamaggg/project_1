-- ПРОГОН 01_slots_shield_3.sql в откатываемой транзакции: ничего не остаётся, в конце raise exception с результатом.
do $dry$
declare
  h_before text := md5(pg_get_functiondef('public.spin_slots()'::regprocedure));
  acl_before text := (select proacl::text from pg_proc where oid = 'public.spin_slots()'::regprocedure);
  out text := ''; v_player uuid; v_r jsonb; k int; n int := 5000; c jsonb := '{}'; v_box boolean;
  v_sh0 int; v_sh1 int; v_full int := 0;
begin
  execute $mig$-- Слоты: щит 5 % → 3 % (26.11.2026). ЧЕРНОВИК, применять только после «применяй». Откат — 01_slots_shield_3_ROLLBACK.sql.
--
-- Владелец: «думаю надо 3% делать шанс… а то чет дохера щитов»; освободившиеся 2 % — в «пару» (10 монет).
--   3 соты (щит в запас) 5 % → 3 %.
--   «Пара» 28,5 % → 30,5 % (без секретного бокса 38 % → 40 %).
--   Остальное как было: джекпот 0,3 %, 3 ключа 1,5 %, ×2 монеты 6 %, 100 монет 4 %, 3 ставриды 14 %,
--   3 скорпены 8 %, «Ассорти» 8 %, мимо ≈ 24,7 %. Все пороги после щита сдвинуты на 0,02 вниз, порог «пары» (0,753) тот же.
-- CREATE OR REPLACE сохраняет права на функцию; сигнатура и ответ прежние, старая сборка приложения не ломается.
CREATE OR REPLACE FUNCTION public.spin_slots()
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

  -- Odds (decided 06.10, «сильно»): jackpot 0,3% · shield 3% · ×2 coins 6% · 100 coins 4% ·
  -- 3 ставриды 25 coins 14% · 3 скорпены a free spin 8% · a pair 10 coins 40% · miss ~24,7%.
  -- With the box (25.11): + 3 сундука a free box 1,5% · «Ассорти» 15 coins 8% · a pair 30,5%.
  -- 26.11.2026: щит 5% → 3%, освободившиеся 2% ушли в «пару» (28,5 → 30,5 %, без бокса 38 → 40 %).
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
  elsif v_r < 0.033 + v_shift then
    v_reels := array['hex', 'hex', 'hex'];
    v_prize := 'shield';
    -- At most 3 shields in reserve: one won on top of a full reserve pays 70 coins.
    if (select free_shields from public.profiles where id = v_uid) >= 3 then
      v_coins := 70;
    else
      update public.profiles set free_shields = free_shields + 1 where id = v_uid;
    end if;
  elsif v_r < 0.093 + v_shift then
    v_reels := array['hook', 'hook', 'hook'];
    v_prize := 'double';
    insert into public.active_buffs (user_id, buff_id, expires_at)
    values (v_uid, 'double_coins', greatest(now(), coalesce((
      select max(expires_at) from public.active_buffs where user_id = v_uid and buff_id = 'double_coins' and expires_at > now()
    ), now())) + interval '24 hours');
  elsif v_r < 0.133 + v_shift then
    v_reels := array['lufar', 'lufar', 'lufar'];
    v_prize := 'lufar';
    v_coins := 100;
  elsif v_r < 0.273 + v_shift then
    v_reels := array['stavrida', 'stavrida', 'stavrida'];
    v_prize := 'triple';
    v_coins := 25;
  elsif v_r < 0.353 + v_shift then
    -- 3 скорпены (3 леща in Moscow): a free spin into the same store as gift
    -- spins — it doesn't burn at midnight and goes after the day's own.
    v_reels := array['skorpena', 'skorpena', 'skorpena'];
    v_prize := 'free_spin';
    insert into public.slot_bonus_spins as b (user_id, spins) values (v_uid, 1)
    on conflict (user_id) do update set spins = b.spins + 1;
    v_bonus := v_bonus + 1;
  elsif v_new and v_r < 0.448 then
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
$mig$;
  out := 'new fn differs=' || (md5(pg_get_functiondef('public.spin_slots()'::regprocedure)) <> h_before)
    || ' grants same=' || ((select proacl::text from pg_proc where oid = 'public.spin_slots()'::regprocedure) is not distinct from acl_before);

  -- Обычный игрок (не суперадмин, не заблокирован), n прокрутов за счёт подарочных.
  select id into v_player from public.profiles where not coalesce(is_super_admin,false) and not coalesce(is_blocked,false) order by created_at limit 1;
  v_box := public._secret_box_open_for(v_player);
  insert into public.slot_bonus_spins as b (user_id, spins) values (v_player, n + 10) on conflict (user_id) do update set spins = b.spins + n + 10;
  update public.profiles set free_shields = 0 where id = v_player;
  perform set_config('request.jwt.claims', json_build_object('sub', v_player, 'role','authenticated')::text, true);
  for k in 1..n loop
    v_r := public.spin_slots();
    c := jsonb_set(c, array[v_r->>'prize'], to_jsonb(coalesce((c->>(v_r->>'prize'))::int, 0) + 1));
    if v_r->>'prize' = 'shield' and (v_r->>'coins')::int = 70 then v_full := v_full + 1; end if;
  end loop;
  out := out || E'\nbox open for player=' || v_box || ', ' || n || ' spins: ' || (
    select string_agg(key || ' ' || round(100.0 * value::text::int / n, 2) || '%', ', ' order by value::text::int desc) from jsonb_each(c))
    || E'\nshield at full reserve -> 70 coins: ' || v_full || ', reserve now=' || (select free_shields from public.profiles where id = v_player);

  execute $rb$-- ОТКАТ 01_slots_shield_3.sql: spin_slots как в живой базе на 26.11.2026 (щит 5 %, пара 28,5 % / 38 %).
CREATE OR REPLACE FUNCTION public.spin_slots()
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
$rb$;
  out := out || E'\nrollback: fn same as live=' || (md5(pg_get_functiondef('public.spin_slots()'::regprocedure)) = h_before)
    || ' grants same=' || ((select proacl::text from pg_proc where oid = 'public.spin_slots()'::regprocedure) is not distinct from acl_before);
  raise exception 'DRYRUN: %', out;
end $dry$;
