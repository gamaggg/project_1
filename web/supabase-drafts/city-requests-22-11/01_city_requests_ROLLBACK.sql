-- Откат 01_city_requests.sql (уведомления, что уже пришли, остаются в «Активности»).
drop function if exists public.request_city(text);
drop table if exists public.city_requests;
