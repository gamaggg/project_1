-- Откат 01_service_limits.sql: убирает экран «Лимиты» на стороне базы и возвращает прежние функции.

drop function if exists public.get_service_limits();
drop table if exists public.service_limits_manual;

drop function public.get_admin_permissions(uuid);
create function public.get_admin_permissions(p_user_id uuid)
 returns table(is_admin boolean, can_moderate_reports boolean, can_block_users boolean, can_add_catch_manually boolean, can_view_all_users boolean, can_add_catch_from_gallery boolean, can_review_panoramas boolean, can_view_stats boolean)
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and is_super_admin) then raise exception 'not authorized'; end if;
  return query select p.is_admin, p.can_moderate_reports, p.can_block_users, p.can_add_catch_manually, p.can_view_all_users, p.can_add_catch_from_gallery, p.can_review_panoramas, p.can_view_stats
    from public.profiles p where p.id = p_user_id;
end; $function$;
revoke all on function public.get_admin_permissions(uuid) from public, anon;
grant execute on function public.get_admin_permissions(uuid) to authenticated, service_role;

drop function public.admin_set_admin(uuid, boolean, boolean, boolean, boolean, boolean, boolean, boolean, boolean, boolean);
create function public.admin_set_admin(
  p_user_id uuid,
  p_is_admin boolean,
  p_can_moderate_reports boolean default false,
  p_can_block_users boolean default false,
  p_can_add_catch_manually boolean default false,
  p_can_view_all_users boolean default false,
  p_can_add_catch_from_gallery boolean default false,
  p_can_review_panoramas boolean default false,
  p_can_view_stats boolean default false
)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_target_name text; v_perms text := '';
  v_moderate boolean := p_is_admin and p_can_moderate_reports;
  v_block boolean := p_is_admin and p_can_block_users;
  v_catch boolean := p_is_admin and p_can_add_catch_manually;
  v_users boolean := p_is_admin and p_can_view_all_users;
  v_gallery boolean := p_is_admin and p_can_add_catch_from_gallery;
  v_panoramas boolean := p_is_admin and p_can_review_panoramas;
  v_stats boolean := p_is_admin and p_can_view_stats;
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and is_super_admin) then raise exception 'not authorized'; end if;
  if p_user_id = auth.uid() then raise exception 'cannot change your own admin status'; end if;
  if exists (select 1 from public.profiles where id = p_user_id and is_super_admin) then raise exception 'cannot change another super admin'; end if;
  select display_name into v_target_name from public.profiles where id = p_user_id;
  if not found then raise exception 'user not found'; end if;
  update public.profiles set is_admin = p_is_admin, can_moderate_reports = v_moderate, can_block_users = v_block, can_add_catch_manually = v_catch,
    can_view_all_users = v_users, can_add_catch_from_gallery = v_gallery, can_review_panoramas = v_panoramas, can_view_stats = v_stats
  where id = p_user_id;
  if v_moderate then v_perms := v_perms || 'жалобы, '; end if;
  if v_block then v_perms := v_perms || 'блокировка, '; end if;
  if v_catch then v_perms := v_perms || 'улов без гео, '; end if;
  if v_users then v_perms := v_perms || 'список юзеров, '; end if;
  if v_gallery then v_perms := v_perms || 'улов из галереи, '; end if;
  if v_panoramas then v_perms := v_perms || 'панорамы, '; end if;
  if v_stats then v_perms := v_perms || 'статистика, '; end if;
  v_perms := rtrim(v_perms, ', ');
  insert into public.admin_actions (admin_id, action, target_user_id, details)
  values (auth.uid(), case when p_is_admin then 'grant_admin' else 'revoke_admin' end, p_user_id,
    case when not p_is_admin then 'Забрал права админа у: ' || v_target_name
         when v_perms = '' then 'Выдал права админа: ' || v_target_name || ' (без доп. прав)'
         else 'Выдал права админа: ' || v_target_name || ' (' || v_perms || ')' end);
end; $function$;
revoke all on function public.admin_set_admin(uuid, boolean, boolean, boolean, boolean, boolean, boolean, boolean, boolean) from public, anon;
grant execute on function public.admin_set_admin(uuid, boolean, boolean, boolean, boolean, boolean, boolean, boolean, boolean) to authenticated, service_role;

-- Представление без колонки: убрать колонку через CREATE OR REPLACE нельзя, поэтому пересоздаём и возвращаем права.
do $do$
declare
  v_old text := rtrim(pg_get_viewdef('public.profiles_with_stats'::regclass), E';\n ');
  v_new text;
begin
  v_new := replace(v_old,
    E',\n        CASE\n            WHEN (p.id = auth.uid()) THEN p.can_view_limits\n            ELSE NULL::boolean\n        END AS can_view_limits',
    '');
  if v_new = v_old then raise exception 'profiles_with_stats: блок can_view_limits не найден'; end if;
  drop view public.profiles_with_stats;
  execute 'create view public.profiles_with_stats as ' || v_new;
  grant all on public.profiles_with_stats to anon, authenticated, service_role;
end
$do$;

alter table public.profiles drop column can_view_limits;
