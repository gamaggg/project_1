-- ПРОГОН 01_rare_wins.sql в откатываемой транзакции: ничего не остаётся, в конце raise exception с результатом.
do $dry$
declare
  out text := '';
  v_u uuid;
  v_spin bigint;
  r record;
begin
  execute $mig$
-- Крупные выигрыши (27.11.2026). ЧЕРНОВИК, применять только после «применяй». Откат: 01_rare_wins_ROLLBACK.sql.
--
-- Владелец: «почему в истории не написан момент, когда он выбил в слотах рамку» и «когда кто-то выбивает
-- в слотах рамку, 3 ключа для бокса или в боксе что-то легендарное, мне в бот приходит уведомление».
--
-- 1. История: джекпот с рамкой даёт 0 монет, поэтому строки в coin_transactions не было. Теперь пишется строка
--    на 0 монет «Слоты: джекпот, рамка «Катран»» (reason slots_jackpot). Прошлые 10 джекпотов дописываются задним
--    числом, время то же, что у прокрута.
-- 2. Уведомление суперадминам (в приложении и в Telegram) через _system_alert, variant = 'rare_win':
--    слоты: джекпот (рамка или 300 монет, если рамка уже была), 3 ключа (бесплатный бокс);
--    секретный бокс: легендарный уровень (tier 4, шанс 2 %), вещь или 2 500 монет.
--    Ключ уникален на событие (rare_win:slot:<id>, rare_win:box:<id>), часовая склейка _system_alert не мешает.
--
-- Сделано триггерами AFTER INSERT на slot_spins и secret_box_opens: spin_slots и open_secret_box не меняются.
-- Ошибка внутри триггера ловится и не ломает прокрут или открытие бокса.

-- Текст и отправка уведомления.
create or replace function public._rare_win_alert(p_uid uuid, p_what text, p_at timestamptz, p_key text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_name text;
  v_pid text;
  v_city text;
  v_in text;
  v_tz text;
begin
  select coalesce(p.display_name, 'игрок'), p.public_id, p.city into v_name, v_pid, v_city
  from public.profiles p where p.id = p_uid;
  select c.name_in, c.tz into v_in, v_tz from public.city_config c where c.id = coalesce(v_city, 'batumi');
  perform public._system_alert(
    p_key,
    v_name || coalesce(' (' || v_pid || ')', '') || coalesce(' в ' || v_in, '') || E'\n'
      || p_what || E'\n'
      || to_char(p_at at time zone coalesce(v_tz, 'Asia/Tbilisi'), 'DD.MM, HH24:MI') || ' по времени города',
    jsonb_build_object('variant', 'rare_win', 'user_public_id', v_pid)
  );
end;
$function$;

-- «Рамка «Катран»» → «рамка «Катран»» для середины фразы.
create or replace function public._lower_first(p text)
returns text
language sql
immutable
set search_path to 'public'
as $function$ select lower(left(p, 1)) || substr(p, 2) $function$;

-- Слоты: строка в истории для джекпота с рамкой + уведомление.
create or replace function public._slot_spin_rare()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_frame text;
begin
  if new.prize not in ('jackpot', 'jackpot_coins', 'chest') then
    return new;
  end if;

  if new.prize = 'jackpot' then
    -- Рамка легла в инвентарь в том же вызове spin_slots, время у записей одно.
    select s.name into v_frame
    from public.user_inventory i join public.shop_items s on s.id = i.item_id
    where i.user_id = new.user_id and i.purchased_at = new.created_at and s.category = 'avatar_frame'
    limit 1;
    begin
      insert into public.coin_transactions (user_id, amount, reason, label, created_at)
      values (new.user_id, 0, 'slots_jackpot', 'Слоты: джекпот, ' || public._lower_first(coalesce(v_frame, 'рамка')), new.created_at);
    exception when others then
      null;
    end;
  end if;

  begin
    perform public._rare_win_alert(
      new.user_id,
      case new.prize
        when 'jackpot' then '🎰 Слоты: джекпот, ' || public._lower_first(coalesce(v_frame, 'рамка'))
        when 'jackpot_coins' then '🎰 Слоты: джекпот, рамка уже была, +' || new.coins || ' монет'
        else '🗝 Слоты: 3 ключа, бесплатный секретный бокс'
      end,
      new.created_at,
      'rare_win:slot:' || new.id
    );
  exception when others then
    null;
  end;
  return new;
end;
$function$;

-- Секретный бокс: легендарный уровень (tier 4) → уведомление.
create or replace function public._secret_box_open_rare()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_name text;
begin
  if new.tier <> 4 then
    return new;
  end if;
  begin
    if new.item_id is null then
      perform public._rare_win_alert(new.user_id, '🎁 Секретный бокс: легендарный приз, +' || new.coins || ' монет', new.created_at, 'rare_win:box:' || new.id);
    else
      select s.name into v_name from public.shop_items s where s.id = new.item_id;
      perform public._rare_win_alert(
        new.user_id,
        '🎁 Секретный бокс: легендарная вещь, ' || public._lower_first(coalesce(v_name, new.item_id))
          || case when new.refund > 0 then ' (уже была, вернули ' || new.refund || ' монет)' else '' end,
        new.created_at,
        'rare_win:box:' || new.id
      );
    end if;
  exception when others then
    null;
  end;
  return new;
end;
$function$;

-- Служебные функции: только для триггеров, не для клиента.
revoke all on function public._rare_win_alert(uuid, text, timestamptz, text) from public, anon, authenticated;
revoke all on function public._slot_spin_rare() from public, anon, authenticated;
revoke all on function public._secret_box_open_rare() from public, anon, authenticated;

drop trigger if exists slot_spins_rare on public.slot_spins;
create trigger slot_spins_rare after insert on public.slot_spins
  for each row when (new.prize in ('jackpot', 'jackpot_coins', 'chest')) execute function public._slot_spin_rare();

drop trigger if exists secret_box_opens_rare on public.secret_box_opens;
create trigger secret_box_opens_rare after insert on public.secret_box_opens
  for each row when (new.tier = 4) execute function public._secret_box_open_rare();

-- Прошлые джекпоты с рамкой в историю (уведомлений по ним нет).
insert into public.coin_transactions (user_id, amount, reason, label, created_at)
select s.user_id, 0, 'slots_jackpot', 'Слоты: джекпот, ' || public._lower_first(coalesce(si.name, 'рамка')), s.created_at
from public.slot_spins s
left join public.user_inventory i on i.user_id = s.user_id and i.purchased_at = s.created_at
left join public.shop_items si on si.id = i.item_id and si.category = 'avatar_frame'
where s.prize = 'jackpot'
  and not exists (
    select 1 from public.coin_transactions ct
    where ct.user_id = s.user_id and ct.reason = 'slots_jackpot' and ct.created_at = s.created_at
  );
$mig$;
  out := out || 'backfill rows: ' || (select count(*) from public.coin_transactions where reason = 'slots_jackpot') || E'\n';
  out := out || 'primko: ' || coalesce((select label || ' @ ' || created_at from public.coin_transactions where reason = 'slots_jackpot' and user_id = '28af18b6-ec2d-4208-b3f3-3d467b9edddf'), 'НЕТ') || E'\n';
  out := out || 'labels: ' || (select string_agg(distinct label, ' | ') from public.coin_transactions where reason = 'slots_jackpot') || E'\n';
  -- Новый джекпот: игрок без «Сома» получает рамку и прокрут, как в spin_slots.
  select p.id into v_u from public.profiles p
   where not p.is_super_admin and p.public_id is not null
     and not exists (select 1 from public.user_inventory i where i.user_id = p.id and i.item_id = 'frame_som')
   order by p.created_at limit 1;
  insert into public.user_inventory (user_id, item_id) values (v_u, 'frame_som');
  insert into public.slot_spins (user_id, reels, prize, coins, bonus) values (v_u, array['katran','katran','katran'], 'jackpot', 0, false);
  insert into public.slot_spins (user_id, reels, prize, coins, bonus) values (v_u, array['katran','katran','katran'], 'jackpot_coins', 300, false);
  insert into public.slot_spins (user_id, reels, prize, coins, bonus) values (v_u, array['chest','chest','chest'], 'chest', 0, false);
  insert into public.slot_spins (user_id, reels, prize, coins, bonus) values (v_u, array['hex','hex','hex'], 'shield', 0, false);
  insert into public.secret_box_opens (user_id, item_id, tier, price, refund, coins) values (v_u, null, 4, 500, 0, 2500);
  insert into public.secret_box_opens (user_id, item_id, tier, price, refund, coins)
    values (v_u, (select id from public.shop_items where purchasable and price > 1700 limit 1), 4, 0, 1250, 0);
  insert into public.secret_box_opens (user_id, item_id, tier, price, refund, coins) values (v_u, null, 2, 500, 0, 500);
  out := out || 'new jackpot history: ' || coalesce((select string_agg(label || ' ' || amount, ' | ') from public.coin_transactions where user_id = v_u and reason = 'slots_jackpot'), 'НЕТ') || E'\n';
  for r in select n.payload, (select count(*) from public.telegram_outbox o where o.notification_id = n.id) as tg
           from public.notifications n where n.kind = 'system_alert' and n.payload->>'variant' = 'rare_win' order by n.id loop
    out := out || '--- alert (tg outbox ' || r.tg || ', id ' || coalesce(r.payload->>'user_public_id', '?') || '):' || E'\n' || (r.payload->>'text') || E'\n';
  end loop;
  out := out || 'alerts total: ' || (select count(*) from public.notifications n where n.kind = 'system_alert' and n.payload->>'variant' = 'rare_win') || ' (ждём 5: джекпот, джекпот-монеты, ключи, 2 бокса)' || E'\n';
  out := out || 'grants anon/auth on _rare_win_alert: ' || has_function_privilege('anon', 'public._rare_win_alert(uuid, text, timestamptz, text)', 'execute') || '/' || has_function_privilege('authenticated', 'public._rare_win_alert(uuid, text, timestamptz, text)', 'execute');
  raise exception E'DRY RUN OK\n%', out;
end $dry$;
