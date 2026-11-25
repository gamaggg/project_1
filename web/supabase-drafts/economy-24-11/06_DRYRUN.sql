do $dry$
declare
  md5_before text := md5(pg_get_functiondef('public.open_secret_box()'::regprocedure));
  out text := ''; v_super uuid; v_r jsonb; k int; v_c int := 0; v_items int := 0; v_bad int := 0; v_start int; v_end int; v_delta int := 0;
begin
  execute $m6$-- Монеты в секретном боксе (25.11.2026). ЧЕРНОВИК, применять только после «применяй». Применяется после 03 (уже в базе).
--
-- Владелец: «добавим монеты внутрь, несколько номиналов». В каждой группе каждый четвёртый приз — монеты вместо вещи:
--   обычная (74 %)       150 или 250
--   редкая (20 %)        500
--   эпическая (5 %)    1 000
--   легендарная (1 %)  2 500
-- Средняя отдача бокса на нынешнем каталоге ≈ 410 монет за 500 (было ≈ 440 без повторов). Повтор вещи — как было,
-- половина её цены. Монеты боксом не удваиваются (×2 на них не действует).
-- В истории монет: «Секретный бокс: монеты» −500 и +приз (причина secret_box_coins). secret_box_opens.item_id для
-- монет пустой, сумма — в новой колонке coins.

alter table public.secret_box_opens alter column item_id drop not null;
alter table public.secret_box_opens add column if not exists coins int not null default 0;

-- Монетный приз группы.
create or replace function public._secret_box_coin_prize(p_tier int) returns int language sql volatile as $$
  select case p_tier when 1 then (array[150, 250])[1 + floor(random() * 2)::int] when 2 then 500 when 3 then 1000 else 2500 end
$$;
revoke all on function public._secret_box_coin_prize(int) from public, anon, authenticated;

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
$m6$;
  select id into v_super from public.profiles where is_super_admin order by created_at limit 1;
  update public.profiles set coins = 100000 where id = v_super;
  select coins into v_start from public.profiles where id = v_super;
  perform set_config('request.jwt.claims', json_build_object('sub', v_super, 'role','authenticated')::text, true);
  for k in 1..80 loop
    v_r := public.open_secret_box();
    v_delta := v_delta - 500 + (v_r->>'coins')::int + (v_r->>'refund')::int;
    if (v_r->>'coins')::int > 0 then
      v_c := v_c + 1;
      if not ((v_r->>'tier')::int = 1 and (v_r->>'coins')::int in (150,250) or (v_r->>'tier')::int = 2 and (v_r->>'coins')::int = 500
           or (v_r->>'tier')::int = 3 and (v_r->>'coins')::int = 1000 or (v_r->>'tier')::int = 4 and (v_r->>'coins')::int = 2500) then v_bad := v_bad + 1; end if;
    else v_items := v_items + 1; end if;
  end loop;
  select coins into v_end from public.profiles where id = v_super;
  out := '80 opens: coins=' || v_c || ' items=' || v_items || ' wrong amount=' || v_bad || ' balance ok=' || (v_end = v_start + v_delta)
    || ' coin tx=' || (select count(*) from public.coin_transactions where user_id = v_super and reason = 'secret_box_coins')
    || ' opens with null item=' || (select count(*) from public.secret_box_opens where user_id = v_super and item_id is null)
    || ' sample=' || v_r::text;
  execute $rb6$-- Откат 06 (25.11.2026): бокс снова без монетных призов — open_secret_box как в 03. Строки бокса с монетами
-- (item_id пустой) удаляются из журнала боксов, монеты у игроков и строки истории остаются.
-- Открыть бокс: списать цену, выбрать вещь; новая — в инвентарь, повтор — половина её цены монетами; записать.
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
  return jsonb_build_object('item_id', v_item, 'tier', v_tier, 'name', v_name, 'duplicate', v_dup, 'refund', v_refund);
end;
$function$;
revoke all on function public.open_secret_box() from public, anon;
grant execute on function public.open_secret_box() to authenticated;
drop function if exists public._secret_box_coin_prize(int);
delete from public.secret_box_opens where item_id is null;
alter table public.secret_box_opens drop column if exists coins;
alter table public.secret_box_opens alter column item_id set not null;
$rb6$;
  out := out || E'\nrollback: fn same=' || (md5(pg_get_functiondef('public.open_secret_box()'::regprocedure)) = md5_before)
    || ' coins col=' || exists (select 1 from information_schema.columns where table_name='secret_box_opens' and column_name='coins')
    || ' item_id not null=' || (select is_nullable = 'NO' from information_schema.columns where table_name='secret_box_opens' and column_name='item_id')
    || ' prize fn=' || exists (select 1 from pg_proc where proname = '_secret_box_coin_prize');
  raise exception 'DRYRUN: %', out;
end $dry$;