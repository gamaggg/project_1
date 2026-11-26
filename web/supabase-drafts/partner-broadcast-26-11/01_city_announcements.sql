-- partner-broadcast-26-11 / 01 — пост суперадмина только для одного города (просьба владельца 26.11.2026:
-- из карточки партнёра сделать рассылку в «Активность» и в бот тем, у кого выбран город партнёра).
--
-- 1) announcements.city: NULL — пост для всех (как раньше), иначе id города из city_config.
-- 2) Читать пост с городом может только игрок, у которого в профиле этот город (profiles.city), и суперадмин
--    (видит все свои посты). Гость без входа видит только посты для всех.
-- 3) admin_post_announcement получает p_city (по умолчанию NULL — старые вызовы работают как раньше) и теперь
--    возвращает, сколько сообщений поставлено в очередь бота. Тип ответа меняется, поэтому DROP + CREATE;
--    все прежние DEFAULT сохранены, права выданы заново (как было: authenticated и service_role, без anon).
--    С городом в бот уходит только тем, чей Telegram связан с аккаунтом этого города и кто не остановил бота.

alter table public.announcements
  add column if not exists city text references public.city_config(id);

drop policy if exists "announcements readable by anyone" on public.announcements;
create policy "announcements readable by anyone" on public.announcements
  for select using (
    city is null
    or city = (select p.city from public.profiles p where p.id = (select auth.uid()))
    or coalesce((select p.is_super_admin from public.profiles p where p.id = (select auth.uid())), false)
  );

drop function if exists public.admin_post_announcement(text, text, text, boolean, text);

create function public.admin_post_announcement(
  p_body text,
  p_button_label text default null,
  p_button_url text default null,
  p_broadcast_telegram boolean default false,
  p_photo_url text default null,
  p_city text default null
)
returns integer
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_id bigint;
  v_city text := nullif(trim(coalesce(p_city, '')), '');
  v_queued integer := 0;
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
  if v_city is not null and not exists (select 1 from public.city_config where id = v_city) then
    raise exception 'Неизвестный город: %', v_city;
  end if;

  insert into public.announcements (author_id, body, button_label, button_url, broadcast_telegram, photo_url, city)
  values (
    auth.uid(),
    trim(p_body),
    nullif(trim(coalesce(p_button_label, '')), ''),
    nullif(trim(coalesce(p_button_url, '')), ''),
    p_broadcast_telegram,
    nullif(trim(coalesce(p_photo_url, '')), ''),
    v_city
  )
  returning id into v_id;

  if p_broadcast_telegram then
    if v_city is null then
      insert into public.telegram_broadcast_queue (announcement_id, chat_id)
      select v_id, chat_id from public.telegram_bot_starts;
    else
      insert into public.telegram_broadcast_queue (announcement_id, chat_id)
      select v_id, s.chat_id
      from public.telegram_bot_starts s
      join public.profiles p on p.telegram_id = s.chat_id
      where p.city = v_city and s.stopped_at is null;
    end if;
    get diagnostics v_queued = row_count;
  end if;

  return v_queued;
end;
$function$;

revoke all on function public.admin_post_announcement(text, text, text, boolean, text, text) from public, anon;
grant execute on function public.admin_post_announcement(text, text, text, boolean, text, text) to authenticated, service_role;
