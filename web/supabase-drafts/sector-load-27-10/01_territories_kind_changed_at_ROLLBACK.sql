-- Откат 01_territories_kind_changed_at.sql: возвращает прежние функцию и представление, убирает колонку.
-- Старый клиент (грузит все строки города) от колонки не зависит; новый клиент без колонки работать не будет,
-- поэтому откатывать только вместе с откатом кода.

do $do$
declare
  v_old text := pg_get_functiondef('public.admin_set_territory_kind(text, text, double precision, double precision)'::regprocedure);
  v_new text;
begin
  v_new := replace(v_old, ', kind_changed_at = now() where id = p_territory_id;', ' where id = p_territory_id;');
  v_new := replace(v_new, '(id, kind, lat, lng, kind_changed_at) values (p_territory_id, p_kind::territory_kind, p_lat, p_lng, now());', '(id, kind, lat, lng) values (p_territory_id, p_kind::territory_kind, p_lat, p_lng);');
  if v_new = v_old then raise exception 'ОТКАТ admin_set_territory_kind: метка не найдена'; end if;
  execute v_new;
end
$do$;

-- Представление без колонки: убрать колонку через CREATE OR REPLACE нельзя, поэтому пересоздаём и возвращаем права.
do $do$
declare
  v_old text := rtrim(pg_get_viewdef('public.territories_with_stats'::regclass), E';\n ');
  v_new text;
begin
  v_new := replace(v_old, E',\n    t.kind_changed_at\n   FROM (', E'\n   FROM (');
  if v_new = v_old then raise exception 'ОТКАТ territories_with_stats: колонка не найдена'; end if;
  drop view public.territories_with_stats;
  execute 'create view public.territories_with_stats as ' || v_new;
  grant all on public.territories_with_stats to anon, authenticated, service_role;
end
$do$;

alter table public.territories drop column kind_changed_at;
