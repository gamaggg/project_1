-- 06 · Итоги недели клана в Telegram и «Постройка готова» всему клану (решение владельца 08.11.2026).
-- ЧЕРНОВИК, применять только после «применяй». Зависит от 01 (clan_economy, clan_treasury_log), 03 (clan_builds,
-- clan_build_tick) и 04 (_clan_notify_many, список видов в queue_telegram_notification). Порядок: 01 → … → 05 → 06.
--
-- Что делает:
--   1. clan_build_tick (перезапись версии из 03): готовая постройка пишет строку 'built' в журнал общака (по ней итоги
--      недели знают, что построено) и шлёт clan_project_done ВСЕМУ клану (было «главе и заместителям»).
--   2. clan_week_digest_tick(): раз в неделю, в понедельник утром, каждому участнику клана одно уведомление
--      clan_week_digest — сколько пришло в общак и сколько потрачено, кто больше всех вложил (взносы и отчисления,
--      первые три), что построено, сколько у клана секторов, уловов и сколько участников ловили. Клану, у которого за
--      неделю не было ни монет, ни уловов, ничего не шлём. Только кланам, у которых общак работает (_clan_econ_on).
--   3. clan_week_digest в списке рассылки Telegram (ночное правило общее: в 10:00 по Москве это не ночь).
--   4. Расписание: понедельник 07:00 UTC (10:00 Москва, 11:00 Тбилиси).
-- Тексты сообщений: web/app/api/telegram/send-notifications/route.ts (clan_week_digest), web/lib/telegram/clanDigest.ts.

-- 1. Готовая постройка: журнал + уведомление всему клану.
create or replace function public.clan_build_tick()
returns int language plpgsql security definer set search_path = public as $$
declare b record; n int := 0;
begin
  for b in select * from public.clan_builds where ends_at <= now() loop
    update public.clan_treasury set projects = jsonb_set(projects, array[b.project], to_jsonb(b.to_level)) where clan_id = b.clan_id;
    if b.project = 'dock' then update public.clans set extra_slots = extra_slots + 2 where id = b.clan_id; end if;
    delete from public.clan_builds where clan_id = b.clan_id;
    insert into public.clan_treasury_log (clan_id, kind, amount, user_id, label) values (b.clan_id, 'built', 0, null, b.project || ':' || b.to_level);
    perform public._clan_notify_many(b.clan_id, 'clan_project_done', null, jsonb_build_object('project', b.project, 'level', b.to_level), 'all', null);
    n := n + 1;
  end loop;
  return n;
end $$;
revoke all on function public.clan_build_tick() from public, anon, authenticated;

-- 2. Итоги недели.
create or replace function public.clan_week_digest_tick()
returns int language plpgsql security definer set search_path = public as $$
declare
  v_from timestamptz := now() - interval '7 days';
  r record;
  v_income int; v_spent int; v_top jsonb; v_built jsonb; v_sectors int; v_catches int; v_fishers int;
  v_sent int := 0;
begin
  for r in select c.id from public.clans c where c.disbanded_at is null and public._clan_econ_on(c.id) loop
    select coalesce(sum(l.amount) filter (where l.amount > 0), 0), coalesce(-sum(l.amount) filter (where l.amount < 0), 0)
      into v_income, v_spent
      from public.clan_treasury_log l where l.clan_id = r.id and l.created_at >= v_from;
    select coalesce(jsonb_agg(jsonb_build_object('name', t.name, 'coins', t.coins) order by t.coins desc), '[]'::jsonb) into v_top
      from (select coalesce(p.display_name, '—') as name, sum(l.amount)::int as coins
              from public.clan_treasury_log l join public.profiles p on p.id = l.user_id
             where l.clan_id = r.id and l.created_at >= v_from and l.kind in ('donation', 'tax') and l.amount > 0
             group by p.id, p.display_name order by 2 desc limit 3) t;
    select coalesce(jsonb_agg(jsonb_build_object('project', split_part(l.label, ':', 1), 'level', split_part(l.label, ':', 2)::int) order by l.id), '[]'::jsonb) into v_built
      from public.clan_treasury_log l where l.clan_id = r.id and l.kind = 'built' and l.created_at >= v_from;
    select count(*) into v_sectors
      from public.territories t join public.clan_members cm on cm.user_id = t.owner_id and cm.clan_id = r.id and cm.left_at is null
     where not t.is_deleted;
    select count(*), count(distinct c.user_id) into v_catches, v_fishers
      from public.catches c join public.clan_members cm on cm.user_id = c.user_id and cm.clan_id = r.id and cm.left_at is null
     where c.caught_at >= greatest(v_from, cm.joined_at);
    continue when v_income = 0 and v_catches = 0;
    v_sent := v_sent + public._clan_notify_many(r.id, 'clan_week_digest', null, jsonb_build_object(
      'income', v_income, 'spent', v_spent, 'top', v_top, 'built', v_built,
      'sectors', v_sectors, 'catches', v_catches, 'fishers', v_fishers), 'all', null);
  end loop;
  return v_sent;
end $$;
revoke all on function public.clan_week_digest_tick() from public, anon, authenticated;

-- 3. Telegram: новый вид в списке рассылки (якорь — конец списка после 04, ровно одно вхождение).
do $migration$
declare
  v_def text := pg_get_functiondef('public.queue_telegram_notification()'::regprocedure);
  v_kinds constant text := $k$'clan_recruit_joined', 'clan_recruit_paid')$k$;
begin
  if (length(v_def) - length(replace(v_def, v_kinds, ''))) / length(v_kinds) <> 1 then
    raise exception 'queue_telegram_notification: kinds anchor (after 04) not found exactly once';
  end if;
  v_def := replace(v_def, v_kinds, $k$'clan_recruit_joined', 'clan_recruit_paid', 'clan_week_digest')$k$);
  execute v_def;
end
$migration$;

-- 4. Расписание: понедельник, 07:00 UTC.
select cron.schedule('clan-week-digest', '0 7 * * 1', $$select public.clan_week_digest_tick()$$);
