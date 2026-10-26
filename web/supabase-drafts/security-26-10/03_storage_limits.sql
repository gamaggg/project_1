-- Хранилище файлов: у публичных корзин не было ни предела размера, ни списка типов (аудит 26.10.2026).
-- Любой зарегистрированный игрок мог класть в свою папку файлы любого размера и типа и исчерпать бесплатный гигабайт.
-- Приложение грузит только JPEG: фото улова ~350 КБ (1600 px), аватар уменьшен заранее, объявления только от супер-админа.
-- Пределы с запасом: фото улова 8 МБ, аватар 2 МБ, объявления 5 МБ. Корзину geo-panoramas не трогаем (грузит скрипт
-- импорта через служебный ключ), support уже ограничена (5 МБ, jpeg/png/webp).
-- Откат: 03_storage_limits_ROLLBACK.sql.
update storage.buckets set file_size_limit = 8 * 1024 * 1024, allowed_mime_types = array['image/jpeg','image/png','image/webp'] where id = 'catch-photos';
update storage.buckets set file_size_limit = 2 * 1024 * 1024, allowed_mime_types = array['image/jpeg','image/png','image/webp'] where id = 'avatars';
update storage.buckets set file_size_limit = 5 * 1024 * 1024, allowed_mime_types = array['image/jpeg','image/png','image/webp'] where id = 'announcement-photos';
