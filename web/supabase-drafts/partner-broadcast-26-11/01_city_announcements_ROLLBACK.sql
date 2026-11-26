-- Откат partner-broadcast-26-11 / 01. Посты с городом удаляются (вместе с их очередью в бот, ON DELETE CASCADE):
-- без столбца city они стали бы видны всем городам.

delete from public.announcements where city is not null;

drop function if exists public.admin_post_announcement(text, text, text, boolean, text, text);

create function public.admin_post_announcement(p_body text, p_button_label text default null::text, p_button_url text default null::text, p_broadcast_telegram boolean default false, p_photo_url text default null::text)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_id bigint;
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and is_super_admin) then
    raise exception 'not authorized';
  end if;
  if length(trim(p_body)) = 0 then
    raise exception 'Текст не может быть пустым';
  end if;
  if length(p_body) > 2000 then
    raise exception 'Слишком длинный текст (максимум 2000 символов)';
  end if;
  if (trim(coalesce(p_button_label, '')) = '') <> (trim(coalesce(p_button_url, '')) = '') then
    raise exception 'Укажи и текст кнопки, и ссылку — или оставь оба поля пустыми';
  end if;

  insert into public.announcements (author_id, body, button_label, button_url, broadcast_telegram, photo_url)
  values (
    auth.uid(),
    trim(p_body),
    nullif(trim(coalesce(p_button_label, '')), ''),
    nullif(trim(coalesce(p_button_url, '')), ''),
    p_broadcast_telegram,
    nullif(trim(coalesce(p_photo_url, '')), '')
  )
  returning id into v_id;

  if p_broadcast_telegram then
    insert into public.telegram_broadcast_queue (announcement_id, chat_id)
    select v_id, chat_id from public.telegram_bot_starts;
  end if;
end;
$function$;

revoke all on function public.admin_post_announcement(text, text, text, boolean, text) from public, anon;
grant execute on function public.admin_post_announcement(text, text, text, boolean, text) to authenticated, service_role;

drop policy if exists "announcements readable by anyone" on public.announcements;
create policy "announcements readable by anyone" on public.announcements for select using (true);

alter table public.announcements drop column if exists city;
