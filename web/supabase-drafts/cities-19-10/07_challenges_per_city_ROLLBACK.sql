-- Откат 07: прежние определения четырёх функций из _city_migration_backup (самые ранние сохранённые
-- в этой миграции) и удаление get_my_other_city_challenges.
do $rb$
declare r record;
begin
  for r in
    select distinct on (proname) proname, def
    from public._city_migration_backup
    where proname in ('sync_my_challenges', 'notify_challenge_deadline_approaching', 'buy_extra_challenge', 'get_my_challenge_week_state')
      and saved_at > (select max(saved_at) from public._city_migration_backup where proname = 'territories_with_stats')
    order by proname, saved_at asc
  loop
    execute r.def;
  end loop;
end
$rb$;
drop function if exists public.get_my_other_city_challenges(text);
