-- Откат 02_functions_by_city.sql: возвращает прежние определения 27 функций и представления
-- из резервной таблицы _city_migration_backup (самое раннее сохранённое для каждой).
do $rb$
declare r record;
begin
  for r in
    select distinct on (fn_oid) fn_oid, proname, def
    from public._city_migration_backup
    order by fn_oid, saved_at asc
  loop
    execute r.def;
  end loop;
end
$rb$;
-- Резервную таблицу после проверки можно убрать: drop table public._city_migration_backup;
