-- Откат 01_social_posts.sql: снимает задачу и удаляет таблицу вместе с постами.
select cron.unschedule('social-bot-tick') where exists (select 1 from cron.job where jobname = 'social-bot-tick');
drop table if exists public.social_posts;
