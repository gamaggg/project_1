-- Большое обновление: «Написать в поддержку» (решение 06.10).
-- Игрок пишет из «Вопросов и ответов» (текст до 1000 символов + скриншот), бот присылает
-- обращение супер-админам в Telegram, ответ — reply на это сообщение в боте; игроку ответ
-- приходит в «Активность» (notification kind 'support_reply'; в Telegram — после релиза,
-- белый список в release/game_notifications.sql).
-- Отправка админам — маршрут /api/support/notify, ответы — webhook бота.

-- Скриншоты — в закрытом хранилище: загрузить можно только в свою папку, читать — только
-- сервер (временная ссылка для Telegram).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('support', 'support', false, 5242880, array['image/jpeg', 'image/png', 'image/webp']);
create policy "users upload their own support screenshots" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'support' and (storage.foldername(name))[1] = (auth.uid())::text);

create table public.support_tickets (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 1000),
  photo_path text,
  created_at timestamptz not null default now(),
  answered_at timestamptz
);
create index support_tickets_user_idx on public.support_tickets (user_id, created_at desc);
alter table public.support_tickets enable row level security;
create policy support_tickets_own_select on public.support_tickets for select to authenticated using (user_id = auth.uid());
revoke all on public.support_tickets from public, anon, authenticated;
grant select on public.support_tickets to authenticated;
grant all on public.support_tickets to service_role;

create table public.support_replies (
  id bigint generated always as identity primary key,
  ticket_id bigint not null references public.support_tickets(id) on delete cascade,
  admin_id uuid references public.profiles(id) on delete set null,
  body text not null check (char_length(btrim(body)) between 1 and 4000),
  created_at timestamptz not null default now()
);
create index support_replies_ticket_idx on public.support_replies (ticket_id, created_at);
alter table public.support_replies enable row level security;
create policy support_replies_own_select on public.support_replies for select to authenticated
  using (exists (select 1 from public.support_tickets t where t.id = ticket_id and t.user_id = auth.uid()));
revoke all on public.support_replies from public, anon, authenticated;
grant select on public.support_replies to authenticated;
grant all on public.support_replies to service_role;

-- Какое сообщение в чате админа к какому обращению — чтобы ответ (reply) нашёл игрока.
create table public.support_telegram_messages (
  chat_id bigint not null,
  message_id bigint not null,
  ticket_id bigint not null references public.support_tickets(id) on delete cascade,
  primary key (chat_id, message_id)
);
alter table public.support_telegram_messages enable row level security;
revoke all on public.support_telegram_messages from public, anon, authenticated;
grant all on public.support_telegram_messages to service_role;

-- Новое обращение: не чаще раза в минуту и не больше 5 за сутки.
create function public.create_support_ticket(p_body text, p_photo_path text default null)
 returns bigint
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_uid uuid := auth.uid();
  v_body text := btrim(coalesce(p_body, ''));
  v_id bigint;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  if coalesce((select is_blocked from public.profiles where id = v_uid), false) then raise exception 'account blocked'; end if;
  if char_length(v_body) < 1 or char_length(v_body) > 1000 then raise exception 'SUPPORT:length'; end if;
  if p_photo_path is not null and split_part(p_photo_path, '/', 1) <> v_uid::text then raise exception 'SUPPORT:photo'; end if;
  if exists (select 1 from public.support_tickets where user_id = v_uid and created_at > now() - interval '1 minute') then
    raise exception 'SUPPORT:too_fast';
  end if;
  if (select count(*) from public.support_tickets where user_id = v_uid and created_at > now() - interval '24 hours') >= 5 then
    raise exception 'SUPPORT:too_many';
  end if;
  insert into public.support_tickets (user_id, body, photo_path) values (v_uid, v_body, p_photo_path) returning id into v_id;
  return v_id;
end;
$function$;
revoke all on function public.create_support_ticket(text, text) from public, anon;
grant execute on function public.create_support_ticket(text, text) to authenticated;

-- Ответ супер-админа из Telegram (вызывает webhook бота). Возвращает id игрока.
create function public.answer_support_ticket(p_ticket_id bigint, p_admin_telegram bigint, p_body text)
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
revoke all on function public.answer_support_ticket(bigint, bigint, text) from public, anon, authenticated;
grant execute on function public.answer_support_ticket(bigint, bigint, text) to service_role;
