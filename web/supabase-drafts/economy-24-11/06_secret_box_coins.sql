-- Монеты в секретном боксе (25.11.2026). ЧЕРНОВИК, применять только после «применяй». Применяется после 03 (уже в базе).
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
