-- «Нет твоего города?» на шаге выбора города при регистрации (22.11.2026, просьба владельца).
-- Игрок вписывает город, которого нет в игре: запрос сохраняется в city_requests, а супер-админам приходит
-- уведомление в «Активность» и в Telegram — тем же путём, что тревоги (_system_alert, kind = system_alert),
-- но с payload.variant = 'city_request': приложение и бот рисуют его как «Просят добавить город», а не тревогу.
-- Ключ у каждого запроса свой ('city_request:<id>'), поэтому _system_alert (молчит час после такого же ключа)
-- пропускает все запросы. Ограничения: от 2 до 80 знаков, не чаще раза в минуту и не больше 3 в сутки с игрока.
-- Откат: 01_city_requests_ROLLBACK.sql
create table public.city_requests (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  city_text text not null check (char_length(city_text) between 2 and 80),
  created_at timestamptz not null default now()
);
create index city_requests_user_created_idx on public.city_requests (user_id, created_at desc);
-- Только через request_city и админские запросы: клиентам таблица не видна.
alter table public.city_requests enable row level security;
revoke all on public.city_requests from anon, authenticated;
grant all on public.city_requests to service_role;

create or replace function public.request_city(p_city text) returns bigint
  language plpgsql security definer set search_path to 'public'
as $$
declare
  v_uid uuid := auth.uid();
  v_text text := regexp_replace(btrim(coalesce(p_city, '')), '\s+', ' ', 'g');
  v_id bigint;
  v_name text;
  v_pid text;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  if coalesce((select is_blocked from public.profiles where id = v_uid), false) then raise exception 'account blocked'; end if;
  if char_length(v_text) < 2 or char_length(v_text) > 80 then raise exception 'CITY_REQUEST:length'; end if;
  if exists (select 1 from public.city_requests where user_id = v_uid and created_at > now() - interval '1 minute') then
    raise exception 'CITY_REQUEST:too_fast';
  end if;
  if (select count(*) from public.city_requests where user_id = v_uid and created_at > now() - interval '24 hours') >= 3 then
    raise exception 'CITY_REQUEST:too_many';
  end if;
  insert into public.city_requests (user_id, city_text) values (v_uid, v_text) returning id into v_id;
  select p.display_name, p.public_id::text into v_name, v_pid from public.profiles p where p.id = v_uid;
  perform public._system_alert(
    'city_request:' || v_id,
    format(E'Город: %s\nКто: %s%s', v_text, coalesce(nullif(btrim(v_name), ''), 'игрок'), coalesce(' · ID ' || v_pid, '')),
    jsonb_build_object('variant', 'city_request', 'city', v_text, 'user_public_id', v_pid));
  return v_id;
end;
$$;
revoke all on function public.request_city(text) from public, anon;
grant execute on function public.request_city(text) to authenticated;
