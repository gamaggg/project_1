-- Новинки магазина (24.11.2026). ЧЕРНОВИК, применять только после «применяй». Применять после 03 (секретный бокс):
-- колонка shop_items.released создаётся там.
--
-- 1. 16 новых вещей: по 4 рамки, фона, стиля имени и скина сектора; в каждой группе одна дешёвая, две средние,
--    одна дорогая. Вид вещей — в коде (shopItems.ts, heroBackgrounds.ts + PremiumBackgrounds.tsx, nameStyles.ts +
--    StyledName.tsx, territorySkins.ts + public/skins/*.svg + animatedSkins.ts). sort_order отрицательный — новинки
--    в начале своей вкладки.
-- 2. Значок NEW: shop_novelties — что считается новинкой (id вещи или 'secret_box') и когда добавлено;
--    shop_novelty_seen — когда игрок впервые зашёл в приложение после её появления. NEW горит 7 дней от этого
--    момента, у каждого свои: вернулся через месяц — увидит NEW ещё неделю. Новинки старше 90 дней не отмечаются.
--    shop_new_items() — вызывается приложением при входе: отмечает «впервые увидел» и возвращает, что сейчас NEW.
-- 3. До выпуска новинки видит и покупает только суперадмин (released = false): чтение shop_items разрешено строкам
--    released или суперадмину (_me_super_admin), buy_shop_item отказывает в скрытой вещи ('unknown item'), как будто
--    её нет. Выпуск для всех — 05_release.sql.

insert into public.shop_items (id, category, name, price, sort_order, purchasable, released) values
  ('frame_line',       'avatar_frame',   'Рамка «Леска»',             300, -4, true, false),
  ('frame_coral',      'avatar_frame',   'Рамка «Коралл»',            700, -3, true, false),
  ('frame_scales',     'avatar_frame',   'Рамка «Чешуя»',            1100, -2, true, false),
  ('frame_storm',      'avatar_frame',   'Рамка «Шторм»',            1900, -1, true, false),
  ('snow',             'hero_bg',        'Первый снег',               300, -4, true, false),
  ('fog',              'hero_bg',        'Туман над рекой',           700, -3, true, false),
  ('floats',           'hero_bg',        'Ночной клёв',              1100, -2, true, false),
  ('sunset',           'hero_bg',        'Закат на пирсе',           1900, -1, true, false),
  ('name_sticker',     'name_style',     'Имя «Стикер»',              300, -4, true, false),
  ('name_neon_sign',   'name_style',     'Имя «Неоновая вывеска»',    700, -3, true, false),
  ('name_wave',        'name_style',     'Имя «Волна»',              1100, -2, true, false),
  ('name_bubbles',     'name_style',     'Имя «Пузырьки»',           1800, -1, true, false),
  ('skin_ice',         'territory_skin', 'Лёд',                       300, -4, true, false),
  ('skin_lilies',      'territory_skin', 'Кувшинки',                  600, -3, true, false),
  ('skin_bubbles',     'territory_skin', 'Пузыри',                    900, -2, true, false),
  ('skin_whirlpool',   'territory_skin', 'Водоворот',                2000, -1, true, false)
on conflict (id) do nothing;

create table if not exists public.shop_novelties (
  id text primary key,
  added_at timestamptz not null default now()
);
create table if not exists public.shop_novelty_seen (
  user_id uuid not null references public.profiles(id) on delete cascade,
  novelty_id text not null references public.shop_novelties(id) on delete cascade,
  first_seen_at timestamptz not null default now(),
  primary key (user_id, novelty_id)
);
alter table public.shop_novelties enable row level security;
alter table public.shop_novelty_seen enable row level security;
revoke all on table public.shop_novelties from public, anon, authenticated;
revoke all on table public.shop_novelty_seen from public, anon, authenticated;

insert into public.shop_novelties (id) values
  ('secret_box'),
  ('frame_line'), ('frame_coral'), ('frame_scales'), ('frame_storm'),
  ('snow'), ('fog'), ('floats'), ('sunset'),
  ('name_sticker'), ('name_neon_sign'), ('name_wave'), ('name_bubbles'),
  ('skin_ice'), ('skin_lilies'), ('skin_bubbles'), ('skin_whirlpool')
on conflict (id) do nothing;

create or replace function public.shop_new_items()
 returns text[]
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    return array[]::text[];
  end if;
  insert into public.shop_novelty_seen (user_id, novelty_id)
  select v_uid, n.id from public.shop_novelties n
   where n.added_at > now() - interval '90 days'
  on conflict do nothing;
  return array(
    select s.novelty_id from public.shop_novelty_seen s
     join public.shop_novelties n on n.id = s.novelty_id
     where s.user_id = v_uid and s.first_seen_at > now() - interval '7 days' and n.added_at > now() - interval '90 days'
     order by s.novelty_id
  );
end;
$function$;
revoke all on function public.shop_new_items() from public, anon;
grant execute on function public.shop_new_items() to authenticated;

-- Вызывающий — суперадмин? Без аргументов: про других ничего не выдаёт, поэтому доступна всем (нужна политике чтения).
create or replace function public._me_super_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select p.is_super_admin from public.profiles p where p.id = auth.uid()), false)
$$;
revoke all on function public._me_super_admin() from public;
grant execute on function public._me_super_admin() to anon, authenticated;

drop policy if exists "shop items are public" on public.shop_items;
create policy "shop items are public" on public.shop_items for select using (released or (select public._me_super_admin()));

-- Покупка: скрытая (не выпущенная) вещь — только суперадмину; остальным «unknown item», как будто её нет.
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
  v_purchasable boolean;
  v_released boolean;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  select price, name, purchasable, released into v_price, v_name, v_purchasable, v_released from public.shop_items where id = p_item_id;
  if v_price is null or (not v_released and not public._me_super_admin()) then
    raise exception 'unknown item';
  end if;
  if not v_purchasable then
    raise exception 'not for sale';
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
