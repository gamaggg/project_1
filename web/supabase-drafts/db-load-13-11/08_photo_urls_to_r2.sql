-- Перенос фото в Cloudflare R2, переключение (13.11.2026): адреса фото в базе — на https://photos.catchrange.com.
-- Путь тот же, меняется только начало: .../storage/v1/object/public/<корзина>/<путь> → https://photos.catchrange.com/<корзина>/<путь>.
--
-- Применять ТОЛЬКО когда:
--   1) 07_photos_on_r2.sql уже применён (иначе правило дневника отклонит новые адреса — миграция откажется сама);
--   2) scripts/move-photos-to-r2.mjs --verify сказал «READY: everything is in R2» (каждый файл в R2 того же размера,
--      миниатюры на месте), а https://photos.catchrange.com отдаёт файлы;
--   3) ночью: уловы в Realtime — замена ≈1 350 строк разошлётся событиями всем, кто онлайн.
-- Можно запускать повторно: меняются только строки, ещё указывающие на Supabase (например, фото, загруженные старой
-- версией приложения между заменой и выкладкой переключателя; их файлы сначала докопирует тот же скрипт).
-- Панорамы хранят путь, адрес собирает приложение (lib/geo.ts) — здесь их нет.
-- Откат: 08_photo_urls_to_r2_ROLLBACK.sql (возвращает адрес Supabase только тем строкам, чей файл там ещё есть).

set local lock_timeout = '3s';

do $m$
begin
  if position('photos.catchrange.com' in (select pg_get_constraintdef(oid) from pg_constraint where conname = 'diary_catches_photo_own')) = 0 then
    raise exception 'сначала 07_photos_on_r2.sql: правило дневника ещё не принимает photos.catchrange.com';
  end if;
end
$m$;

update public.catches
set photo_url = 'https://photos.catchrange.com/' || substr(photo_url, length('https://yhgdcdkfkerzuhnzjzrz.supabase.co/storage/v1/object/public/') + 1)
where photo_url like 'https://yhgdcdkfkerzuhnzjzrz.supabase.co/storage/v1/object/public/%';

update public.diary_catches
set photo_url = 'https://photos.catchrange.com/' || substr(photo_url, length('https://yhgdcdkfkerzuhnzjzrz.supabase.co/storage/v1/object/public/') + 1)
where photo_url like 'https://yhgdcdkfkerzuhnzjzrz.supabase.co/storage/v1/object/public/%';

update public.profiles
set avatar_url = 'https://photos.catchrange.com/' || substr(avatar_url, length('https://yhgdcdkfkerzuhnzjzrz.supabase.co/storage/v1/object/public/') + 1)
where avatar_url like 'https://yhgdcdkfkerzuhnzjzrz.supabase.co/storage/v1/object/public/%';

update public.announcements
set photo_url = 'https://photos.catchrange.com/' || substr(photo_url, length('https://yhgdcdkfkerzuhnzjzrz.supabase.co/storage/v1/object/public/') + 1)
where photo_url like 'https://yhgdcdkfkerzuhnzjzrz.supabase.co/storage/v1/object/public/%';
