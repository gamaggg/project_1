-- Откат 12 (25.11.2026): убрать заглушку магазина — get_maintenance как до 12, без переключателя и колонки.
create or replace function public.get_maintenance()
 returns jsonb
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select jsonb_build_object('enabled', m.enabled, 'message', m.message, 'since', m.updated_at)
  from public.app_maintenance m where m.id = 1;
$function$;
drop function if exists public.admin_set_shop_closed(boolean);
alter table public.app_maintenance drop column if exists shop_closed;
