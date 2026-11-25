do $dry$
declare
  h_cc text := md5(pg_get_functiondef('public.confirm_catch'::regproc));
  h_st text := md5(pg_get_functiondef('public._settle_clan_week_at(text,timestamptz)'::regprocedure));
  h_us text := md5(pg_get_functiondef('public.use_free_shield(text)'::regprocedure));
  out text;
begin
  execute $sa$-- Щит не даёт забрать сектор, но броню чужой улов снимает (24.11.2026). ЧЕРНОВИК, применять только после «применяй».
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
$sa$;
  execute $e1$-- Щ1 + Щ2 (24.11.2026). ЧЕРНОВИК, применять только после «применяй». Применять ПОСЛЕ shield-armor-24-11/01.
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
$e1$;
  execute $e2$-- Э1 (24.11.2026). ЧЕРНОВИК, применять только после «применяй».
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
$e2$;
  execute $e5$-- Выпуск новинок 24.11 для всех (ЧЕРНОВИК, применять в день выкладки кода, после «применяй»): 16 вещей из 04 и
-- секретный бокс из 03 до этого видны только суперадмину. Отсчёт NEW (90 дней на новинку) — с момента выпуска.
update public.shop_items set released = true
 where id in ('frame_line','frame_coral','frame_scales','frame_storm','snow','fog','floats','sunset',
              'name_sticker','name_neon_sign','name_wave','name_bubbles','skin_ice','skin_lilies','skin_bubbles','skin_whirlpool');
update public.feature_release set released = true, released_at = now() where key = 'secret_box';
-- 11 (25.11.2026): покупки за Звёзды и три скина за Звёзды — вместе с боксом.
update public.shop_items set released = true where id in ('skin_jellyfish', 'skin_lava', 'skin_constellations');
update public.feature_release set released = true, released_at = now() where key = 'stars';
update public.shop_novelties set added_at = now();
$e5$;
  out := 'applied: shield_uses=' || (to_regclass('public.shield_uses') is not null)
    || ' confirm changed=' || (md5(pg_get_functiondef('public.confirm_catch'::regproc)) <> h_cc)
    || ' settle changed=' || (md5(pg_get_functiondef('public._settle_clan_week_at(text,timestamptz)'::regprocedure)) <> h_st)
    || ' shield fn changed=' || (md5(pg_get_functiondef('public.use_free_shield(text)'::regprocedure)) <> h_us)
    || ' box=' || (select released from public.feature_release where key = 'secret_box')
    || ' stars=' || (select released from public.feature_release where key = 'stars')
    || ' hidden items left=' || (select count(*) from public.shop_items where not released);
  execute $r5$-- Откат 05: снова спрятать новинки 24.11 и бокс от всех, кроме суперадмина. Купленное остаётся у игроков.
update public.shop_items set released = false
 where id in ('frame_line','frame_coral','frame_scales','frame_storm','snow','fog','floats','sunset',
              'name_sticker','name_neon_sign','name_wave','name_bubbles','skin_ice','skin_lilies','skin_bubbles','skin_whirlpool');
update public.feature_release set released = false, released_at = null where key = 'secret_box';
update public.shop_items set released = false where id in ('skin_jellyfish', 'skin_lava', 'skin_constellations');
update public.feature_release set released = false, released_at = null where key = 'stars';
$r5$;
  execute $r2$-- Откат 02 (24.11.2026): сундук и битва снова платят без условия улова. Обратные замены по тем же якорям.
do $rollback$
declare
  v_def text := pg_get_functiondef('public._settle_clan_week_at(text,timestamptz)'::regprocedure);
begin
  v_def := replace(v_def, $b$  v_share int;
  -- 24.11.2026 (Э1): поймал ли участник рыбу за неделю; его монеты битвы.
  v_caught boolean;
  v_member_race int;
begin$b$, $a$  v_share int;
begin$a$);
  v_def := replace(v_def, $b$      v_caught := exists (select 1 from public.catches c where c.user_id = m.user_id and c.caught_at >= v_ws and c.caught_at < v_ws + interval '7 days');
      v_member_race := case when v_caught then v_race_coins else 0 end;
$b$, '');
  v_def := replace(v_def, $b$      if v_chest_coins > 0 and m.pts > 0 and v_caught then$b$, $a$      if v_chest_coins > 0 and m.pts > 0 then$a$);
  v_def := replace(v_def, $b$        if v_member_race > 0 then
          update public.profiles set coins = coins + v_member_race * v_mult where id = m.user_id;
          insert into public.coin_transactions (user_id, amount, reason, label)
          values (m.user_id, v_member_race * v_mult, 'clan_race', 'Битва кланов: ' || r.place || '-е место');
          v_race_pool := v_race_pool + v_member_race;
        end if;
        perform public._clan_notify(m.user_id, 'clan_race_result', null, r.id,
          jsonb_build_object('place', r.place, 'finished', r.finished_at is not null, 'coins', v_member_race * v_mult, 'trophies', v_trophies, 'no_catch', not v_caught));$b$,
    $a$        if v_race_coins > 0 then
          update public.profiles set coins = coins + v_race_coins * v_mult where id = m.user_id;
          insert into public.coin_transactions (user_id, amount, reason, label)
          values (m.user_id, v_race_coins * v_mult, 'clan_race', 'Битва кланов: ' || r.place || '-е место');
          v_race_pool := v_race_pool + v_race_coins;
        end if;
        perform public._clan_notify(m.user_id, 'clan_race_result', null, r.id,
          jsonb_build_object('place', r.place, 'finished', r.finished_at is not null, 'coins', v_race_coins * v_mult, 'trophies', v_trophies));$a$);
  if position('v_caught' in v_def) > 0 or position('v_member_race' in v_def) > 0 then
    raise exception '_settle_clan_week_at rollback: leftovers of 02 remain';
  end if;
  execute v_def;
end $rollback$;
$r2$;
  execute $r1$-- Откат 01 (24.11.2026): use_free_shield — как до 24.11 (щит поверх щита +24 ч), Прилив без журнала, таблица убрана.
create or replace function public.use_free_shield(p_territory_id text)
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
  update public.profiles set free_shields = free_shields - 1 where id = v_uid and free_shields > 0;
  if not found then
    raise exception 'no free shields';
  end if;
  update public.territories set shield_until = greatest(coalesce(shield_until, now()), now()) + interval '24 hours' where id = p_territory_id;
end;
$function$;

do $rollback$
declare
  v_def text := pg_get_functiondef('public.confirm_catch(text,text,text,integer,numeric,text,text,timestamptz)'::regprocedure);
begin
  v_def := replace(v_def, $b$
      -- 24.11.2026 (Щ2): журнал постановок щита.
      insert into public.shield_uses (user_id, territory_id, source, shield_until) values (v_uid, p_territory_id, 'tide', now() + interval '48 hours');$b$, '');
  if position('shield_uses' in v_def) > 0 then
    raise exception 'confirm_catch rollback: leftovers of 01 remain';
  end if;
  execute v_def;
end $rollback$;

drop table if exists public.shield_uses;
$r1$;
  execute $rs$-- Откат 01 (24.11.2026): confirm_catch обратно — под щитом чужой улов броню не трогает. Обратные замены по тем же якорям.
do $rollback$
declare
  v_def text := pg_get_functiondef('public.confirm_catch(text,text,text,integer,numeric,text,text,timestamptz)'::regprocedure);
begin
  v_def := replace(v_def, $b$and not v_clan_mate and v_shield_until is not null and v_shield_until > now() and v_def_now = 0);$b$,
                          $a$and not v_clan_mate and v_shield_until is not null and v_shield_until > now());$a$);
  v_def := replace(v_def, $b$     and v_shield_until is not null and v_shield_until > now() and v_def_now = 0 then
    -- 24.11.2026: щит не даёт забрать сектор, но броню (defense) чужой улов под щитом снимает как обычно.
    -- Отказ — только когда брони уже нет.$b$,
                          $a$     and v_shield_until is not null and v_shield_until > now() then$a$);
  v_def := replace(v_def, $b$jsonb_build_object('defense', v_def_after)
        || case when v_shield_until > now() then jsonb_build_object('shield_until', v_shield_until) else '{}'::jsonb end);$b$,
                          $a$jsonb_build_object('defense', v_def_after));$a$);
  if position('v_def_now = 0' in v_def) > 0 or position('shield_until'', v_shield_until' in v_def) > 0 then
    raise exception 'confirm_catch rollback: leftovers of 01 remain';
  end if;
  execute v_def;
end $rollback$;
$rs$;
  out := out || E'\nrolled back: confirm same=' || (md5(pg_get_functiondef('public.confirm_catch'::regproc)) = h_cc)
    || ' settle same=' || (md5(pg_get_functiondef('public._settle_clan_week_at(text,timestamptz)'::regprocedure)) = h_st)
    || ' shield fn same=' || (md5(pg_get_functiondef('public.use_free_shield(text)'::regprocedure)) = h_us)
    || ' shield_uses gone=' || (to_regclass('public.shield_uses') is null)
    || ' box=' || (select released from public.feature_release where key = 'secret_box')
    || ' hidden items=' || (select count(*) from public.shop_items where not released);
  raise exception 'DRYRUN: %', out;
end $dry$;
