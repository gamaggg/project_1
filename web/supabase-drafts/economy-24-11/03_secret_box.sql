-- Секретный бокс (24.11.2026, вместо «вещи недели»). ЧЕРНОВИК, применять только после «применяй».
--
-- Магазин: бокс открывается сколько угодно раз, каждый раз за 500 монет. Внутри — любая вещь магазина, что продаётся
-- за монеты (рамка, фон, стиль имени, скин сектора; без бесплатных фонов и призов слотов). Группа выпадает по шансам:
--   обычная (цена до 400)      74 %
--   редкая (401–900)           20 %
--   эпическая (901–1 700)       5 %
--   легендарная (от 1 701)      1 %
-- Вещь внутри группы — случайная. Если такая вещь у игрока уже есть, вместо неё — половина её цены монетами
-- (округление вниз до 10). Цена и шансы — в _secret_box_price / _secret_box_roll.
--
-- До выпуска бокс открыт только суперадмину: feature_release('secret_box') = false. Остальным get_secret_box_state()
-- отдаёт null (карточка не видна), open_secret_box() — BOX_CLOSED. Выпуск — 05_release.sql.
-- Здесь же колонка shop_items.released (по умолчанию true): нужна боксу и вещам из 04, которые до выпуска скрыты.

alter table public.shop_items add column if not exists released boolean not null default true;

create table if not exists public.feature_release (
  key text primary key,
  released boolean not null default false,
  released_at timestamptz
);
alter table public.feature_release enable row level security;
revoke all on table public.feature_release from public, anon, authenticated;
insert into public.feature_release (key, released) values ('secret_box', false) on conflict (key) do nothing;

create table if not exists public.secret_box_opens (
  id bigserial primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  item_id text not null references public.shop_items(id),
  tier smallint not null check (tier between 1 and 4),
  price int not null,
  refund int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists secret_box_opens_user_idx on public.secret_box_opens (user_id, created_at desc);
alter table public.secret_box_opens enable row level security;
revoke all on table public.secret_box_opens from public, anon, authenticated;
revoke all on sequence public.secret_box_opens_id_seq from public, anon, authenticated;

create or replace function public._secret_box_price() returns int language sql immutable as $$ select 500 $$;

-- Группа вещи по цене.
create or replace function public._secret_box_tier(p_price int) returns int language sql immutable as $$
  select case when p_price <= 400 then 1 when p_price <= 900 then 2 when p_price <= 1700 then 3 else 4 end
$$;

-- Выпавшая группа по шансам 74 / 20 / 5 / 1.
create or replace function public._secret_box_roll() returns int language sql volatile as $$
  select case when r < 0.74 then 1 when r < 0.94 then 2 when r < 0.99 then 3 else 4 end from (select random() as r) x
$$;

-- Суперадмин? (до выпуска только он видит бокс и новинки)
create or replace function public._is_super_admin(p_uid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select p.is_super_admin from public.profiles p where p.id = p_uid), false)
$$;

-- Бокс открыт этому игроку: выпущен для всех или игрок — суперадмин.
create or replace function public._secret_box_open_for(p_uid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select f.released from public.feature_release f where f.key = 'secret_box'), false)
      or public._is_super_admin(p_uid)
$$;
revoke all on function public._secret_box_price() from public, anon, authenticated;
revoke all on function public._secret_box_tier(int) from public, anon, authenticated;
revoke all on function public._secret_box_roll() from public, anon, authenticated;
revoke all on function public._is_super_admin(uuid) from public, anon, authenticated;
revoke all on function public._secret_box_open_for(uuid) from public, anon, authenticated;

-- Что показать на карточке бокса: цена. null — бокса для игрока нет (ещё не выпущен).
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
