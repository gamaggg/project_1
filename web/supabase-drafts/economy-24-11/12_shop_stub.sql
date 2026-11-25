-- Заглушка магазина (25.11.2026). ЧЕРНОВИК, применять только после «применяй».
--
-- Владелец: «давай сделаем заглушку, которую я могу ставить для магазина отдельно, чтобы мы всё выложили и я проверил».
-- Переключатель в «Управление» → «Заглушка магазина» (только суперадмин). Пока включено, игроки вместо магазина видят
-- экран «Магазин обновляется»; суперадмин видит магазин как обычно. Как «Технические работы», это только экран:
-- функции магазина на сервере не останавливаются. Хранится рядом с техработами (app_maintenance, строка id = 1),
-- приходит той же проверкой get_maintenance (раз в 5 минут и при возврате в приложение).

alter table public.app_maintenance add column if not exists shop_closed boolean not null default false;

create or replace function public.get_maintenance()
 returns jsonb
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select jsonb_build_object('enabled', m.enabled, 'message', m.message, 'since', m.updated_at, 'shop_closed', m.shop_closed)
  from public.app_maintenance m where m.id = 1;
$function$;

-- Включить / выключить заглушку магазина (только суперадмин).
create or replace function public.admin_set_shop_closed(p_closed boolean)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and is_super_admin) then
    raise exception 'not allowed';
  end if;
  update public.app_maintenance set shop_closed = coalesce(p_closed, false), updated_by = auth.uid() where id = 1;
  return public.get_maintenance();
end $function$;
revoke all on function public.admin_set_shop_closed(boolean) from public, anon;
grant execute on function public.admin_set_shop_closed(boolean) to authenticated;
