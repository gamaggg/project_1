-- Откат 03_partner_stats.sql: убирает статистику точек партнёров и доступы партнёров (вместе с накопленными действиями).
-- Записи partner_stats_grant / partner_stats_revoke в admin_actions остаются как история.
set local lock_timeout = '3s';
drop function if exists public.admin_partner_access_of(uuid);
drop function if exists public.admin_partner_viewers(bigint);
drop function if exists public.admin_partner_viewer_set(bigint, uuid, boolean);
drop function if exists public.partner_points_shared_with_me();
drop function if exists public.partner_point_stats(bigint, timestamptz, timestamptz);
drop function if exists public.partner_point_track(bigint, text, text);
drop table if exists public.partner_point_viewers;
drop table if exists public.partner_point_events;
