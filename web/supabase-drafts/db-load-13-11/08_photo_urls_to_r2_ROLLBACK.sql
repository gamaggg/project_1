-- Откат 08_photo_urls_to_r2.sql: адрес Supabase возвращается только тем фото, чей файл в Supabase ещё лежит.
-- Фото, загруженные уже после переключения, есть только в R2 — у них адрес остаётся новым (иначе они бы пропали).
-- Если вместе с этим выключается переключатель в приложении (NEXT_PUBLIC_PHOTO_BASE_URL), такие фото продолжат
-- открываться с photos.catchrange.com: R2 и домен остаются.
set local lock_timeout = '3s';

update public.catches t
set photo_url = 'https://yhgdcdkfkerzuhnzjzrz.supabase.co/storage/v1/object/public/' || r.rest
from (select id, substr(photo_url, length('https://photos.catchrange.com/') + 1) as rest from public.catches where photo_url like 'https://photos.catchrange.com/%') r
where t.id = r.id
  and exists (select 1 from storage.objects o where o.bucket_id = split_part(r.rest, '/', 1) and o.name = substr(r.rest, length(split_part(r.rest, '/', 1)) + 2));

update public.diary_catches t
set photo_url = 'https://yhgdcdkfkerzuhnzjzrz.supabase.co/storage/v1/object/public/' || r.rest
from (select id, substr(photo_url, length('https://photos.catchrange.com/') + 1) as rest from public.diary_catches where photo_url like 'https://photos.catchrange.com/%') r
where t.id = r.id
  and exists (select 1 from storage.objects o where o.bucket_id = split_part(r.rest, '/', 1) and o.name = substr(r.rest, length(split_part(r.rest, '/', 1)) + 2));

update public.profiles t
set avatar_url = 'https://yhgdcdkfkerzuhnzjzrz.supabase.co/storage/v1/object/public/' || r.rest
from (select id, substr(avatar_url, length('https://photos.catchrange.com/') + 1) as rest from public.profiles where avatar_url like 'https://photos.catchrange.com/%') r
where t.id = r.id
  and exists (select 1 from storage.objects o where o.bucket_id = split_part(r.rest, '/', 1) and o.name = substr(r.rest, length(split_part(r.rest, '/', 1)) + 2));

update public.announcements t
set photo_url = 'https://yhgdcdkfkerzuhnzjzrz.supabase.co/storage/v1/object/public/' || r.rest
from (select id, substr(photo_url, length('https://photos.catchrange.com/') + 1) as rest from public.announcements where photo_url like 'https://photos.catchrange.com/%') r
where t.id = r.id
  and exists (select 1 from storage.objects o where o.bucket_id = split_part(r.rest, '/', 1) and o.name = substr(r.rest, length(split_part(r.rest, '/', 1)) + 2));
