-- Поддержка как чат (решение 06.10, после релиза): игрок дописывает в то же обращение, а не
-- создаёт новое. Каждое сообщение игрока уходит супер-админам в бота (маршрут /api/support/notify
-- с messageId) и записывается в support_telegram_messages — ответ reply на любое из них
-- попадает в это же обращение (answer_support_ticket, без изменений).
-- Новое сообщение снова ставит обращение в «ждёт ответа» (answered_at = null).

create table public.support_messages (
  id bigint generated always as identity primary key,
  ticket_id bigint not null references public.support_tickets(id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 1000),
  photo_path text,
  created_at timestamptz not null default now()
);
create index support_messages_ticket_idx on public.support_messages (ticket_id, created_at);
alter table public.support_messages enable row level security;
create policy support_messages_own_select on public.support_messages for select to authenticated
  using (exists (select 1 from public.support_tickets t where t.id = ticket_id and t.user_id = auth.uid()));
revoke all on public.support_messages from public, anon, authenticated;
grant select on public.support_messages to authenticated;
grant all on public.support_messages to service_role;

-- Дописать в своё обращение: не чаще раза в 10 секунд и не больше 30 сообщений в сутки.
create function public.add_support_message(p_ticket_id bigint, p_body text, p_photo_path text default null)
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
  if not exists (select 1 from public.support_tickets where id = p_ticket_id and user_id = v_uid) then
    raise exception 'SUPPORT:no_ticket';
  end if;
  if char_length(v_body) < 1 or char_length(v_body) > 1000 then raise exception 'SUPPORT:length'; end if;
  if p_photo_path is not null and split_part(p_photo_path, '/', 1) <> v_uid::text then raise exception 'SUPPORT:photo'; end if;
  if exists (select 1 from public.support_messages m join public.support_tickets t on t.id = m.ticket_id
             where t.user_id = v_uid and m.created_at > now() - interval '10 seconds') then
    raise exception 'SUPPORT:too_fast';
  end if;
  if (select count(*) from public.support_messages m join public.support_tickets t on t.id = m.ticket_id
      where t.user_id = v_uid and m.created_at > now() - interval '24 hours') >= 30 then
    raise exception 'SUPPORT:too_many';
  end if;
  insert into public.support_messages (ticket_id, body, photo_path) values (p_ticket_id, v_body, p_photo_path) returning id into v_id;
  update public.support_tickets set answered_at = null where id = p_ticket_id;
  return v_id;
end;
$function$;
revoke all on function public.add_support_message(bigint, text, text) from public, anon;
grant execute on function public.add_support_message(bigint, text, text) to authenticated;
