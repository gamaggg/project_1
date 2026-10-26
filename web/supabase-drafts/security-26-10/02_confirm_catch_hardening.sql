-- confirm_catch: две дыры (аудит 26.10.2026).
-- 1) Первой строкой перед поиском сектора функция делала `insert into territories (id) values (p_territory_id) on conflict do nothing`.
--    У таблицы kind/lat/lng/corners необязательны, is_deleted по умолчанию false, поэтому любой вошедший игрок мог
--    вызвать confirm_catch с выдуманным названием сектора и создать пустой «сектор без координат» (и сразу владеть им).
--    Такие строки засоряют таблицу и могут сломать отрисовку карты у всех. Прогон 26.10: выдуманный сектор создавался.
--    Теперь вставка убрана, дальше работает существующая проверка «unknown territory».
-- 2) p_photo_url принимался любой строкой (чужой сайт, чужое фото). Теперь адрес обязан лежать в папке самого игрока
--    в нашем хранилище: .../catch-photos/<uid>/… (так загружает приложение, 844 из 844 уловов в базе подходят; фото в
--    дневнике <uid>/diary/… тоже подходит). Пустой адрес разрешён, как и раньше.
-- Откат: 02_confirm_catch_hardening_ROLLBACK.sql (возвращает оба фрагмента).
do $do$
declare
  v_old text := pg_get_functiondef('public.confirm_catch(text,text,text,integer,numeric,text,text,timestamp with time zone)'::regprocedure);
  v_new text;
begin
  v_new := replace(v_old,
    'insert into public.territories (id) values (p_territory_id) on conflict (id) do nothing;',
    '-- сектор должен уже существовать (аудит 26.10.2026)');
  if v_new = v_old then raise exception 'confirm_catch: вставка сектора не найдена'; end if;
  v_old := v_new;
  v_new := replace(v_old,
    'if v_uid is null then raise exception ''not authenticated''; end if;',
    'if v_uid is null then raise exception ''not authenticated''; end if;' || E'\n  ' ||
    'if p_photo_url is not null and p_photo_url not like ''https://yhgdcdkfkerzuhnzjzrz.supabase.co/storage/v1/object/public/catch-photos/'' || v_uid::text || ''/%'' then raise exception ''PHOTO_URL_INVALID''; end if;');
  if v_new = v_old then raise exception 'confirm_catch: проверка входа не найдена'; end if;
  execute v_new;
end
$do$;
