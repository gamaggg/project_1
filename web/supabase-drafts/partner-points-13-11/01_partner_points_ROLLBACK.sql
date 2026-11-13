-- Откат 01_partner_points.sql: убирает точки партнёров целиком (вместе с введёнными точками).
-- Записи в admin_actions (partner_add / partner_edit / partner_delete) остаются как история.
set local lock_timeout = '3s';
drop function if exists public.admin_partner_point_delete(bigint);
drop function if exists public.admin_partner_point_save(bigint, jsonb);
drop function if exists public.partner_prize_of_week(text, date);
drop function if exists public.partner_points_live();
drop table if exists public.partner_points;
