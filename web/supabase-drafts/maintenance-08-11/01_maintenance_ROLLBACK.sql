-- Откат заглушки (08.11.2026).
drop function if exists public.admin_set_maintenance(boolean, text);
drop function if exists public.get_maintenance();
drop table if exists public.app_maintenance;
