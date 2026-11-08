-- 05 · Челленджи недели для одиночной игры на новой клановой механике (решение владельца 07.11.2026).
-- ЧЕРНОВИК. Применять только после «применяй» и только после 01 → 02 → 03 (нужны clan_treasury_log, clan_buffs,
-- clan_buff_rsvp, clan_hq и выплата 'clan_siege_break'). Перед применением прогнать 01+02+03+05 одним запросом
-- в откатываемой транзакции (DO … raise exception).
--
-- Что делает:
--  1. _challenge_progress_new: девять новых метрик (добавляются перед последним «end if», подпись и DEFAULT не меняются).
--  2. _challenge_eligible: новые челленджи выпадают только игрокам в клане; «Иду!» и «Двойной улов» — только если
--     у клана был «Выход» за последние 14 дней; «Казначей» (личная казна убрана) больше не выпадает никому.
--  3. Девять строк в public.challenges. «Казначей» остаётся в таблице (на него ссылаются прошлые недели), но не выпадает.

-- 1. Прогресс.
do $migration$
declare
  v_def text;
  v_anchor constant text := E'  end if;\n\n  return coalesce(v_result, 0);';
  v_count int;
begin
  v_def := pg_get_functiondef('public._challenge_progress_new(uuid,text,jsonb,timestamptz,timestamptz,text,text)'::regprocedure);
  v_count := (length(v_def) - length(replace(v_def, v_anchor, ''))) / length(v_anchor);
  if v_count <> 1 then
    raise exception '_challenge_progress_new: anchor found % times, expected 1', v_count;
  end if;
  if position('clan_deposit' in v_def) > 0 then
    raise exception '_challenge_progress_new already has the clan metrics';
  end if;
  v_def := replace(v_def, v_anchor, $add$
  -- Клановые челленджи (05_clan_challenges.sql).
  elsif p_metric = 'clan_deposit' then
    select count(*) into v_result from public.clan_treasury_log
    where user_id = p_user_id and kind = 'donation' and created_at >= p_week_start and created_at < p_week_end;

  elsif p_metric = 'buff_rsvp' then
    select count(*) into v_result from public.clan_buff_rsvp
    where user_id = p_user_id and created_at >= p_week_start and created_at < p_week_end;

  elsif p_metric = 'catch_clan_shared' then
    select count(*) into v_result from public.catches c
    where c.user_id = p_user_id and c.caught_at >= p_week_start and c.caught_at < p_week_end
      and c.territory_id like p_city_prefix || '%'
      and exists (
        select 1 from public.clan_members me
        join public.clan_members mate on mate.clan_id = me.clan_id and mate.left_at is null and mate.user_id <> p_user_id
        where me.user_id = p_user_id and me.left_at is null
          and (exists (select 1 from public.territory_shares s where s.territory_id = c.territory_id and s.user_id = mate.user_id)
               or exists (select 1 from public.territories t where t.id = c.territory_id and t.owner_id = mate.user_id))
      );

  elsif p_metric = 'catch_in_buff' then
    select count(*) into v_result from public.catches c
    where c.user_id = p_user_id and c.caught_at >= p_week_start and c.caught_at < p_week_end
      and exists (
        select 1 from public.clan_buffs b join public.clan_buff_rsvp r on r.buff_id = b.id and r.user_id = p_user_id
        where c.caught_at >= b.starts_at and c.caught_at < b.ends_at
      );

  elsif p_metric = 'catch_hq_sector' then
    select count(*) into v_result from public.catches c
    where c.user_id = p_user_id and c.caught_at >= p_week_start and c.caught_at < p_week_end
      and exists (
        select 1 from public.clan_hq h join public.clan_members me on me.clan_id = h.clan_id and me.user_id = p_user_id and me.left_at is null
        where h.territory_id = c.territory_id
      );

  elsif p_metric = 'clan_catches' then
    select count(*) into v_result from public.catches c
    where c.user_id = p_user_id and c.caught_at >= p_week_start and c.caught_at < p_week_end
      and c.territory_id like p_city_prefix || '%'
      and exists (select 1 from public.clan_members me where me.user_id = p_user_id and me.left_at is null and me.joined_at <= c.caught_at);

  elsif p_metric = 'siege_broken' then
    select count(*) into v_result from public.coin_transactions
    where user_id = p_user_id and reason = 'clan_siege_break' and created_at >= p_week_start and created_at < p_week_end;

  elsif p_metric = 'catch_enemy_hq' then
    select count(*) into v_result from public.catches c
    where c.user_id = p_user_id and c.caught_at >= p_week_start and c.caught_at < p_week_end
      and exists (
        select 1 from public.clan_hq h
        where h.territory_id = c.territory_id and h.placed_at <= c.caught_at
          and not exists (select 1 from public.clan_members me where me.user_id = p_user_id and me.left_at is null and me.clan_id = h.clan_id)
      );

  elsif p_metric = 'clan_recruit' then
    select count(distinct m.user_id) into v_result
    from public.clan_invites i
    join public.clan_members m on m.user_id = i.user_id and m.clan_id = i.clan_id and m.left_at is null
    where i.invited_by = p_user_id and m.joined_at >= p_week_start and m.joined_at < p_week_end
      and exists (select 1 from public.catches c where c.user_id = m.user_id and c.caught_at >= m.joined_at and c.caught_at < p_week_end);
  end if;

  return coalesce(v_result, 0);$add$);
  execute v_def;
end
$migration$;

-- 2. Кому выпадает. plpgsql: тело не проверяется при создании (таблицы из 02 должны быть к моменту вызова).
create or replace function public._challenge_eligible(p_uid uuid, p_metric text)
 returns boolean
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
begin
  -- One branch per group, so a query only meets its own tables when that metric is asked about.
  if p_metric = 'clan_messages_sent' then
    return exists (select 1 from public.clan_members m where m.user_id = p_uid and m.left_at is null);
  elsif p_metric in ('geo_correct', 'geo_days') then
    return exists (select 1 from public.geo_panoramas g where g.city = public._profile_city(p_uid) and g.status = 'approved');
  elsif p_metric = 'catch_hot_sector' then
    return exists (select 1 from public.hot_sectors h where h.city = public._profile_city(p_uid));
  -- Личной казны больше нет: «Казначей» не выпадает.
  -- Пока общак выключен (скрытый запуск), Казна ещё работает и «Казначей» выпадает как раньше.
  elsif p_metric = 'treasury_collected' then
    return not coalesce((select e.enabled from public.clan_economy e where e.id = 1), false);
  -- «Иду!» и «Двойной улов»: игрок в клане, и клан устраивал «Выход» за последние 14 дней.
  elsif p_metric in ('buff_rsvp', 'catch_in_buff') then
    return exists (
      select 1 from public.clan_members m join public.clan_buffs b on b.clan_id = m.clan_id
      where m.user_id = p_uid and m.left_at is null and b.starts_at > now() - interval '14 days' and public._clan_econ_on(m.clan_id)
    );
  -- Остальные клановые: только игрокам в клане.
  -- Клановые челленджи выпадают только при включённом общаке (до этого их нечем выполнить).
  elsif p_metric in ('clan_deposit', 'catch_clan_shared', 'catch_hq_sector', 'clan_catches', 'siege_broken', 'catch_enemy_hq', 'clan_recruit') then
    return exists (select 1 from public.clan_members m where m.user_id = p_uid and m.left_at is null and public._clan_econ_on(m.clan_id));
  end if;
  return true;
end;
$function$;

-- 3. Сами челленджи (награды в тех же вилках, что у существующих: soft 10–20, light 20–30, medium 40–60, hard 80–150).
insert into public.challenges (id, tier, name, description, metric, target, params, coin_reward, city_scope, sort_order) values
  ('vznos',          'soft',   'Взнос',           'Внеси любую сумму в общак своего клана',                            'clan_deposit',      1, '{}', 15,  null, 50),
  ('idu',            'light',  'Иду!',            'Отметь «иду» на выход клана',                                       'buff_rsvp',         1, '{}', 20,  null, 51),
  ('plechom',        'light',  'Плечом к плечу',  'Поймай рыбу на секторе, который держишь вместе с соклановцем',      'catch_clan_shared', 1, '{}', 25,  null, 52),
  ('dvoynoy_ulov',   'medium', 'Двойной улов',    'Поймай рыбу во время выхода клана (×2)',                            'catch_in_buff',     1, '{}', 50,  null, 53),
  ('strazh_shtaba',  'medium', 'Страж штаба',     'Улов на секторе со штабом своего клана: штабу +1 к защите',         'catch_hq_sector',   1, '{}', 45,  null, 54),
  ('za_klan',        'medium', 'За клан',         'Три улова за неделю, пока ты в клане: они идут в задание недели',   'clan_catches',      3, '{}', 50,  null, 55),
  ('spasatel',       'hard',   'Спасатель',       'Сними осаду со штаба своего клана',                                 'siege_broken',      1, '{}', 120, null, 56),
  ('shturm',         'hard',   'Штурм',           'Поймай рыбу на секторе со штабом чужого клана',                     'catch_enemy_hq',    1, '{}', 110, null, 57),
  ('verbovshik',     'hard',   'Вербовщик',       'Позови новичка в клан, и пусть он сделает первый улов',             'clan_recruit',      1, '{}', 100, null, 58);
