-- Большое обновление: «Я на рыбалке» (решение 05.10 по отзывам игроков).
-- Игрок включает режим в приложении → бот закрепляет сообщение с кнопкой камеры и раз в
-- 1,5 ч тихо напоминает сфоткать улов; через 8 ч (или по кнопке) режим заканчивается,
-- сообщение откреплятся и превращается в итог. Отправка — маршрут /api/telegram/fishing
-- (сразу после старта и по cron каждые 5 минут, cron включается в релизной миграции).
-- Нынешний клиент таблицу и функции не знает.

create table public.fishing_sessions (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  started_at timestamptz not null default now(),
  ends_at timestamptz not null default now() + interval '8 hours',
  ended_at timestamptz,             -- закончил сам (кнопкой) или закрыта по времени
  chat_id bigint,                   -- куда бот отправил закреплённое сообщение
  message_id bigint,                -- закреплённое сообщение
  reminder_message_id bigint,       -- последнее напоминание (удаляется при следующем)
  reminded_at timestamptz,
  closed_at timestamptz             -- сообщение в боте уже откреплено и превращено в итог
);
-- Одна открытая рыбалка на игрока.
create unique index fishing_sessions_one_open on public.fishing_sessions (user_id) where ended_at is null;
create index fishing_sessions_unclosed on public.fishing_sessions (started_at) where closed_at is null;

alter table public.fishing_sessions enable row level security;
create policy fishing_sessions_own_select on public.fishing_sessions for select to authenticated using (user_id = auth.uid());
revoke all on public.fishing_sessions from public, anon, authenticated;
grant select on public.fishing_sessions to authenticated;
grant all on public.fishing_sessions to service_role;

-- Начать рыбалку: прошлая открытая (если была) закрывается, новая — на 8 часов.
create function public.start_fishing()
 returns public.fishing_sessions
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_uid uuid := auth.uid();
  v_row public.fishing_sessions;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  update public.fishing_sessions set ended_at = now() where user_id = v_uid and ended_at is null;
  insert into public.fishing_sessions (user_id) values (v_uid) returning * into v_row;
  return v_row;
end;
$function$;
revoke all on function public.start_fishing() from public, anon;
grant execute on function public.start_fishing() to authenticated, service_role;

-- Закончить рыбалку.
create function public.stop_fishing()
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  update public.fishing_sessions set ended_at = now() where user_id = auth.uid() and ended_at is null;
end;
$function$;
revoke all on function public.stop_fishing() from public, anon;
grant execute on function public.stop_fishing() to authenticated, service_role;
