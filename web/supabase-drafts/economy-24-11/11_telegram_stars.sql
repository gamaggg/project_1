-- Покупки за Звёзды Telegram (25.11.2026). ЧЕРНОВИК, применять только после «применяй». Применяется после 03–10.
--
-- Владелец: «давай подключим, чтобы за звёзды можно было купить монеты и ключ» + «несколько платных скинов крутых»,
-- цены «сам реши»:
--   монеты   500 — 50 ⭐, 1 500 — 125 ⭐, 5 000 — 350 ⭐
--   ключи    1 — 40 ⭐, 3 — 100 ⭐ (ключ = бесплатное открытие секретного бокса, secret_box_free из 09)
--   скины    «Медузы», «Лава», «Созвездия» — по 150 ⭐; только за Звёзды: за монеты не продаются, из бокса не выпадают
--
-- Как идёт оплата: приложение просит заказ (stars_order_create, под игроком) → сервер делает счёт в Telegram
-- (createInvoiceLink, валюта XTR) → Telegram спрашивает бота «можно?» (stars_precheck) → после оплаты бот получает
-- successful_payment и вызывает stars_fulfill: один раз на заказ, по charge id Telegram.
-- До выпуска всё видно только суперадмину: флаг feature_release('stars'), выпуск — 05_release.sql.

insert into public.feature_release (key, released) values ('stars', false) on conflict (key) do nothing;

-- Скины за Звёзды. price — только для вида (редкость карточки) и защиты: у вещи с ценой 0 equip_shop_item пускает
-- без покупки. purchasable = false: buy_shop_item их не продаёт, open_secret_box их не берёт.
insert into public.shop_items (id, category, name, price, sort_order, purchasable, released) values
  ('skin_jellyfish', 'territory_skin', 'Медузы', 3000, -30, false, false),
  ('skin_lava', 'territory_skin', 'Лава', 3000, -29, false, false),
  ('skin_constellations', 'territory_skin', 'Созвездия', 3000, -28, false, false)
on conflict (id) do nothing;
insert into public.shop_novelties (id, added_at) values ('skin_jellyfish', now()), ('skin_lava', now()), ('skin_constellations', now())
on conflict (id) do nothing;

create table if not exists public.stars_products (
  id text primary key,
  kind text not null check (kind in ('coins', 'keys', 'item')),
  amount int not null default 0,
  item_id text references public.shop_items(id),
  stars int not null check (stars > 0),
  sort_order int not null default 0,
  active boolean not null default true
);
alter table public.stars_products enable row level security;
revoke all on table public.stars_products from public, anon, authenticated;

insert into public.stars_products (id, kind, amount, item_id, stars, sort_order) values
  ('coins_500', 'coins', 500, null, 50, 1),
  ('coins_1500', 'coins', 1500, null, 125, 2),
  ('coins_5000', 'coins', 5000, null, 350, 3),
  ('keys_1', 'keys', 1, null, 40, 11),
  ('keys_3', 'keys', 3, null, 100, 12),
  ('skin_jellyfish', 'item', 0, 'skin_jellyfish', 150, 21),
  ('skin_lava', 'item', 0, 'skin_lava', 150, 22),
  ('skin_constellations', 'item', 0, 'skin_constellations', 150, 23)
on conflict (id) do nothing;

create table if not exists public.stars_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  product_id text not null references public.stars_products(id),
  stars int not null,
  status text not null default 'pending' check (status in ('pending', 'paid')),
  telegram_charge_id text unique,
  provider_charge_id text,
  payer_telegram_id bigint,
  created_at timestamptz not null default now(),
  paid_at timestamptz
);
create index if not exists stars_orders_user_idx on public.stars_orders (user_id, created_at desc);
alter table public.stars_orders enable row level security;
revoke all on table public.stars_orders from public, anon, authenticated;

-- Открыты ли покупки за Звёзды этому игроку (до выпуска — только суперадмину).
create or replace function public._stars_open_for(p_uid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select f.released from public.feature_release f where f.key = 'stars'), false)
      or public._is_super_admin(p_uid)
$$;
revoke all on function public._stars_open_for(uuid) from public, anon, authenticated;

-- Витрина за Звёзды: что можно купить и что из вещей уже есть. Пусто — покупок для игрока нет.
create or replace function public.get_stars_products()
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
  if not public._stars_open_for(v_uid) then
    return '[]'::jsonb;
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('id', p.id, 'kind', p.kind, 'amount', p.amount, 'item_id', p.item_id, 'stars', p.stars,
      'owned', p.item_id is not null and exists (select 1 from public.user_inventory i where i.user_id = v_uid and i.item_id = p.item_id))
      order by p.sort_order)
    from public.stars_products p
    where p.active
  ), '[]'::jsonb);
end;
$function$;
revoke all on function public.get_stars_products() from public, anon;
grant execute on function public.get_stars_products() to authenticated;

-- Заказ под игроком: проверить товар, записать «ждёт оплаты». Сервер по нему делает счёт в Telegram.
create or replace function public.stars_order_create(p_product text)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_uid uuid := auth.uid();
  v_p public.stars_products;
  v_item_name text;
  v_id uuid;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;
  if not exists (select 1 from public.profiles where id = v_uid and not coalesce(is_blocked, false)) then
    raise exception 'account blocked';
  end if;
  if not public._stars_open_for(v_uid) then
    raise exception 'STARS:closed';
  end if;
  select * into v_p from public.stars_products where id = p_product and active;
  if not found then
    raise exception 'STARS:unknown';
  end if;
  if v_p.item_id is not null then
    if exists (select 1 from public.user_inventory where user_id = v_uid and item_id = v_p.item_id) then
      raise exception 'STARS:owned';
    end if;
    select name into v_item_name from public.shop_items where id = v_p.item_id;
  end if;
  -- Неоплаченные заказы старше суток не нужны (счёт Telegram к тому времени давно закрыт).
  delete from public.stars_orders where user_id = v_uid and status = 'pending' and created_at < now() - interval '1 day';
  if (select count(*) from public.stars_orders where user_id = v_uid and status = 'pending' and created_at > now() - interval '1 hour') >= 30 then
    raise exception 'STARS:too_many';
  end if;
  insert into public.stars_orders (user_id, product_id, stars) values (v_uid, v_p.id, v_p.stars) returning id into v_id;
  return jsonb_build_object('order_id', v_id, 'product_id', v_p.id, 'kind', v_p.kind, 'amount', v_p.amount,
    'item_id', v_p.item_id, 'item_name', v_item_name, 'stars', v_p.stars);
end;
$function$;
revoke all on function public.stars_order_create(text) from public, anon;
grant execute on function public.stars_order_create(text) to authenticated;

-- Вопрос Telegram перед оплатой (только сервер бота): заказ ждёт оплаты, сумма та же, вещи ещё нет. 'ok' или причина.
create or replace function public.stars_precheck(p_order uuid, p_amount int)
 returns text
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
declare
  v_o public.stars_orders;
  v_p public.stars_products;
begin
  select * into v_o from public.stars_orders where id = p_order;
  if not found or v_o.status <> 'pending' then
    return 'order';
  end if;
  if v_o.stars <> p_amount then
    return 'amount';
  end if;
  select * into v_p from public.stars_products where id = v_o.product_id;
  if not found or not v_p.active then
    return 'product';
  end if;
  if exists (select 1 from public.profiles where id = v_o.user_id and coalesce(is_blocked, false)) then
    return 'blocked';
  end if;
  if v_p.item_id is not null and exists (select 1 from public.user_inventory where user_id = v_o.user_id and item_id = v_p.item_id) then
    return 'owned';
  end if;
  return 'ok';
end;
$function$;
revoke all on function public.stars_precheck(uuid, int) from public, anon, authenticated;
grant execute on function public.stars_precheck(uuid, int) to service_role;

-- Оплата прошла (только сервер бота): выдать купленное один раз. Повтор того же платежа ничего не добавляет.
create or replace function public.stars_fulfill(p_order uuid, p_amount int, p_charge_id text, p_provider_charge_id text, p_payer bigint)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_o public.stars_orders;
  v_p public.stars_products;
begin
  select * into v_o from public.stars_orders where id = p_order for update;
  if not found then
    raise exception 'STARS:order';
  end if;
  select * into v_p from public.stars_products where id = v_o.product_id;
  if v_o.status = 'paid' then
    return jsonb_build_object('already', true, 'user_id', v_o.user_id, 'kind', v_p.kind, 'amount', v_p.amount, 'item_id', v_p.item_id);
  end if;
  if exists (select 1 from public.stars_orders where telegram_charge_id = p_charge_id) then
    raise exception 'STARS:charge_reused';
  end if;
  if v_o.stars <> p_amount then
    raise exception 'STARS:amount';
  end if;

  if v_p.kind = 'coins' then
    update public.profiles set coins = coins + v_p.amount where id = v_o.user_id;
    insert into public.coin_transactions (user_id, amount, reason, label)
    values (v_o.user_id, v_p.amount, 'stars_purchase', 'Покупка за Звёзды: ' || v_p.amount || ' монет');
  elsif v_p.kind = 'keys' then
    insert into public.secret_box_free as f (user_id, opens) values (v_o.user_id, v_p.amount)
    on conflict (user_id) do update set opens = f.opens + v_p.amount;
  else
    insert into public.user_inventory (user_id, item_id) values (v_o.user_id, v_p.item_id) on conflict do nothing;
  end if;

  update public.stars_orders
     set status = 'paid', paid_at = now(), telegram_charge_id = p_charge_id, provider_charge_id = p_provider_charge_id, payer_telegram_id = p_payer
   where id = v_o.id;
  return jsonb_build_object('already', false, 'user_id', v_o.user_id, 'kind', v_p.kind, 'amount', v_p.amount, 'item_id', v_p.item_id);
end;
$function$;
revoke all on function public.stars_fulfill(uuid, int, text, text, bigint) from public, anon, authenticated;
grant execute on function public.stars_fulfill(uuid, int, text, text, bigint) to service_role;
