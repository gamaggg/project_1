-- Откат 09 (08.11.2026): расписание, рассылка, вставки в _settle_clan_week_at, новые таблицы и функции;
-- clan_set_goal — обратно к версии из 01 (применить её заново из 01_treasury.sql после этого отката).
select cron.unschedule(jobname) from cron.job where jobname = 'clan-leader-away';

do $rollback$
declare v_def text := pg_get_functiondef('public.queue_telegram_notification()'::regprocedure);
begin
  execute replace(v_def, $k$'clan_recruit_paid', 'clan_week_digest', 'clan_nudge')$k$, $k$'clan_recruit_paid', 'clan_week_digest')$k$);
end
$rollback$;

do $rollback$
declare v_def text := pg_get_functiondef('public._settle_clan_week_at(text,timestamptz)'::regprocedure);
begin
  v_def := replace(v_def, $b$
  -- Клан (09): сколько монет клан получил за неделю, для доли в общак.
  v_chest_pool int;
  v_race_pool int;
  v_share int;$b$, '');
  v_def := replace(v_def, $b$
    v_chest_pool := 0;
    v_race_pool := 0;$b$, '');
  v_def := replace(v_def, $b$
        v_chest_pool := v_chest_pool + v_chest_coins;$b$, '');
  v_def := replace(v_def, $b$
          v_race_pool := v_race_pool + v_race_coins;$b$, '');
  v_def := replace(v_def, $b$    if public._clan_econ_on(r.id) then
      select e.chest_share into v_share from public.clan_economy e where e.id = 1;
      if floor(v_chest_pool * v_share / 100.0) >= 1 then
        perform public._clan_treasury_add(r.id, floor(v_chest_pool * v_share / 100.0)::int, 'chest_share', null, 'Сундук недели');
      end if;
      if floor(v_race_pool * v_share / 100.0) >= 1 then
        perform public._clan_treasury_add(r.id, floor(v_race_pool * v_share / 100.0)::int, 'race_share', null, 'Битва кланов недели');
      end if;
    end if;
$b$, '');
  if position('v_chest_pool' in v_def) > 0 then raise exception '_settle_clan_week_at rollback: leftovers of 09 remain'; end if;
  execute v_def;
end
$rollback$;

drop trigger if exists clan_recruit_on_catch on public.catches;
drop trigger if exists clan_recruit_on_join on public.clan_members;
drop function if exists public._clan_recruit_on_join();
drop function if exists public._clan_recruit_on_catch();
drop function if exists public.get_clan_state(bigint);
drop function if exists public.get_clan_treasury_unchecked(bigint);
drop function if exists public.admin_clan_reverse_entry(bigint);
drop function if exists public.clan_leader_away_tick();
drop function if exists public._last_seen(uuid);
drop function if exists public.clan_nudge(uuid);
drop function if exists public.clan_quest_claim();
drop function if exists public._clan_quest_progress(bigint, text, timestamptz);
drop function if exists public._clan_quest_ensure(bigint);
drop function if exists public._clan_week_start(bigint);
drop function if exists public.clan_shop_equip(text, text);
drop function if exists public.clan_shop_buy(text);
drop function if exists public._clan_shop_item(text);
drop table if exists public.clan_recruits;
drop table if exists public.clan_quests;
drop table if exists public.clan_equipped;
drop table if exists public.clan_items;
delete from public.notifications where kind = 'clan_nudge';
