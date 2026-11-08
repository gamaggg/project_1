-- Откат 08 (08.11.2026): расписание снять, confirm_catch вернуть к телу до 08 (обратные замены по тем же якорям),
-- ренту вернуть к суточной версии из 02 (перед этим откатом применить её заново из 02_buff_hq.sql), убрать новые функции.
select cron.unschedule(jobname) from cron.job where jobname in ('clan-rent-tick', 'clan-minute-tick');

do $rollback$
declare
  v_def text := pg_get_functiondef('public.confirm_catch(text,text,text,integer,numeric,text,text,timestamptz)'::regprocedure);
begin
  v_def := replace(v_def, $b$  v_hot boolean := false;
  -- Клан (08): штаб клана на этом секторе, осада вместо захвата.
  v_hq_clan bigint;
  v_siege boolean := false;
begin$b$, $a$  v_hot boolean := false;
begin$a$);
  v_def := replace(v_def, $b$ / (86400 * public._clan_hq_decay_days(p_territory_id)))::int);$b$, $a$ / 86400)::int);$a$);
  v_def := replace(v_def, $b$
  -- Штаб клана (общак у клана работает): чужой улов при защите 0 начинает осаду, сектор не переходит.
  select h.clan_id into v_hq_clan from public.clan_hq h
   where h.territory_id = p_territory_id and public._clan_econ_on(h.clan_id);
  if v_hq_clan is not null and not v_late and not v_attack and v_prev_owner is not null and v_prev_owner <> v_uid and not v_clan_mate then
    v_siege := public.clan_hq_attack(p_territory_id, v_uid, v_def_now);
  end if;$b$, '');
  v_def := replace(v_def, $b$  elsif v_siege then
    v_def_after := 0; -- осада штаба: сектор остаётся за кланом
$b$, '');
  v_def := replace(v_def, $b$  -- Улов хозяина или соклановца на осаждённом штабе снимает осаду; чужой улов по защите штаба — тревога всему клану.
  if v_hq_clan is not null and not v_late then
    if v_prev_owner = v_uid or v_clan_mate then
      perform public.clan_hq_defend(p_territory_id, v_uid);
    elsif v_attack then
      perform public._clan_notify_many(v_hq_clan, 'clan_hq_attacked', v_uid, jsonb_build_object('territory_id', p_territory_id, 'defense', v_def_after), 'all', null);
    end if;
  end if;
$b$, '');
  v_def := replace(v_def, $b$ and not v_attack and not v_siege then$b$, $a$ and not v_attack then$a$);
  v_def := replace(v_def, $b$v_late, v_attack or v_siege, v_def_after;$b$, $a$v_late, v_attack, v_def_after;$a$);
  if position('v_siege' in v_def) > 0 or position('_clan_hq_decay_days' in v_def) > 0 then
    raise exception 'confirm_catch rollback: leftovers of 08 remain';
  end if;
  execute v_def;
end
$rollback$;

drop function if exists public.clan_buff_tick();
drop function if exists public._clan_hq_decay_days(text);
