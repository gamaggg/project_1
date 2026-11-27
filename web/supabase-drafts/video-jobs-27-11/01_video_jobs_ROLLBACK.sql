-- Откат: убрать таблицу и корзину. Файлы из корзины сначала удалить (через панель Storage или API), иначе корзина не удалится.
set local lock_timeout = '3s';

drop table if exists public.video_jobs;
delete from storage.buckets where id = 'social-videos';
