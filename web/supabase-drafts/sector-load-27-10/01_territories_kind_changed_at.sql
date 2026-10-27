-- Облегчённая загрузка секторов: форма и вид воды секторов теперь лежат в статических файлах
-- public/data/sectors-<буква города>.json, а у базы клиент просит только «непустые» строки.
-- Чтобы клиент заметил сектор, которому после сборки файла сменили вид воды, смена помечается:
--  1) колонка territories.kind_changed_at (пусто = вид не менялся с тех пор, как колонка появилась);
--  2) её отдаёт territories_with_stats (в конце списка; CREATE OR REPLACE оставляет права);
--  3) admin_set_territory_kind ставит метку при смене и при создании строки.
-- Откат: 01_territories_kind_changed_at_ROLLBACK.sql.

alter table public.territories add column kind_changed_at timestamptz;

do $do$
declare
  v_old text := rtrim(pg_get_viewdef('public.territories_with_stats'::regclass), E';\n ');
  v_new text;
begin
  v_new := replace(v_old,
    E'p.territory_color AS owner_territory_color\n   FROM (',
    E'p.territory_color AS owner_territory_color,\n    t.kind_changed_at\n   FROM (');
  if v_new = v_old then raise exception 'territories_with_stats: место вставки не найдено'; end if;
  execute 'create or replace view public.territories_with_stats as ' || v_new;
end
$do$;

do $do$
declare
  v_old text := pg_get_functiondef('public.admin_set_territory_kind(text, text, double precision, double precision)'::regprocedure);
  v_new text;
begin
  v_new := replace(v_old,
    'update public.territories set kind = p_kind::territory_kind where id = p_territory_id;',
    'update public.territories set kind = p_kind::territory_kind, kind_changed_at = now() where id = p_territory_id;');
  if v_new = v_old then raise exception 'admin_set_territory_kind: update не найден'; end if;
  v_old := v_new;
  v_new := replace(v_old,
    'insert into public.territories (id, kind, lat, lng) values (p_territory_id, p_kind::territory_kind, p_lat, p_lng);',
    'insert into public.territories (id, kind, lat, lng, kind_changed_at) values (p_territory_id, p_kind::territory_kind, p_lat, p_lng, now());');
  if v_new = v_old then raise exception 'admin_set_territory_kind: insert не найден'; end if;
  execute v_new;
end
$do$;
