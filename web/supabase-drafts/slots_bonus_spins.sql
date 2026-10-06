-- Большое обновление: подарочные прокруты слотов от супер-админа + джекпот 0,1% (решение 06.10).
-- Подарочные прокруты копятся отдельно (slot_bonus_spins), не сгорают в конце дня и тратятся
-- только когда обычные (1 в день + по одному за улов, до 4) закончились. Такой прокрут помечается
-- в slot_spins.bonus и не считается в дневной лимит — иначе уловы позже в тот же день не дали бы
-- обычных прокрутов.
-- Джекпот (3 катрана / 3 сома): 0,5% → 0,1%, остальные шансы прежние; разница ушла в «мимо».
-- Подпись в истории монет за 3 луфаря/щуки — нейтральная «Слоты: 100 монет» (в Москве там щука).
-- Слоты пока только в большом обновлении — текущий прод эти функции не вызывает.

create table public.slot_bonus_spins (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  spins int not null default 0 check (spins >= 0)
);
alter table public.slot_bonus_spins enable row level security;
revoke all on public.slot_bonus_spins from public, anon, authenticated;
grant all on public.slot_bonus_spins to service_role;

alter table public.slot_spins add column bonus boolean not null default false;

create or replace function public._slot_day_state(p_uid uuid)
 returns table(total integer, used integer, day_start timestamp with time zone, next_reset timestamp with time zone)
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  with d as (
    select (date_trunc('day', now() at time zone public._city_tz(public._profile_city(p_uid))) at time zone public._city_tz(public._profile_city(p_uid))) as day_start
  )
  select
    least(4, 1 + (select count(*) from public.catches c where c.user_id = p_uid and c.caught_at >= d.day_start))::int,
    (select count(*) from public.slot_spins s where s.user_id = p_uid and s.created_at >= d.day_start and not s.bonus)::int,
    d.day_start,
    d.day_start + interval '1 day'
  from d;
$function$;

-- left = обычные оставшиеся + подарочные; bonus — сколько из них подарочных.
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

-- Супер-админ: сколько прокрутов у игрока сейчас (обычных на сегодня и подарочных).
create function public.admin_slot_spins(p_user_id uuid)
 returns jsonb
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
declare
  v record;
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and is_super_admin) then
    raise exception 'not authorized';
  end if;
  select * into v from public._slot_day_state(p_user_id);
  return jsonb_build_object(
    'daily_left', greatest(v.total - v.used, 0),
    'daily_total', v.total,
    'bonus', coalesce((select b.spins from public.slot_bonus_spins b where b.user_id = p_user_id), 0)
  );
end;
$function$;
revoke all on function public.admin_slot_spins(uuid) from public, anon;
grant execute on function public.admin_slot_spins(uuid) to authenticated;

-- Супер-админ: добавить (или убрать, отрицательным числом) подарочные прокруты — себе или игроку.
-- Не больше 100 за раз; ниже нуля не уходит. Пишется в журнал админа.
create function public.admin_grant_spins(p_user_id uuid, p_amount integer)
 returns integer
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_name text;
  v_new int;
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and is_super_admin) then
    raise exception 'not authorized';
  end if;
  if p_amount is null or p_amount = 0 or abs(p_amount) > 100 then
    raise exception 'SPINS:amount';
  end if;
  select display_name into v_name from public.profiles where id = p_user_id;
  if not found then raise exception 'user not found'; end if;

  insert into public.slot_bonus_spins as b (user_id, spins) values (p_user_id, greatest(0, p_amount))
  on conflict (user_id) do update set spins = greatest(0, b.spins + p_amount)
  returning b.spins into v_new;

  insert into public.admin_actions (admin_id, action, target_user_id, details)
  values (
    auth.uid(), 'grant_spins', p_user_id,
    (case when p_amount > 0 then 'Добавил ' || p_amount else 'Убрал ' || abs(p_amount) end) || ' прокрутов слотов: ' || v_name
  );
  return v_new;
end;
$function$;
revoke all on function public.admin_grant_spins(uuid, integer) from public, anon;
grant execute on function public.admin_grant_spins(uuid, integer) to authenticated;
