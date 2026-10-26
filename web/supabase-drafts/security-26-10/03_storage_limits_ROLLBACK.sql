-- Откат 03_storage_limits.sql: снова без пределов.
update storage.buckets set file_size_limit = null, allowed_mime_types = null where id in ('catch-photos', 'avatars', 'announcement-photos');
