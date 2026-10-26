-- Откат 02_confirm_catch_hardening.sql: возвращает создание сектора и убирает проверку адреса фото.
do $do$
declare
  v_old text := pg_get_functiondef('public.confirm_catch(text,text,text,integer,numeric,text,text,timestamp with time zone)'::regprocedure);
  v_new text;
begin
  v_new := replace(v_old,
    '-- сектор должен уже существовать (аудит 26.10.2026)',
    'insert into public.territories (id) values (p_territory_id) on conflict (id) do nothing;');
  v_old := v_new;
  v_new := replace(v_old,
    E'\n  ' || 'if p_photo_url is not null and p_photo_url not like ''https://yhgdcdkfkerzuhnzjzrz.supabase.co/storage/v1/object/public/catch-photos/'' || v_uid::text || ''/%'' then raise exception ''PHOTO_URL_INVALID''; end if;',
    '');
  execute v_new;
end
$do$;
