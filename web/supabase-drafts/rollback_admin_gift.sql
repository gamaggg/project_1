-- Откат admin_gift.sql: функция массового подарка. Уже выданные монеты, прокруты и уведомления остаются.
drop function if exists public.admin_gift(uuid[], integer, integer, text);
