-- Чат поддержки по инициативе админа (30.10.2026): супер-админ (или админ с переключателем
-- can_message_players) сам пишет любому игроку — из профиля игрока, текст и фото. Игрок видит
-- это в своём чате поддержки как обычную переписку и отвечает как всегда (add_support_message).
-- 1) флаг can_message_players на profiles (путь как у can_view_limits: колонка, маска во view,
--    admin_set_admin, get_admin_permissions) и проверка can_message_players();
-- 2) support_tickets.started_by (кто из админов начал; первое сообщение тогда от поддержки),
--    support_replies.photo_path (фото в ответе поддержки);
-- 3) admin_send_support_message — начать обращение или написать в существующее;
--    admin_get_support_chat — переписка игрока для окна админа;
-- 4) answer_support_ticket: ответ через бота может дать и админ с флагом (не только супер-админ);
-- 5) чтение фото в закрытом хранилище support: свои файлы, фото из своих обращений
--    (так игрок видит фото от поддержки) и всё — тому, кто может писать игрокам.
-- Откат: 01_admin_support_chat_ROLLBACK.sql.

alter table public.profiles add column can_message_players boolean not null default false;
alter table public.support_tickets add column started_by uuid references public.profiles(id) on delete set null;
alter table public.support_replies add column photo_path text;

-- Представление: тот же текст, что сейчас в базе, плюс can_message_players в конце (CREATE OR REPLACE сохраняет права).
do $do$
declare
  v_old text := pg_get_viewdef('public.profiles_with_stats'::regclass);
  v_new text;
begin
  v_old := rtrim(v_old, E';\n ');
  v_new := replace(v_old,
    E'\n   FROM ((profiles p',
    E',\n        CASE\n            WHEN (p.id = auth.uid()) THEN p.can_message_players\n            ELSE NULL::boolean\n        END AS can_message_players\n   FROM ((profiles p');
  if v_new = v_old then raise exception 'profiles_with_stats: место вставки не найдено'; end if;
  execute 'create or replace view public.profiles_with_stats as ' || v_new;
end
$do$;

-- Может ли текущий пользователь писать игрокам в поддержку (RPC ниже и правило хранилища).
create function public.can_message_players()
 returns boolean
 language sql
 stable
 security definer
 set search_path to 'public'
as $function$
  select exists (select 1 from public.profiles where id = auth.uid() and (is_super_admin or (is_admin and can_message_players)));
$function$;
revoke all on function public.can_message_players() from public, anon;
grant execute on function public.can_message_players() to authenticated, service_role;

-- Выдача прав: новый параметр в конце, по умолчанию false (как у остальных).
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
  p_can_view_stats boolean default false,
  p_can_view_limits boolean default false,
  p_can_message_players boolean default false
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
  v_message boolean := p_is_admin and p_can_message_players;
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and is_super_admin) then raise exception 'not authorized'; end if;
  if p_user_id = auth.uid() then raise exception 'cannot change your own admin status'; end if;
  if exists (select 1 from public.profiles where id = p_user_id and is_super_admin) then raise exception 'cannot change another super admin'; end if;
  select display_name into v_target_name from public.profiles where id = p_user_id;
  if not found then raise exception 'user not found'; end if;
  update public.profiles set is_admin = p_is_admin, can_moderate_reports = v_moderate, can_block_users = v_block, can_add_catch_manually = v_catch,
    can_view_all_users = v_users, can_add_catch_from_gallery = v_gallery, can_review_panoramas = v_panoramas, can_view_stats = v_stats,
    can_view_limits = v_limits, can_message_players = v_message
  where id = p_user_id;
  if v_moderate then v_perms := v_perms || 'жалобы, '; end if;
  if v_block then v_perms := v_perms || 'блокировка, '; end if;
  if v_catch then v_perms := v_perms || 'улов без гео, '; end if;
  if v_users then v_perms := v_perms || 'список юзеров, '; end if;
  if v_gallery then v_perms := v_perms || 'улов из галереи, '; end if;
  if v_panoramas then v_perms := v_perms || 'панорамы, '; end if;
  if v_stats then v_perms := v_perms || 'статистика, '; end if;
  if v_limits then v_perms := v_perms || 'лимиты, '; end if;
  if v_message then v_perms := v_perms || 'писать игрокам, '; end if;
  v_perms := rtrim(v_perms, ', ');
  insert into public.admin_actions (admin_id, action, target_user_id, details)
  values (auth.uid(), case when p_is_admin then 'grant_admin' else 'revoke_admin' end, p_user_id,
    case when not p_is_admin then 'Забрал права админа у: ' || v_target_name
         when v_perms = '' then 'Выдал права админа: ' || v_target_name || ' (без доп. прав)'
         else 'Выдал права админа: ' || v_target_name || ' (' || v_perms || ')' end);
end; $function$;
revoke all on function public.admin_set_admin(uuid, boolean, boolean, boolean, boolean, boolean, boolean, boolean, boolean, boolean, boolean) from public, anon;
grant execute on function public.admin_set_admin(uuid, boolean, boolean, boolean, boolean, boolean, boolean, boolean, boolean, boolean, boolean) to authenticated, service_role;

-- Настоящие (не замаскированные) права админа для окна «Права»: новое поле в конце.
drop function public.get_admin_permissions(uuid);
create function public.get_admin_permissions(p_user_id uuid)
 returns table(is_admin boolean, can_moderate_reports boolean, can_block_users boolean, can_add_catch_manually boolean, can_view_all_users boolean, can_add_catch_from_gallery boolean, can_review_panoramas boolean, can_view_stats boolean, can_view_limits boolean, can_message_players boolean)
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and is_super_admin) then raise exception 'not authorized'; end if;
  return query select p.is_admin, p.can_moderate_reports, p.can_block_users, p.can_add_catch_manually, p.can_view_all_users, p.can_add_catch_from_gallery, p.can_review_panoramas, p.can_view_stats, p.can_view_limits, p.can_message_players
    from public.profiles p where p.id = p_user_id;
end; $function$;
revoke all on function public.get_admin_permissions(uuid) from public, anon;
grant execute on function public.get_admin_permissions(uuid) to authenticated, service_role;

-- Админ пишет игроку: без p_ticket_id — новое обращение (первое сообщение от поддержки),
-- с ним — сообщение в существующее обращение этого игрока. Фото — из своей папки в support.
-- Игроку — то же уведомление, что и на ответ из бота (support_reply). Возвращает id обращения.
create function public.admin_send_support_message(p_user_id uuid, p_body text, p_ticket_id bigint default null, p_photo_path text default null)
 returns bigint
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_uid uuid := auth.uid();
  v_body text := btrim(coalesce(p_body, ''));
  v_name text;
  v_ticket bigint := p_ticket_id;
begin
  if not public.can_message_players() then raise exception 'not authorized'; end if;
  if p_user_id = v_uid then raise exception 'SUPPORT:self'; end if;
  select display_name into v_name from public.profiles where id = p_user_id;
  if not found then raise exception 'user not found'; end if;
  if char_length(v_body) < 1 or char_length(v_body) > 1000 then raise exception 'SUPPORT:length'; end if;
  if p_photo_path is not null and split_part(p_photo_path, '/', 1) <> v_uid::text then raise exception 'SUPPORT:photo'; end if;
  if v_ticket is null then
    insert into public.support_tickets (user_id, body, photo_path, started_by, answered_at)
    values (p_user_id, v_body, p_photo_path, v_uid, now()) returning id into v_ticket;
    insert into public.admin_actions (admin_id, action, target_user_id, details)
    values (v_uid, 'support_message', p_user_id, 'Написал игроку в поддержку (обращение #' || v_ticket || '): ' || v_name);
  else
    if not exists (select 1 from public.support_tickets where id = v_ticket and user_id = p_user_id) then raise exception 'SUPPORT:no_ticket'; end if;
    insert into public.support_replies (ticket_id, admin_id, body, photo_path) values (v_ticket, v_uid, v_body, p_photo_path);
    update public.support_tickets set answered_at = now() where id = v_ticket;
  end if;
  insert into public.notifications (user_id, kind, actor_id, payload)
  values (p_user_id, 'support_reply', v_uid, jsonb_build_object('ticket_id', v_ticket, 'text', left(v_body, 300)));
  return v_ticket;
end; $function$;
revoke all on function public.admin_send_support_message(uuid, text, bigint, text) from public, anon;
grant execute on function public.admin_send_support_message(uuid, text, bigint, text) to authenticated, service_role;

-- Переписка игрока для окна админа: последние 20 обращений, в каждом все сообщения (порядок — в приложении).
create function public.admin_get_support_chat(p_user_id uuid)
 returns jsonb
 language plpgsql
 stable
 security definer
 set search_path to 'public'
as $function$
begin
  if not public.can_message_players() then raise exception 'not authorized'; end if;
  return coalesce((
    select jsonb_agg(x.j order by x.created_at desc) from (
      select t.created_at, jsonb_build_object(
        'id', t.id, 'created_at', t.created_at, 'answered', t.answered_at is not null,
        'messages',
          jsonb_build_array(jsonb_build_object('from', case when t.started_by is null then 'player' else 'support' end,
            'body', t.body, 'photo_path', t.photo_path, 'created_at', t.created_at, 'author', sa.display_name))
          || coalesce((select jsonb_agg(jsonb_build_object('from', 'player', 'body', m.body, 'photo_path', m.photo_path, 'created_at', m.created_at))
                       from public.support_messages m where m.ticket_id = t.id), '[]'::jsonb)
          || coalesce((select jsonb_agg(jsonb_build_object('from', 'support', 'body', r.body, 'photo_path', r.photo_path, 'created_at', r.created_at, 'author', ra.display_name))
                       from public.support_replies r left join public.profiles ra on ra.id = r.admin_id where r.ticket_id = t.id), '[]'::jsonb)
      ) as j
      from public.support_tickets t left join public.profiles sa on sa.id = t.started_by
      where t.user_id = p_user_id
      order by t.created_at desc
      limit 20
    ) x), '[]'::jsonb);
end; $function$;
revoke all on function public.admin_get_support_chat(uuid) from public, anon;
grant execute on function public.admin_get_support_chat(uuid) to authenticated, service_role;

-- Ответ из бота (reply на пересланное сообщение): теперь и админ с флагом, не только супер-админ.
-- Сигнатура та же — CREATE OR REPLACE сохраняет права.
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
  select id into v_admin from public.profiles where telegram_id = p_admin_telegram and (is_super_admin or (is_admin and can_message_players));
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

-- Фото в чате поддержки: до сих пор их читал только сервер (временная ссылка для Telegram).
-- Теперь временную ссылку берёт приложение: игрок — на свои файлы и на фото в своих обращениях
-- (в том числе от поддержки), админ с правом писать игрокам — на все.
create policy "support photos readable in own chats" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'support' and (
      (storage.foldername(name))[1] = (auth.uid())::text
      or public.can_message_players()
      or exists (select 1 from public.support_tickets t where t.user_id = auth.uid() and t.photo_path = objects.name)
      or exists (select 1 from public.support_replies r join public.support_tickets t on t.id = r.ticket_id
                 where t.user_id = auth.uid() and r.photo_path = objects.name)
    )
  );
