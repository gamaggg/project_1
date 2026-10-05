-- РЕЛИЗ: «Улов без сети». confirm_catch получает необязательный p_caught_at — время снимка
-- улова, сделанного без связи и отправленного позже (не старше суток).
-- Сигнатура меняется (+ параметр, + колонка late в результате), поэтому старая функция
-- удаляется и создаётся заново; ВСЕ значения по умолчанию сохранены (см. память про
-- 27.09: потерянные DEFAULT сломали сохранение уловов), права выданы заново.
-- Старый клиент вызывает с 7 именованными аргументами — новая функция их принимает.
--
-- Правила для улова без сети (p_caught_at задан):
--   * время снимка — не раньше чем сутки назад и не позже чем через 2 минуты от сейчас;
--   * кулдаун 2,5 минуты считается по времени снимков (рядом с другими своими уловами);
--   * сектор переходит, только если после снимка там никто другой не ловил и на нём
--     сейчас нет чужого щита; иначе улов засчитывается без захвата (late = true) —
--     монеты за вид даются, захвата и монет за захват нет, улов не теряется.
-- Обычный улов (p_caught_at = null) работает как раньше, кроме двух правил ниже.
--
-- «Защита сектора» (решение 05.10 по отзывам игроков; колонки — sector_defense_columns.sql):
--   * защита 0–3 тает на 1 в сутки от defense_at (считается на лету, как в territories_with_stats);
--   * улов владельца или его соклановца: защита +1 (до 3);
--   * улов чужого при защите > 0 — атака: улов засчитан (монеты за вид), сектор не переходит,
--     защита −1, владельцу уведомление sector_attacked не чаще раза в час на сектор;
--   * при защите 0 чужой улов забирает сектор, защита становится 1;
--   * щит («Щит», «Прилив») работает как раньше — поверх защиты.
-- «+25 за захват» одного и того же сектора — одному игроку не чаще раза в 24 ч (фарм перехватами).
-- В результате ещё attacked (это была атака) и defense (защита сектора после улова).

drop function public.confirm_catch(text, text, text, integer, numeric, text, text);

create function public.confirm_catch(
  p_territory_id text,
  p_species text,
  p_photo_url text,
  p_length_cm integer default null::integer,
  p_weight_kg numeric default null::numeric,
  p_method text default null::text,
  p_bait text default null::text,
  p_caught_at timestamptz default null::timestamptz
)
 returns table(species_coins integer, capture_coins integer, clan_support boolean, late boolean, attacked boolean, defense integer)
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_uid uuid := auth.uid();
  v_prev_owner uuid;
  v_shield_until timestamptz;
  v_catch public.catches;
  v_is_privileged boolean;
  v_is_blocked boolean;
  v_last_catch_at timestamptz;
  v_remaining_seconds integer;
  v_tide_consumed_id bigint;
  v_echo_consumed_id bigint;
  v_capture_coins int := 0;
  v_species_coins int := 0;
  v_multiplier int;
  v_clan_mate boolean := false;
  v_at timestamptz := coalesce(p_caught_at, now());
  v_late boolean := false;
  v_defense smallint;
  v_defense_at timestamptz;
  v_def_now int := 0;
  v_def_after int := 0;
  v_attack boolean := false;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;

  select p.is_blocked, (p.is_admin or p.is_super_admin) into v_is_blocked, v_is_privileged
  from public.profiles p where p.id = v_uid;
  if coalesce(v_is_blocked, false) then
    raise exception 'account blocked';
  end if;

  if p_caught_at is not null and (p_caught_at < now() - interval '24 hours' or p_caught_at > now() + interval '2 minutes') then
    raise exception 'CAUGHT_AT_INVALID';
  end if;

  if not coalesce(v_is_privileged, false) then
    if p_caught_at is null then
      select max(caught_at) into v_last_catch_at from public.catches where user_id = v_uid;
      if v_last_catch_at is not null and now() - v_last_catch_at < interval '2 minutes 30 seconds' then
        v_remaining_seconds := ceil(extract(epoch from (v_last_catch_at + interval '2 minutes 30 seconds' - now())));
        raise exception 'COOLDOWN:%', v_remaining_seconds;
      end if;
    elsif exists (select 1 from public.catches where user_id = v_uid
                  and caught_at > p_caught_at - interval '2 minutes 30 seconds'
                  and caught_at < p_caught_at + interval '2 minutes 30 seconds') then
      raise exception 'COOLDOWN:0';
    end if;
  end if;

  insert into public.territories (id) values (p_territory_id) on conflict (id) do nothing;

  select owner_id, shield_until, t.defense, t.defense_at into v_prev_owner, v_shield_until, v_defense, v_defense_at
  from public.territories t where t.id = p_territory_id and not is_deleted for update;
  if not found then raise exception 'unknown territory %', p_territory_id; end if;
  -- Защита на сейчас: без уловов владельца тает на 1 в сутки.
  if v_prev_owner is not null then
    v_def_now := greatest(0, v_defense - floor(extract(epoch from (now() - coalesce(v_defense_at, now()))) / 86400)::int);
  end if;

  -- Владелец — соклановец по клану города этого сектора: сектор остаётся за ним.
  if v_prev_owner is not null and v_prev_owner <> v_uid then
    select exists (
      select 1 from public.clan_members a
      join public.clan_members b on b.clan_id = a.clan_id and b.left_at is null
      where a.user_id = v_uid and a.left_at is null and b.user_id = v_prev_owner
        and a.city = case when left(p_territory_id, 1) = 'M' then 'moscow' else 'batumi' end
    ) into v_clan_mate;
  end if;

  if p_caught_at is not null then
    -- Улов без сети опоздал: после снимка здесь уже ловил кто-то другой, или сейчас
    -- на секторе чужой щит. Улов сохраняется, но сектор не переходит.
    v_late := exists (select 1 from public.catches c where c.territory_id = p_territory_id and c.user_id <> v_uid and c.caught_at > p_caught_at)
      or (v_prev_owner is not null and v_prev_owner <> v_uid and not v_clan_mate and v_shield_until is not null and v_shield_until > now());
  elsif v_prev_owner is not null and v_prev_owner <> v_uid and not v_clan_mate
     and v_shield_until is not null and v_shield_until > now() then
    -- A sector under an active Щит/Прилив shield can't change hands — only
    -- its current owner (re-confirming, ownership doesn't change) can still
    -- catch there. A clan-mate's catch doesn't change hands either, so it's
    -- allowed through a shield too.
    raise exception 'SHIELDED:%', extract(epoch from v_shield_until)::bigint;
  end if;

  -- Чужой улов на секторе с защитой — атака, а не захват.
  v_attack := not v_late and v_prev_owner is not null and v_prev_owner <> v_uid and not v_clan_mate and v_def_now > 0;

  insert into public.catches (territory_id, user_id, species, length_cm, weight_kg, method, bait, photo_url, caught_at)
  values (p_territory_id, v_uid, p_species, p_length_cm, p_weight_kg, p_method, p_bait, p_photo_url, v_at)
  returning * into v_catch;
  if v_late then
    v_def_after := v_def_now; -- сектор не трогаем
  elsif v_attack then
    v_def_after := v_def_now - 1;
    update public.territories t set defense = v_def_after, defense_at = now() where t.id = p_territory_id;
  elsif not v_clan_mate then
    -- Захват (защита 1) или улов владельца на своём секторе (+1, до 3).
    v_def_after := case when v_prev_owner is distinct from v_uid then 1 else least(3, v_def_now + 1) end;
    update public.territories t set owner_id = v_uid, claimed_at = now(),
      shield_until = case when v_prev_owner is distinct from v_uid then null else shield_until end,
      defense = v_def_after, defense_at = now()
      where t.id = p_territory_id;
  else
    -- Соклановец входит в долю сектора: до 4 владельцев вместе с хозяином.
    -- Пятый просто поддерживает сектор. Защиту укрепляет любой из них.
    insert into public.territory_shares (territory_id, user_id)
    select p_territory_id, v_uid
    where (select count(*) from public.territory_shares s where s.territory_id = p_territory_id) < 3
    on conflict do nothing;
    v_def_after := least(3, v_def_now + 1);
    update public.territories t set defense = v_def_after, defense_at = now() where t.id = p_territory_id;
  end if;
  insert into public.activity_log (user_id, territory_id, kind, catch_id) values (v_uid, p_territory_id, 'catch', v_catch.id);

  v_multiplier := public.coin_multiplier(v_uid);

  -- Every catch pays out by species rarity (see species.coin_value — a flat
  -- table from a real tournament's point scale, x5), whether or not it also
  -- happens to take the sector. Tagged with catch_id so a later moderation
  -- takedown (admin_delete_catch) can look up and reverse exactly what this
  -- specific catch actually paid, instead of re-deriving it (species prices
  -- or the double-coins multiplier could both have changed by then).
  select coin_value into v_species_coins from public.species s where s.key = p_species;
  if v_species_coins is not null then
    v_species_coins := v_species_coins * v_multiplier;
    update public.profiles p set coins = coins + v_species_coins where p.id = v_uid;
    insert into public.coin_transactions (user_id, amount, reason, label, catch_id)
    values (v_uid, v_species_coins, 'catch_reward', coalesce((select s2.name from public.species s2 where s2.key = p_species), p_species), v_catch.id);
  else
    v_species_coins := 0;
  end if;

  if v_attack then
    -- Владельцу — «твой сектор атакуют», не чаще раза в час на сектор.
    if not exists (select 1 from public.notifications n
                   where n.user_id = v_prev_owner and n.kind = 'sector_attacked' and n.territory_id = p_territory_id
                     and n.created_at > now() - interval '1 hour') then
      insert into public.notifications (user_id, kind, actor_id, territory_id, payload)
      values (v_prev_owner, 'sector_attacked', v_uid, p_territory_id, jsonb_build_object('defense', v_def_after));
    end if;
  end if;

  if v_prev_owner is distinct from v_uid and not v_clan_mate and not v_late and not v_attack then
    insert into public.activity_log (user_id, territory_id, kind, catch_id, previous_owner_id)
    values (v_uid, p_territory_id, 'claim', v_catch.id, v_prev_owner);

    -- A fresh capture (not just re-confirming your own sector) consumes an
    -- armed Прилив, if the catcher has one: the sector just taken gets 48h
    -- protection instead of the usual none.
    select ab.id into v_tide_consumed_id from public.active_buffs ab
    where ab.user_id = v_uid and ab.buff_id = 'tide' and ab.consumed = false and ab.expires_at > now()
    order by ab.activated_at limit 1;
    if v_tide_consumed_id is not null then
      update public.active_buffs ab set consumed = true where ab.id = v_tide_consumed_id;
      update public.territories t set shield_until = now() + interval '48 hours' where t.id = p_territory_id;
    end if;

    -- A flat reward for actually taking a sector, also tagged with catch_id
    -- for the same moderation-reversal reason as above. Once a day per
    -- player per sector: two players taking one sector back and forth
    -- farmed it (05.10: 32 of 66 captures within 30 min of the last one).
    if not exists (select 1 from public.coin_transactions ct
                   join public.catches c2 on c2.id = ct.catch_id
                   where ct.user_id = v_uid and ct.reason = 'sector_capture' and c2.territory_id = p_territory_id
                     and ct.created_at > now() - interval '24 hours') then
      v_capture_coins := 25 * v_multiplier;
      update public.profiles p set coins = coins + v_capture_coins where p.id = v_uid;
      insert into public.coin_transactions (user_id, amount, reason, label, catch_id)
      values (v_uid, v_capture_coins, 'sector_capture', 'Захват сектора ' || p_territory_id, v_catch.id);
    end if;
  end if;

  -- Any catch (yours or a fresh capture) can consume an armed Эхо, making
  -- it count double for the count-based challenge metrics.
  select ab.id into v_echo_consumed_id from public.active_buffs ab
  where ab.user_id = v_uid and ab.buff_id = 'echo' and ab.consumed = false and ab.expires_at > now()
  order by ab.activated_at limit 1;
  if v_echo_consumed_id is not null then
    update public.active_buffs ab set consumed = true where ab.id = v_echo_consumed_id;
    update public.catches c set echo = true where c.id = v_catch.id;
  end if;

  return query select v_species_coins, v_capture_coins, v_clan_mate, v_late, v_attack, v_def_after;
end;
$function$;

-- Те же права, что были у старой функции: гость тоже может вызвать (и получает
-- «not authenticated» изнутри — на это смотрит проверка после миграций).
revoke all on function public.confirm_catch(text, text, text, integer, numeric, text, text, timestamptz) from public;
grant execute on function public.confirm_catch(text, text, text, integer, numeric, text, text, timestamptz) to anon, authenticated, service_role;

-- Начальная защита занятых секторов: по уловам владельца и его доли за последние 3 дня
-- (до 3). Брошенные сектора — 0, их, как и раньше, забирает один улов.
update public.territories t set
  defense = least(3, (select count(*) from public.catches c
                      where c.territory_id = t.id and c.caught_at > now() - interval '3 days'
                        and (c.user_id = t.owner_id
                             or exists (select 1 from public.territory_shares s where s.territory_id = t.id and s.user_id = c.user_id)))),
  defense_at = now()
where t.owner_id is not null and not t.is_deleted;
