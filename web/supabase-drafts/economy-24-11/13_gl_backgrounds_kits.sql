-- Платные живые фоны, их рамки, стили имени и комплекты (25.11.2026). ЧЕРНОВИК, применять только после «применяй».
-- Применяется после 03–12. До выпуска (13_release.sql) всё новое видит и покупает только суперадмин.
--
-- Владелец: семь живых фонов (Северное сияние, Градиент, Звёздное небо, Частицы, Лучи, Матрица, Туман) в магазин по
-- 150 ⭐; к каждому своя рамка и свой стиль имени в одном стиле (по 100 ⭐); пресеты фона можно менять до покупки и
-- после; весь комплект (фон + рамка + имя) отдельным пунктом (300 ⭐ вместо 350). Всё только за Звёзды: за монеты не
-- продаётся (purchasable = false), из секретного бокса не выпадает (бокс берёт только purchasable).
--
-- Как хранится пресет: игрок помнит по одному пресету на каждый свой фон (user_gl_presets); тот, что сейчас на профиле,
-- лежит в profiles.hero_bg как «<id фона>~<пресет>» — так его видят все зрители профиля без правок в запросах.
--
-- Заодно чиню найденное: проверка profiles_hero_bg_check знала только старые 26 фонов, поэтому новинки 24.11
-- (snow, fog, floats, sunset) нельзя было надеть — база отвечала нарушением ограничения. Теперь проверка — по виду
-- значения, а не по списку: «слово» или «слово~пресет».

-- ─── 1. Фон на профиле: любое слово, а к живому — ещё «~пресет» ───
alter table public.profiles drop constraint if exists profiles_hero_bg_check;
alter table public.profiles add constraint profiles_hero_bg_check
  check (hero_bg ~ '^[a-z][a-z0-9_-]{0,39}(~[a-z0-9_]{1,24})?$');

-- ─── 2. Вещи магазина: 7 фонов, 7 рамок, 7 имён ───
-- price 3000 — только для вида (карточка «легендарная») и защиты: у вещи с ценой 0 equip_shop_item пускает без покупки.
insert into public.shop_items (id, category, name, price, sort_order, purchasable, released) values
  ('bg_gl_aurora',     'hero_bg',      'Северное сияние', 3000, -40, false, false),
  ('bg_gl_gradient',   'hero_bg',      'Градиент',        3000, -39, false, false),
  ('bg_gl_starfield',  'hero_bg',      'Звёздное небо',   3000, -38, false, false),
  ('bg_gl_particles',  'hero_bg',      'Частицы',         3000, -37, false, false),
  ('bg_gl_beams',      'hero_bg',      'Лучи',            3000, -36, false, false),
  ('bg_gl_matrix',     'hero_bg',      'Матрица',         3000, -35, false, false),
  ('bg_gl_fog',        'hero_bg',      'Туман',           3000, -34, false, false),
  ('frame_gl_aurora',    'avatar_frame', 'Рамка «Сияние»',    3000, -40, false, false),
  ('frame_gl_gradient',  'avatar_frame', 'Рамка «Спектр»',    3000, -39, false, false),
  ('frame_gl_starfield', 'avatar_frame', 'Рамка «Созвездие»', 3000, -38, false, false),
  ('frame_gl_particles', 'avatar_frame', 'Рамка «Искра»',     3000, -37, false, false),
  ('frame_gl_beams',     'avatar_frame', 'Рамка «Луч»',       3000, -36, false, false),
  ('frame_gl_matrix',    'avatar_frame', 'Рамка «Код»',       3000, -35, false, false),
  ('frame_gl_fog',       'avatar_frame', 'Рамка «Дымка»',     3000, -34, false, false),
  ('name_gl_aurora',    'name_style', 'Имя «Сияние»',    3000, -40, false, false),
  ('name_gl_gradient',  'name_style', 'Имя «Спектр»',    3000, -39, false, false),
  ('name_gl_starfield', 'name_style', 'Имя «Созвездие»', 3000, -38, false, false),
  ('name_gl_particles', 'name_style', 'Имя «Искра»',     3000, -37, false, false),
  ('name_gl_beams',     'name_style', 'Имя «Луч»',       3000, -36, false, false),
  ('name_gl_matrix',    'name_style', 'Имя «Код»',       3000, -35, false, false),
  ('name_gl_fog',       'name_style', 'Имя «Дымка»',     3000, -34, false, false)
on conflict (id) do nothing;
insert into public.shop_novelties (id, added_at)
select id, now() from public.shop_items where id like 'bg\_gl\_%' or id like 'frame\_gl\_%' or id like 'name\_gl\_%'
on conflict (id) do nothing;

-- ─── 3. Пресеты фонов игрока ───
create table if not exists public.user_gl_presets (
  user_id uuid not null references public.profiles(id) on delete cascade,
  item_id text not null references public.shop_items(id) on delete cascade,
  preset text not null check (preset ~ '^[a-z0-9_]{1,24}$'),
  updated_at timestamptz not null default now(),
  primary key (user_id, item_id)
);
alter table public.user_gl_presets enable row level security;
revoke all on table public.user_gl_presets from public, anon, authenticated;

-- Пресеты текущего игрока: {"bg_gl_aurora": "borealis", …}.
create or replace function public.get_my_gl_presets()
 returns jsonb
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  return coalesce((select jsonb_object_agg(g.item_id, g.preset) from public.user_gl_presets g where g.user_id = auth.uid()), '{}'::jsonb);
end;
$function$;
revoke all on function public.get_my_gl_presets() from public, anon;
grant execute on function public.get_my_gl_presets() to authenticated;

-- Запомнить пресет купленного фона; p_equip — ещё и поставить этот фон на профиль. Если этот фон уже на профиле,
-- пресет на нём меняется в любом случае.
create or replace function public.set_hero_bg_preset(p_item_id text, p_preset text, p_equip boolean default true)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;
  if p_item_id !~ '^bg_gl_[a-z]+$' or p_preset !~ '^[a-z0-9_]{1,24}$' then
    raise exception 'unknown item';
  end if;
  if not exists (select 1 from public.shop_items where id = p_item_id and category = 'hero_bg') then
    raise exception 'unknown item';
  end if;
  if not exists (select 1 from public.user_inventory where user_id = v_uid and item_id = p_item_id) then
    raise exception 'not owned';
  end if;
  insert into public.user_gl_presets as g (user_id, item_id, preset) values (v_uid, p_item_id, p_preset)
  on conflict (user_id, item_id) do update set preset = excluded.preset, updated_at = now();
  update public.profiles set hero_bg = p_item_id || '~' || p_preset
   where id = v_uid and (p_equip or split_part(hero_bg, '~', 1) = p_item_id);
end;
$function$;
revoke all on function public.set_hero_bg_preset(text, text, boolean) from public, anon;
grant execute on function public.set_hero_bg_preset(text, text, boolean) to authenticated;

-- ─── 4. Возврат вещи суперадмином: с фоном уходит и его пресет на профиле ───
create or replace function public.admin_refund_shop_item(p_user_id uuid, p_item_id text)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare v_price int; v_name text; v_purchasable boolean;
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and is_super_admin) then
    raise exception 'not authorized';
  end if;
  select price, name, purchasable into v_price, v_name, v_purchasable from public.shop_items where id = p_item_id;
  if not found then raise exception 'unknown item'; end if;
  if not exists (select 1 from public.user_inventory where user_id = p_user_id and item_id = p_item_id) then
    raise exception 'not owned';
  end if;
  -- A prize nobody paid for (the jackpot frames) is taken back without coins.
  if not v_purchasable then v_price := 0; end if;

  delete from public.user_inventory where user_id = p_user_id and item_id = p_item_id;
  delete from public.user_gl_presets where user_id = p_user_id and item_id = p_item_id;
  update public.profiles set
    equipped_frame = case when equipped_frame = p_item_id then null else equipped_frame end,
    hero_bg = case when split_part(hero_bg, '~', 1) = p_item_id then 'default' else hero_bg end,
    equipped_name_style = case when equipped_name_style = p_item_id then null else equipped_name_style end,
    equipped_skin = case when equipped_skin = p_item_id then null else equipped_skin end,
    coins = coins + v_price
  where id = p_user_id;

  insert into public.admin_actions (admin_id, action, target_user_id, details)
  values (auth.uid(), 'refund_item', p_user_id,
          case when v_purchasable then 'Вернул покупку «' || v_name || '», +' || v_price || ' монет'
               else 'Забрал «' || v_name || '»' end);
  if v_price > 0 then
    insert into public.coin_transactions (user_id, amount, reason, label) values (p_user_id, v_price, 'admin_refund', v_name);
  end if;
end;
$function$;

-- ─── 5. Покупки за Звёзды: новые вещи и комплекты ───
alter table public.stars_products add column if not exists released boolean not null default true;
alter table public.stars_products add column if not exists title text;
alter table public.stars_products add column if not exists item_ids text[];
alter table public.stars_products drop constraint if exists stars_products_kind_check;
alter table public.stars_products add constraint stars_products_kind_check check (kind in ('coins', 'keys', 'item', 'kit'));
alter table public.stars_orders add column if not exists preset text;

insert into public.stars_products (id, kind, amount, item_id, stars, sort_order, released, title, item_ids) values
  ('bg_gl_aurora',     'item', 0, 'bg_gl_aurora',     150, 31, false, null, null),
  ('bg_gl_gradient',   'item', 0, 'bg_gl_gradient',   150, 32, false, null, null),
  ('bg_gl_starfield',  'item', 0, 'bg_gl_starfield',  150, 33, false, null, null),
  ('bg_gl_particles',  'item', 0, 'bg_gl_particles',  150, 34, false, null, null),
  ('bg_gl_beams',      'item', 0, 'bg_gl_beams',      150, 35, false, null, null),
  ('bg_gl_matrix',     'item', 0, 'bg_gl_matrix',     150, 36, false, null, null),
  ('bg_gl_fog',        'item', 0, 'bg_gl_fog',        150, 37, false, null, null),
  ('frame_gl_aurora',    'item', 0, 'frame_gl_aurora',    100, 41, false, null, null),
  ('frame_gl_gradient',  'item', 0, 'frame_gl_gradient',  100, 42, false, null, null),
  ('frame_gl_starfield', 'item', 0, 'frame_gl_starfield', 100, 43, false, null, null),
  ('frame_gl_particles', 'item', 0, 'frame_gl_particles', 100, 44, false, null, null),
  ('frame_gl_beams',     'item', 0, 'frame_gl_beams',     100, 45, false, null, null),
  ('frame_gl_matrix',    'item', 0, 'frame_gl_matrix',    100, 46, false, null, null),
  ('frame_gl_fog',       'item', 0, 'frame_gl_fog',       100, 47, false, null, null),
  ('name_gl_aurora',    'item', 0, 'name_gl_aurora',    100, 51, false, null, null),
  ('name_gl_gradient',  'item', 0, 'name_gl_gradient',  100, 52, false, null, null),
  ('name_gl_starfield', 'item', 0, 'name_gl_starfield', 100, 53, false, null, null),
  ('name_gl_particles', 'item', 0, 'name_gl_particles', 100, 54, false, null, null),
  ('name_gl_beams',     'item', 0, 'name_gl_beams',     100, 55, false, null, null),
  ('name_gl_matrix',    'item', 0, 'name_gl_matrix',    100, 56, false, null, null),
  ('name_gl_fog',       'item', 0, 'name_gl_fog',       100, 57, false, null, null),
  ('kit_gl_aurora',    'kit', 0, null, 300, 61, false, 'Комплект «Северное сияние»', array['bg_gl_aurora', 'frame_gl_aurora', 'name_gl_aurora']),
  ('kit_gl_gradient',  'kit', 0, null, 300, 62, false, 'Комплект «Градиент»',        array['bg_gl_gradient', 'frame_gl_gradient', 'name_gl_gradient']),
  ('kit_gl_starfield', 'kit', 0, null, 300, 63, false, 'Комплект «Звёздное небо»',   array['bg_gl_starfield', 'frame_gl_starfield', 'name_gl_starfield']),
  ('kit_gl_particles', 'kit', 0, null, 300, 64, false, 'Комплект «Частицы»',         array['bg_gl_particles', 'frame_gl_particles', 'name_gl_particles']),
  ('kit_gl_beams',     'kit', 0, null, 300, 65, false, 'Комплект «Лучи»',            array['bg_gl_beams', 'frame_gl_beams', 'name_gl_beams']),
  ('kit_gl_matrix',    'kit', 0, null, 300, 66, false, 'Комплект «Матрица»',         array['bg_gl_matrix', 'frame_gl_matrix', 'name_gl_matrix']),
  ('kit_gl_fog',       'kit', 0, null, 300, 67, false, 'Комплект «Туман»',           array['bg_gl_fog', 'frame_gl_fog', 'name_gl_fog'])
on conflict (id) do nothing;

-- Что у игрока из вещей товара: сколько штук из скольких (вещь — 1 из 1, комплект — из трёх).
create or replace function public._stars_owned_count(p_uid uuid, p_product text)
 returns int
 language sql
 stable security definer
 set search_path to 'public'
as $$
  select count(*)::int from public.user_inventory i, public.stars_products p
   where p.id = p_product and i.user_id = p_uid
     and i.item_id = any (coalesce(p.item_ids, case when p.item_id is null then array[]::text[] else array[p.item_id] end))
$$;
revoke all on function public._stars_owned_count(uuid, text) from public, anon, authenticated;

-- Витрина: новое — суперадмину до выпуска; у каждого товара owned (всё его уже есть) и owned_any (что-то из него есть).
create or replace function public.get_stars_products()
 returns jsonb
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
declare
  v_uid uuid := auth.uid();
  v_super boolean;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;
  if not public._stars_open_for(v_uid) then
    return '[]'::jsonb;
  end if;
  v_super := public._is_super_admin(v_uid);
  return coalesce((
    select jsonb_agg(jsonb_build_object('id', p.id, 'kind', p.kind, 'amount', p.amount, 'item_id', p.item_id, 'stars', p.stars,
      'owned', (p.item_id is not null or p.item_ids is not null)
               and public._stars_owned_count(v_uid, p.id) >= coalesce(array_length(p.item_ids, 1), 1),
      'owned_any', (p.item_id is not null or p.item_ids is not null) and public._stars_owned_count(v_uid, p.id) > 0)
      order by p.sort_order)
    from public.stars_products p
    where p.active and (p.released or v_super)
  ), '[]'::jsonb);
end;
$function$;
revoke all on function public.get_stars_products() from public, anon;
grant execute on function public.get_stars_products() to authenticated;

-- Заказ: появился p_preset (пресет фона, выбранный до покупки). Старая версия с одним параметром убирается, чтобы
-- вызов не стал неоднозначным.
drop function if exists public.stars_order_create(text);
create or replace function public.stars_order_create(p_product text, p_preset text default null)
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
  select * into v_p from public.stars_products where id = p_product and active and (released or public._is_super_admin(v_uid));
  if not found then
    raise exception 'STARS:unknown';
  end if;
  -- Вещь или комплект, в которых уже что-то есть, не покупаются (остальное — по одной вещи).
  if (v_p.item_id is not null or v_p.item_ids is not null) and public._stars_owned_count(v_uid, v_p.id) > 0 then
    raise exception 'STARS:owned';
  end if;
  if v_p.kind = 'kit' then
    v_item_name := v_p.title;
  elsif v_p.item_id is not null then
    select name into v_item_name from public.shop_items where id = v_p.item_id;
  end if;
  if p_preset is not null and p_preset !~ '^[a-z0-9_]{1,24}$' then
    p_preset := null;
  end if;
  -- Неоплаченные заказы старше суток не нужны (счёт Telegram к тому времени давно закрыт).
  delete from public.stars_orders where user_id = v_uid and status = 'pending' and created_at < now() - interval '1 day';
  if (select count(*) from public.stars_orders where user_id = v_uid and status = 'pending' and created_at > now() - interval '1 hour') >= 30 then
    raise exception 'STARS:too_many';
  end if;
  insert into public.stars_orders (user_id, product_id, stars, preset) values (v_uid, v_p.id, v_p.stars, p_preset) returning id into v_id;
  return jsonb_build_object('order_id', v_id, 'product_id', v_p.id, 'kind', v_p.kind, 'amount', v_p.amount,
    'item_id', v_p.item_id, 'item_name', v_item_name, 'stars', v_p.stars);
end;
$function$;
revoke all on function public.stars_order_create(text, text) from public, anon;
grant execute on function public.stars_order_create(text, text) to authenticated;

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
  if (v_p.item_id is not null or v_p.item_ids is not null) and public._stars_owned_count(v_o.user_id, v_p.id) > 0 then
    return 'owned';
  end if;
  return 'ok';
end;
$function$;
revoke all on function public.stars_precheck(uuid, int) from public, anon, authenticated;
grant execute on function public.stars_precheck(uuid, int) to service_role;

create or replace function public.stars_fulfill(p_order uuid, p_amount int, p_charge_id text, p_provider_charge_id text, p_payer bigint)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_o public.stars_orders;
  v_p public.stars_products;
  v_bg text;
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
  elsif v_p.kind = 'kit' then
    insert into public.user_inventory (user_id, item_id) select v_o.user_id, x from unnest(v_p.item_ids) as x on conflict do nothing;
  else
    insert into public.user_inventory (user_id, item_id) values (v_o.user_id, v_p.item_id) on conflict do nothing;
  end if;

  -- Пресет фона, выбранный до покупки, остаётся за игроком (на профиль фон он ставит сам).
  v_bg := case when v_p.kind = 'kit' then (select x from unnest(v_p.item_ids) as x where x like 'bg\_gl\_%' limit 1)
               when v_p.item_id like 'bg\_gl\_%' then v_p.item_id end;
  if v_bg is not null and v_o.preset is not null then
    insert into public.user_gl_presets as g (user_id, item_id, preset) values (v_o.user_id, v_bg, v_o.preset)
    on conflict (user_id, item_id) do update set preset = excluded.preset, updated_at = now();
  end if;

  update public.stars_orders
     set status = 'paid', paid_at = now(), telegram_charge_id = p_charge_id, provider_charge_id = p_provider_charge_id, payer_telegram_id = p_payer
   where id = v_o.id;
  return jsonb_build_object('already', false, 'user_id', v_o.user_id, 'kind', v_p.kind, 'amount', v_p.amount, 'item_id', v_p.item_id);
end;
$function$;
revoke all on function public.stars_fulfill(uuid, int, text, text, bigint) from public, anon, authenticated;
grant execute on function public.stars_fulfill(uuid, int, text, text, bigint) to service_role;
