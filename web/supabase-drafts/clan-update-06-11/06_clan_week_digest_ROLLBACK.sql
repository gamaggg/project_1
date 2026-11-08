-- Откат 06: итоги недели убрать, clan_build_tick вернуть к версии из 03 (без журнала и уведомления), список рассылки
-- Telegram вернуть к виду после 04 (08.11.2026).
select cron.unschedule('clan-week-digest') where exists (select 1 from cron.job where jobname = 'clan-week-digest');
drop function if exists public.clan_week_digest_tick();
delete from public.notifications where kind = 'clan_week_digest';

create or replace function public.clan_build_tick()
returns int language plpgsql security definer set search_path = public as $$
declare b record; n int := 0;
begin
  for b in select * from public.clan_builds where ends_at <= now() loop
    update public.clan_treasury set projects = jsonb_set(projects, array[b.project], to_jsonb(b.to_level)) where clan_id = b.clan_id;
    if b.project = 'dock' then update public.clans set extra_slots = extra_slots + 2 where id = b.clan_id; end if;
    delete from public.clan_builds where clan_id = b.clan_id;
    n := n + 1;
  end loop;
  return n;
end $$;
revoke all on function public.clan_build_tick() from public, anon, authenticated;

do $rollback$
declare
  v_def text := pg_get_functiondef('public.queue_telegram_notification()'::regprocedure);
begin
  v_def := replace(v_def, $k$'clan_recruit_joined', 'clan_recruit_paid', 'clan_week_digest')$k$, $k$'clan_recruit_joined', 'clan_recruit_paid')$k$);
  execute v_def;
end
$rollback$;
