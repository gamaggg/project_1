-- Метка источника регистрации (23.11.2026).
-- Ссылки из соцсетей ведут на catchrange.com/?from=<площадка> (tiktok, instagram, threads, youtube, facebook…).
-- Приложение запоминает метку до регистрации и после онбординга отдаёт её сюда.
-- Отдельная таблица, а не столбец в profiles: profiles не трогаем (живые представления), игроки метки не видят.
set local lock_timeout = '3s';

create table if not exists public.signup_sources (
  user_id    uuid primary key references public.profiles(id) on delete cascade,
  source     text not null check (source ~ '^[a-z0-9_-]{1,32}$'),
  created_at timestamptz not null default now()
);
alter table public.signup_sources enable row level security;
-- Читать и писать напрямую нельзя никому из клиентов: только через функцию ниже и сервисную роль.
revoke all on table public.signup_sources from public, anon, authenticated;
grant select, insert, update, delete on table public.signup_sources to service_role;

-- Запомнить метку для своего аккаунта. Только новый аккаунт (не старше 3 дней, как у claim_referral)
-- и только один раз: первая записанная метка остаётся.
create or replace function public.set_signup_source(p_source text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_uid uuid := auth.uid();
  v_src text := lower(btrim(coalesce(p_source, '')));
  v_created timestamptz;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  if v_src !~ '^[a-z0-9_-]{1,32}$' then return jsonb_build_object('ok', false, 'reason', 'bad_source'); end if;
  select created_at into v_created from public.profiles where id = v_uid;
  if v_created is null then return jsonb_build_object('ok', false, 'reason', 'no_profile'); end if;
  if v_created < now() - interval '3 days' then return jsonb_build_object('ok', false, 'reason', 'not_new'); end if;
  insert into public.signup_sources (user_id, source) values (v_uid, v_src) on conflict (user_id) do nothing;
  if not found then return jsonb_build_object('ok', false, 'reason', 'already'); end if;
  return jsonb_build_object('ok', true);
end;
$function$;

revoke all on function public.set_signup_source(text) from public, anon;
grant execute on function public.set_signup_source(text) to authenticated;
