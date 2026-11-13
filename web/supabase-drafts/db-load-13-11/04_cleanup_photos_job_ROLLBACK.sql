-- Откат 04_cleanup_photos_job.sql: снять ночную подчистку фото. Уже удалённые фото не возвращаются
-- (копии есть только у разовой чистки скриптом — scripts/.cache/orphan-backup/).
select cron.unschedule('cleanup-photos');
