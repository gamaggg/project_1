-- Заглушка «Идут технические работы» (просьба владельца 08.11.2026). ЧЕРНОВИК, применять только после «применяй».
-- Одна строка-переключатель. Включает и выключает только суперадмин (из «Управления» в профиле), читают все, даже
-- гости: приложение раз в 30 секунд и при возврате на экран спрашивает get_maintenance() и, если заглушка включена,
-- показывает экран техработ всем, кроме суперадмина. Ничего в игре не останавливает: только экран.

create table public.app_maintenance (
  id smallint primary key default 1 check (id = 1),
  enabled boolean not null default false,
  message text check (message is null or char_length(message) <= 300),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id) on delete set null
);
insert into public.app_maintenance (id) values (1);
alter table public.app_maintenance enable row level security;
-- Напрямую таблицу никто не читает и не меняет: только через функции ниже.
revoke all on table public.app_maintenance from public, anon, authenticated;
grant all on table public.app_maintenance to service_role;

create function public.get_maintenance()
returns jsonb language sql stable security definer set search_path to 'public' as $$
  select jsonb_build_object('enabled', m.enabled, 'message', m.message, 'since', m.updated_at)
  from public.app_maintenance m where m.id = 1;
$$;
revoke all on function public.get_maintenance() from public;
grant execute on function public.get_maintenance() to anon, authenticated, service_role;

create function public.admin_set_maintenance(p_enabled boolean, p_message text default null)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and is_super_admin) then
    raise exception 'not allowed';
  end if;
  update public.app_maintenance
     set enabled = p_enabled,
         message = nullif(btrim(coalesce(p_message, '')), ''),
         updated_at = now(),
         updated_by = auth.uid()
   where id = 1;
  return public.get_maintenance();
end $$;
revoke all on function public.admin_set_maintenance(boolean, text) from public, anon;
grant execute on function public.admin_set_maintenance(boolean, text) to authenticated;
