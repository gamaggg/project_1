-- Откат 01_admin_support_chat.sql: всё как было 30.10.2026 до черновика.
-- Внимание: обращения, начатые админом (started_by), и фото в ответах поддержки останутся строками
-- в таблицах, но колонки started_by и photo_path уйдут: первое сообщение такого обращения игрок
-- увидит как своё. Если такие обращения уже есть, сначала решить, удалять ли их.

drop policy if exists "support photos readable in own chats" on storage.objects;

-- Ответ из бота — снова только супер-админ.
create or replace function public.answer_support_ticket(p_ticket_id bigint, p_admin_telegram bigint, p_body text)
 returns uuid
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_admin uuid;
  v_user uuid;
  v_body text := btrim(coalesce(p_body, ''));
begin
  select id into v_admin from public.profiles where telegram_id = p_admin_telegram and is_super_admin;
  if v_admin is null then raise exception 'SUPPORT:not_admin'; end if;
  if char_length(v_body) < 1 or char_length(v_body) > 4000 then raise exception 'SUPPORT:length'; end if;
  select user_id into v_user from public.support_tickets where id = p_ticket_id;
  if v_user is null then raise exception 'SUPPORT:no_ticket'; end if;
  insert into public.support_replies (ticket_id, admin_id, body) values (p_ticket_id, v_admin, v_body);
  update public.support_tickets set answered_at = now() where id = p_ticket_id;
  insert into public.notifications (user_id, kind, actor_id, payload)
  values (v_user, 'support_reply', v_admin, jsonb_build_object('ticket_id', p_ticket_id, 'text', left(v_body, 300)));
  return v_user;
end;
$function$;

drop function public.admin_get_support_chat(uuid);
drop function public.admin_send_support_message(uuid, text, bigint, text);

drop function public.get_admin_permissions(uuid);
create function public.get_admin_permissions(p_user_id uuid)
 returns table(is_admin boolean, can_moderate_reports boolean, can_block_users boolean, can_add_catch_manually boolean, can_view_all_users boolean, can_add_catch_from_gallery boolean, can_review_panoramas boolean, can_view_stats boolean, can_view_limits boolean)
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and is_super_admin) then raise exception 'not authorized'; end if;
  return query select p.is_admin, p.can_moderate_reports, p.can_block_users, p.can_add_catch_manually, p.can_view_all_users, p.can_add_catch_from_gallery, p.can_review_panoramas, p.can_view_stats, p.can_view_limits
    from public.profiles p where p.id = p_user_id;
end; $function$;
revoke all on function public.get_admin_permissions(uuid) from public, anon;
grant execute on function public.get_admin_permissions(uuid) to authenticated, service_role;

drop function public.admin_set_admin(uuid, boolean, boolean, boolean, boolean, boolean, boolean, boolean, boolean, boolean, boolean);
create function public.admin_set_admin(
  p_user_id uuid,
  p_is_admin boolean,
  p_can_moderate_reports boolean default false,
  p_can_block_users boolean default false,
  p_can_add_catch_manually boolean default false,
  p_can_view_all_users boolean default false,
  p_can_add_catch_from_gallery boolean default false,
  p_can_review_panoramas boolean default false,
  p_can_view_stats boolean default false,
  p_can_view_limits boolean default false
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
  v_limits boolean := p_is_admin and p_can_view_limits;
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and is_super_admin) then raise exception 'not authorized'; end if;
  if p_user_id = auth.uid() then raise exception 'cannot change your own admin status'; end if;
  if exists (select 1 from public.profiles where id = p_user_id and is_super_admin) then raise exception 'cannot change another super admin'; end if;
  select display_name into v_target_name from public.profiles where id = p_user_id;
  if not found then raise exception 'user not found'; end if;
  update public.profiles set is_admin = p_is_admin, can_moderate_reports = v_moderate, can_block_users = v_block, can_add_catch_manually = v_catch,
    can_view_all_users = v_users, can_add_catch_from_gallery = v_gallery, can_review_panoramas = v_panoramas, can_view_stats = v_stats,
    can_view_limits = v_limits
  where id = p_user_id;
  if v_moderate then v_perms := v_perms || 'жалобы, '; end if;
  if v_block then v_perms := v_perms || 'блокировка, '; end if;
  if v_catch then v_perms := v_perms || 'улов без гео, '; end if;
  if v_users then v_perms := v_perms || 'список юзеров, '; end if;
  if v_gallery then v_perms := v_perms || 'улов из галереи, '; end if;
  if v_panoramas then v_perms := v_perms || 'панорамы, '; end if;
  if v_stats then v_perms := v_perms || 'статистика, '; end if;
  if v_limits then v_perms := v_perms || 'лимиты, '; end if;
  v_perms := rtrim(v_perms, ', ');
  insert into public.admin_actions (admin_id, action, target_user_id, details)
  values (auth.uid(), case when p_is_admin then 'grant_admin' else 'revoke_admin' end, p_user_id,
    case when not p_is_admin then 'Забрал права админа у: ' || v_target_name
         when v_perms = '' then 'Выдал права админа: ' || v_target_name || ' (без доп. прав)'
         else 'Выдал права админа: ' || v_target_name || ' (' || v_perms || ')' end);
end; $function$;
revoke all on function public.admin_set_admin(uuid, boolean, boolean, boolean, boolean, boolean, boolean, boolean, boolean, boolean) from public, anon;
grant execute on function public.admin_set_admin(uuid, boolean, boolean, boolean, boolean, boolean, boolean, boolean, boolean, boolean) to authenticated, service_role;

drop function public.can_message_players();

-- Представление без can_message_players: убрать добавленный кусок. Колонку из view нельзя убрать
-- через CREATE OR REPLACE, поэтому DROP + CREATE с тем же текстом и правами, что были.
do $do$
declare
  v_def text := pg_get_viewdef('public.profiles_with_stats'::regclass);
  v_new text;
begin
  v_def := rtrim(v_def, E';\n ');
  v_new := replace(v_def,
    E',\n        CASE\n            WHEN (p.id = auth.uid()) THEN p.can_message_players\n            ELSE NULL::boolean\n        END AS can_message_players',
    '');
  if v_new = v_def then raise exception 'profiles_with_stats: кусок can_message_players не найден'; end if;
  execute 'drop view public.profiles_with_stats';
  execute 'create view public.profiles_with_stats as ' || v_new;
  -- права как были до черновика (на 30.10.2026: всё у anon, authenticated, service_role)
  execute 'grant all on public.profiles_with_stats to anon, authenticated, service_role';
end
$do$;

alter table public.support_replies drop column photo_path;
alter table public.support_tickets drop column started_by;
alter table public.profiles drop column can_message_players;
