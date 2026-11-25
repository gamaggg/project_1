do $dry$
declare
  md5_buy_before text := md5(pg_get_functiondef('public.buy_shop_item(text)'::regprocedure));
begin
  execute $m0$-- Щит не даёт забрать сектор, но броню чужой улов снимает (24.11.2026). ЧЕРНОВИК, применять только после «применяй».
--
-- Было: пока на чужом секторе стоит щит (из слотов или Прилив), живой улов отказ SHIELDED, улов с моментом
--       снимка (офлайн, «Добавить в дневник») — «опоздавший», броня (territories.defense) не трогается.
-- Стало: при броне > 0 чужой улов под щитом — обычная атака: броня −1, уведомление владельцу, сектор не переходит.
--        Когда брони нет (0), всё как раньше: SHIELDED / «опоздавший», сектор под щитом не забрать.
--        В уведомление sector_attacked под щитом добавляется shield_until — бот пишет «сектор заберут после щита».
--
-- confirm_catch правится по якорям (каждый ровно один раз, иначе ошибка и ничего не меняется).
-- CREATE OR REPLACE из pg_get_functiondef сохраняет DEFAULT у параметров и права (сигнатура та же).
do $migration$
declare
  v_def text := pg_get_functiondef('public.confirm_catch(text,text,text,integer,numeric,text,text,timestamptz)'::regprocedure);
  a_late constant text := $a$and not v_clan_mate and v_shield_until is not null and v_shield_until > now());$a$;
  a_raise constant text := $a$     and v_shield_until is not null and v_shield_until > now() then$a$;
  a_notif constant text := $a$values (v_prev_owner, 'sector_attacked', v_uid, p_territory_id, jsonb_build_object('defense', v_def_after));$a$;
  a text;
begin
  foreach a in array array[a_late, a_raise, a_notif] loop
    if (length(v_def) - length(replace(v_def, a, ''))) / length(a) <> 1 then
      raise exception 'confirm_catch: anchor not found exactly once: %', left(a, 60);
    end if;
  end loop;

  v_def := replace(v_def, a_late, $b$and not v_clan_mate and v_shield_until is not null and v_shield_until > now() and v_def_now = 0);$b$);

  v_def := replace(v_def, a_raise, $b$     and v_shield_until is not null and v_shield_until > now() and v_def_now = 0 then
    -- 24.11.2026: щит не даёт забрать сектор, но броню (defense) чужой улов под щитом снимает как обычно.
    -- Отказ — только когда брони уже нет.$b$);

  v_def := replace(v_def, a_notif, $b$values (v_prev_owner, 'sector_attacked', v_uid, p_territory_id, jsonb_build_object('defense', v_def_after)
        || case when v_shield_until > now() then jsonb_build_object('shield_until', v_shield_until) else '{}'::jsonb end);$b$);

  execute v_def;
end $migration$;
$m0$;
  execute $m1$-- Щ1 + Щ2 (24.11.2026). ЧЕРНОВИК, применять только после «применяй». Применять ПОСЛЕ shield-armor-24-11/01.
--
-- Щ1: щит нельзя ставить поверх щита. Пока на секторе стоит щит (из запаса или Прилив), use_free_shield отказывает
--     SHIELD_ACTIVE, щит остаётся в запасе. Новый щит — ровно 24 часа от момента постановки (было: +24 ч к остатку,
--     три подряд давали 72 часа).
-- Щ2: каждая постановка щита пишется в shield_uses (кто, какой сектор, запас или Прилив, до когда). Игрокам таблица
--     не видна: RLS включён, у anon / authenticated прав нет, пишут только функции (security definer).

create table if not exists public.shield_uses (
  id bigserial primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  territory_id text not null,
  source text not null check (source in ('reserve', 'tide')),
  shield_until timestamptz not null,
  created_at timestamptz not null default now()
);
create index if not exists shield_uses_territory_idx on public.shield_uses (territory_id, created_at desc);
create index if not exists shield_uses_user_idx on public.shield_uses (user_id, created_at desc);
alter table public.shield_uses enable row level security;
revoke all on table public.shield_uses from public, anon, authenticated;
revoke all on sequence public.shield_uses_id_seq from public, anon, authenticated;

-- use_free_shield: сигнатура та же (без DEFAULT), права сохраняются при CREATE OR REPLACE.
create or replace function public.use_free_shield(p_territory_id text)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_uid uuid := auth.uid();
  v_until timestamptz := now() + interval '24 hours';
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;
  if not exists (
    select 1 from public.territories t
    where t.id = p_territory_id and not t.is_deleted
      and (t.owner_id = v_uid
        or exists (select 1 from public.territory_shares s where s.territory_id = t.id and s.user_id = v_uid))
  ) then
    raise exception 'not your sector';
  end if;
  -- Горячий сектор открыт для всех до конца недели: щит на него не ставится.
  if exists (select 1 from public.hot_sectors hs where hs.territory_id = p_territory_id and now() >= hs.starts_at and now() < hs.ends_at) then
    raise exception 'HOT_SECTOR';
  end if;
  -- 20.11: штаб в осаде — щит не поможет (осаду снимает только улов на секторе), а при падении штаба ушёл бы
  -- к захватчику. Не ставим; щит остаётся в запасе.
  if exists (select 1 from public.clan_sieges s where s.territory_id = p_territory_id) then
    raise exception 'HQ_SIEGE';
  end if;
  -- 24.11.2026 (Щ1): щит поверх щита не ставится — сначала пусть кончится этот. Щит остаётся в запасе.
  if exists (select 1 from public.territories t where t.id = p_territory_id and t.shield_until > now()) then
    raise exception 'SHIELD_ACTIVE';
  end if;
  update public.profiles set free_shields = free_shields - 1 where id = v_uid and free_shields > 0;
  if not found then
    raise exception 'no free shields';
  end if;
  update public.territories set shield_until = v_until where id = p_territory_id;
  insert into public.shield_uses (user_id, territory_id, source, shield_until) values (v_uid, p_territory_id, 'reserve', v_until);
end;
$function$;

-- Прилив в confirm_catch: тот же журнал. Правка по якорю (ровно одно вхождение, иначе ошибка и ничего не меняется);
-- CREATE OR REPLACE из pg_get_functiondef сохраняет DEFAULT у параметров.
do $migration$
declare
  v_def text := pg_get_functiondef('public.confirm_catch(text,text,text,integer,numeric,text,text,timestamptz)'::regprocedure);
  a_tide constant text := $a$      update public.territories t set shield_until = now() + interval '48 hours' where t.id = p_territory_id;$a$;
begin
  if (length(v_def) - length(replace(v_def, a_tide, ''))) / length(a_tide) <> 1 then
    raise exception 'confirm_catch: anchor not found exactly once: %', left(a_tide, 60);
  end if;
  v_def := replace(v_def, a_tide, a_tide || $b$
      -- 24.11.2026 (Щ2): журнал постановок щита.
      insert into public.shield_uses (user_id, territory_id, source, shield_until) values (v_uid, p_territory_id, 'tide', now() + interval '48 hours');$b$);
  execute v_def;
end $migration$;
$m1$;
  execute $m2$-- Э1 (24.11.2026). ЧЕРНОВИК, применять только после «применяй».
-- Монеты сундука недели и битвы кланов — только тем, кто за эту неделю поймал хотя бы одну рыбу. Очки и метры клана,
-- трофеи, опыт, медаль победителя и уведомление о битве — как раньше (в уведомлении coins = 0 и no_catch = true).
-- Без улова сундук не платит и уведомления о сундуке нет. Считается при подведении недели (понедельник 00:10 по городу),
-- то есть впервые — за неделю 23–29.11.
-- _settle_clan_week_at правится по якорям (каждый ровно один раз, иначе ошибка и ничего не меняется).
do $migration$
declare
  v_def text := pg_get_functiondef('public._settle_clan_week_at(text,timestamptz)'::regprocedure);
  a_decl constant text := $a$  v_share int;
begin$a$;
  a_mult constant text := $a$      v_mult := public.coin_multiplier(m.user_id);
$a$;
  a_chest constant text := $a$      if v_chest_coins > 0 and m.pts > 0 then$a$;
  a_race constant text := $a$        if v_race_coins > 0 then
          update public.profiles set coins = coins + v_race_coins * v_mult where id = m.user_id;
          insert into public.coin_transactions (user_id, amount, reason, label)
          values (m.user_id, v_race_coins * v_mult, 'clan_race', 'Битва кланов: ' || r.place || '-е место');
          v_race_pool := v_race_pool + v_race_coins;
        end if;
        perform public._clan_notify(m.user_id, 'clan_race_result', null, r.id,
          jsonb_build_object('place', r.place, 'finished', r.finished_at is not null, 'coins', v_race_coins * v_mult, 'trophies', v_trophies));$a$;
  a text;
begin
  foreach a in array array[a_decl, a_mult, a_chest, a_race] loop
    if (length(v_def) - length(replace(v_def, a, ''))) / length(a) <> 1 then
      raise exception '_settle_clan_week_at: anchor not found exactly once: %', left(a, 60);
    end if;
  end loop;

  v_def := replace(v_def, a_decl, $b$  v_share int;
  -- 24.11.2026 (Э1): поймал ли участник рыбу за неделю; его монеты битвы.
  v_caught boolean;
  v_member_race int;
begin$b$);

  v_def := replace(v_def, a_mult, a_mult || $b$      v_caught := exists (select 1 from public.catches c where c.user_id = m.user_id and c.caught_at >= v_ws and c.caught_at < v_ws + interval '7 days');
      v_member_race := case when v_caught then v_race_coins else 0 end;
$b$);

  v_def := replace(v_def, a_chest, $b$      if v_chest_coins > 0 and m.pts > 0 and v_caught then$b$);

  v_def := replace(v_def, a_race, $b$        if v_member_race > 0 then
          update public.profiles set coins = coins + v_member_race * v_mult where id = m.user_id;
          insert into public.coin_transactions (user_id, amount, reason, label)
          values (m.user_id, v_member_race * v_mult, 'clan_race', 'Битва кланов: ' || r.place || '-е место');
          v_race_pool := v_race_pool + v_member_race;
        end if;
        perform public._clan_notify(m.user_id, 'clan_race_result', null, r.id,
          jsonb_build_object('place', r.place, 'finished', r.finished_at is not null, 'coins', v_member_race * v_mult, 'trophies', v_trophies, 'no_catch', not v_caught));$b$);

  execute v_def;
end $migration$;
$m2$;
  execute $m3$-- Секретный бокс (24.11.2026, вместо «вещи недели»). ЧЕРНОВИК, применять только после «применяй».
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
$m3$;
  execute $m4$-- Новинки магазина (24.11.2026). ЧЕРНОВИК, применять только после «применяй». Применять после 03 (секретный бокс):
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
$m4$;
  -- ===== проверки =====
  declare
    out text := '';
    v_sec text; v_owner uuid; v_n int; v_s int; v_r jsonb; v_ws timestamptz; v_city text; v_clan bigint; v_bad int; v_paid int;
    r1 int; r2 int; r3 int; r4 int; v_coins int; v_user uuid; v_super uuid; v_dups int := 0; v_refunds int := 0; v_ok int := 0; k int;
  begin
    -- Щ1/Щ2: владелец сектора без щита ставит щит, второй отказ.
    select t.id, t.owner_id into v_sec, v_owner from public.territories t
     where not t.is_deleted and t.owner_id is not null and (t.shield_until is null or t.shield_until < now())
       and not exists (select 1 from public.hot_sectors hs where hs.territory_id = t.id and now() < hs.ends_at)
       and not exists (select 1 from public.clan_sieges s where s.territory_id = t.id)
     order by t.id limit 1;
    update public.profiles set free_shields = 2 where id = v_owner;
    perform set_config('request.jwt.claims', json_build_object('sub', v_owner, 'role', 'authenticated')::text, true);
    perform public.use_free_shield(v_sec);
    select round(extract(epoch from shield_until - now())/3600) into v_n from public.territories where id = v_sec;
    out := out || 'shield1 hours=' || v_n;
    begin
      perform public.use_free_shield(v_sec);
      out := out || E'\nshield2: NO ERROR (bad)';
    exception when others then out := out || E'\nshield2: ' || sqlerrm; end;
    select free_shields into v_n from public.profiles where id = v_owner;
    select count(*) into v_s from public.shield_uses where territory_id = v_sec;
    out := out || ' reserve_left=' || v_n || ' log_rows=' || v_s;
    out := out || E'\ntide logged in confirm_catch=' || (position('shield_uses' in pg_get_functiondef('public.confirm_catch(text,text,text,integer,numeric,text,text,timestamptz)'::regprocedure)) > 0)
           || ' defaults kept=' || (pg_get_function_arguments('public.confirm_catch(text,text,text,integer,numeric,text,text,timestamptz)'::regprocedure) like '%p_caught_at timestamp with time zone DEFAULT NULL%');

    -- Э1: пересчитать последнюю подведённую неделю одного клана, все получившие монеты должны были ловить.
    select w.clan_id, w.week_start, c.city into v_clan, v_ws, v_city from public.clan_weeks w join public.clans c on c.id = w.clan_id
     where w.settled_at is not null and c.disbanded_at is null and w.chest_tier > 0 order by w.week_start desc, w.chest_points desc limit 1;
    delete from public.clan_weeks where week_start = v_ws and clan_id in (select id from public.clans where city = v_city);
    perform public._settle_clan_week_at(v_city, v_ws);
    select count(*) into v_paid from public.coin_transactions ct where ct.created_at = now() and ct.reason in ('clan_chest','clan_race');
    select count(*) into v_bad from public.coin_transactions ct where ct.created_at = now() and ct.reason in ('clan_chest','clan_race')
      and not exists (select 1 from public.catches k where k.user_id = ct.user_id and k.caught_at >= v_ws and k.caught_at < v_ws + interval '7 days');
    select count(*) into v_n from public.clan_members m where m.left_at is null and m.clan_id in (select id from public.clans where city = v_city)
      and not exists (select 1 from public.catches k where k.user_id = m.user_id and k.caught_at >= v_ws and k.caught_at < v_ws + interval '7 days');
    out := out || E'\nclan week ' || v_city || ' ' || to_char(v_ws, 'DD.MM') || ': paid rows=' || v_paid || ' paid without catch=' || v_bad || ' members without catch=' || v_n;

    -- Бокс до выпуска: игрок не видит ни бокса, ни новинок, купить новинку не может; суперадмин может всё.
    select p.id into v_super from public.profiles p where p.is_super_admin order by p.created_at limit 1;
    select p.id into v_user from public.profiles p where not coalesce(p.is_blocked,false) and not coalesce(p.is_super_admin,false) and p.id <> v_owner order by p.created_at limit 1;
    update public.profiles set coins = 5000 where id in (v_user, v_super);
    perform set_config('request.jwt.claims', json_build_object('sub', v_user, 'role', 'authenticated')::text, true);
    out := out || E'\nplayer box state=' || coalesce(public.get_secret_box_state()::text, 'null');
    begin perform public.open_secret_box(); out := out || ' open: NO ERROR (bad)';
    exception when others then out := out || ' open: ' || sqlerrm; end;
    begin perform public.buy_shop_item('frame_storm'); out := out || ' buy hidden: NO ERROR (bad)';
    exception when others then out := out || ' buy hidden: ' || sqlerrm; end;
    execute 'set local role authenticated';
    select count(*) into v_n from public.shop_items where id like 'frame_storm' or id in ('snow','skin_whirlpool');
    select count(*) into v_s from public.shop_items;
    execute 'reset role';
    out := out || ' sees new=' || v_n || ' sees total=' || v_s;
    execute 'set local role anon';
    select count(*) into v_s from public.shop_items;
    execute 'reset role';
    out := out || ' anon sees total=' || v_s;

    perform set_config('request.jwt.claims', json_build_object('sub', v_super, 'role', 'authenticated')::text, true);
    execute 'set local role authenticated';
    select count(*) into v_n from public.shop_items where not released;
    execute 'reset role';
    out := out || E'\nsuper sees hidden=' || v_n || ' state=' || coalesce(public.get_secret_box_state()::text, 'null');
    v_r := public.open_secret_box();
    select coins into v_coins from public.profiles where id = v_super;
    out := out || E'\nsuper open1: ' || v_r::text || ' coins_after=' || v_coins;
    -- Всё в инвентарь суперадмину: дальше каждый бокс — повтор с возвратом половины цены.
    insert into public.user_inventory (user_id, item_id) select v_super, s.id from public.shop_items s where s.purchasable and s.price > 0 on conflict do nothing;
    update public.profiles set coins = 5000 where id = v_super;
    for k in 1..5 loop
      v_r := public.open_secret_box();
      if (v_r->>'duplicate')::boolean then v_dups := v_dups + 1; v_refunds := v_refunds + (v_r->>'refund')::int; end if;
      if (v_r->>'refund')::int = ((select price from public.shop_items where id = v_r->>'item_id') / 20) * 10 then v_ok := v_ok + 1; end if;
    end loop;
    select coins into v_coins from public.profiles where id = v_super;
    out := out || E'\nsuper 5 repeats: dups=' || v_dups || ' refund_ok=' || v_ok || ' refunds=' || v_refunds || ' coins=' || v_coins || ' expected=' || (5000 - 2500 + v_refunds)
           || ' refund_tx=' || (select count(*) from public.coin_transactions where user_id = v_super and reason = 'secret_box_refund');
    update public.profiles set coins = 100 where id = v_super;
    begin perform public.open_secret_box(); out := out || ' poor: NO ERROR (bad)';
    exception when others then out := out || ' poor: ' || sqlerrm || ' coins=' || (select coins from public.profiles where id = v_super); end;

    -- Выпуск (05): игрок видит бокс и новинки, открывает.
    execute $rel$-- Выпуск новинок 24.11 для всех (ЧЕРНОВИК, применять в день выкладки кода, после «применяй»): 16 вещей из 04 и
-- секретный бокс из 03 до этого видны только суперадмину. Отсчёт NEW (90 дней на новинку) — с момента выпуска.
update public.shop_items set released = true
 where id in ('frame_line','frame_coral','frame_scales','frame_storm','snow','fog','floats','sunset',
              'name_sticker','name_neon_sign','name_wave','name_bubbles','skin_ice','skin_lilies','skin_bubbles','skin_whirlpool');
update public.feature_release set released = true, released_at = now() where key = 'secret_box';
update public.shop_novelties set added_at = now();
$rel$;
    perform set_config('request.jwt.claims', json_build_object('sub', v_user, 'role', 'authenticated')::text, true);
    execute 'set local role authenticated';
    select count(*) into v_n from public.shop_items where id in ('frame_line','frame_coral','frame_scales','frame_storm','snow','fog','floats','sunset','name_sticker','name_neon_sign','name_wave','name_bubbles','skin_ice','skin_lilies','skin_bubbles','skin_whirlpool');
    execute 'reset role';
    v_r := public.open_secret_box();
    out := out || E'\nafter release: player sees new=' || v_n || ' state=' || coalesce(public.get_secret_box_state()::text,'null') || ' open=' || v_r::text
           || ' NEW for player=' || coalesce(array_length(public.shop_new_items(),1),0);

    -- Шансы: 20 000 бросков.
    select count(*) filter (where x=1), count(*) filter (where x=2), count(*) filter (where x=3), count(*) filter (where x=4)
      into r1, r2, r3, r4 from (select public._secret_box_roll() x from generate_series(1, 20000)) g;
    out := out || E'\nroll %: ' || round(r1/200.0,1) || ' / ' || round(r2/200.0,1) || ' / ' || round(r3/200.0,1) || ' / ' || round(r4/200.0,1);

    -- Откаты 05 → 04 → 03: buy_shop_item и политика как были, следов бокса нет.
    execute $rb5$-- Откат 05: снова спрятать новинки 24.11 и бокс от всех, кроме суперадмина. Купленное остаётся у игроков.
update public.shop_items set released = false
 where id in ('frame_line','frame_coral','frame_scales','frame_storm','snow','fog','floats','sunset',
              'name_sticker','name_neon_sign','name_wave','name_bubbles','skin_ice','skin_lilies','skin_bubbles','skin_whirlpool');
update public.feature_release set released = false, released_at = null where key = 'secret_box';
$rb5$;
    delete from public.secret_box_opens;
    delete from public.user_inventory where item_id in ('frame_line','frame_coral','frame_scales','frame_storm','snow','fog','floats','sunset','name_sticker','name_neon_sign','name_wave','name_bubbles','skin_ice','skin_lilies','skin_bubbles','skin_whirlpool');
    execute $rb4$-- Откат 04 (24.11.2026): убрать значок NEW и снять новинки с продажи. Строки shop_items не удаляются, если вещь
-- уже кто-то купил (на неё ссылается user_inventory): тогда она просто перестаёт продаваться.
-- Чтение shop_items и buy_shop_item — как были до 04 (всем всё, без скрытых вещей).
drop policy if exists "shop items are public" on public.shop_items;
create policy "shop items are public" on public.shop_items for select using (true);

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
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  select price, name, purchasable into v_price, v_name, v_purchasable from public.shop_items where id = p_item_id;
  if v_price is null then
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
drop function if exists public._me_super_admin();
drop function if exists public.shop_new_items();
drop table if exists public.shop_novelty_seen;
drop table if exists public.shop_novelties;
update public.shop_items set purchasable = false
 where id in ('frame_line','frame_coral','frame_scales','frame_storm','snow','fog','floats','sunset',
              'name_sticker','name_neon_sign','name_wave','name_bubbles','skin_ice','skin_lilies','skin_bubbles','skin_whirlpool');
delete from public.shop_items s
 where s.id in ('frame_line','frame_coral','frame_scales','frame_storm','snow','fog','floats','sunset',
                'name_sticker','name_neon_sign','name_wave','name_bubbles','skin_ice','skin_lilies','skin_bubbles','skin_whirlpool')
   and not exists (select 1 from public.user_inventory i where i.item_id = s.id)
   and not exists (select 1 from public.secret_box_opens o where o.item_id = s.id);
$rb4$;
    execute $rb3$-- Откат 03 (24.11.2026): убрать секретный бокс. Откатывать после отката 04 (его политика чтения shop_items использует
-- колонку released). Выпавшие вещи остаются в инвентаре, строки coin_transactions — в истории.
drop function if exists public.open_secret_box();
drop function if exists public.get_secret_box_state();
drop function if exists public._secret_box_open_for(uuid);
drop function if exists public._is_super_admin(uuid);
drop function if exists public._secret_box_roll();
drop function if exists public._secret_box_tier(int);
drop function if exists public._secret_box_price();
drop table if exists public.secret_box_opens;
drop table if exists public.feature_release;
alter table public.shop_items drop column if exists released;
$rb3$;
    out := out || E'\nrollback: buy same=' || (md5(pg_get_functiondef('public.buy_shop_item(text)'::regprocedure)) = md5_buy_before)
           || ' policy=' || (select qual from pg_policies where tablename = 'shop_items')
           || ' released col=' || exists (select 1 from information_schema.columns where table_name = 'shop_items' and column_name = 'released')
           || ' box fns=' || (select count(*) from pg_proc where proname like '%secret_box%' or proname in ('_is_super_admin','_me_super_admin'))
           || ' new items left=' || (select count(*) from public.shop_items where id in ('frame_line','skin_whirlpool'));
    raise exception 'DRYRUN RESULT: %', out;
  end;
end $dry$;
