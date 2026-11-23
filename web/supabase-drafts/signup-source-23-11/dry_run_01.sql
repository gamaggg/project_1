-- Прогон 01_signup_source.sql и его отката в одной транзакции, которая всегда откатывается (23.11.2026).
-- От имени самого нового игрока (аккаунт моложе 3 дней) и старого игрока проверяет функцию set_signup_source,
-- что таблица закрыта для клиентов, что гость не может вызвать функцию, и что откат убирает всё.
-- Ответ — в тексте ошибки «ПРОГОН 01 …».
do $dry$
declare
  u_new uuid; u_old uuid; new_age interval;
  r1 jsonb; r2 jsonb; r3 jsonb; r4 jsonb; r5 jsonb;
  saved text; sel_err text := 'нет ошибки'; anon_err text := 'нет ошибки';
  gone boolean;
begin
  set local lock_timeout = '500ms';
  select id, now() - created_at into u_new, new_age from public.profiles order by created_at desc limit 1;
  select id into u_old from public.profiles where created_at < now() - interval '30 days' order by created_at limit 1;

  -- ===== 01_signup_source.sql =====
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
  -- ===== проверки =====
  perform set_config('request.jwt.claims', json_build_object('sub', u_new, 'role', 'authenticated')::text, true);
  set local role authenticated;
  r1 := public.set_signup_source(' TikTok ');
  r2 := public.set_signup_source('instagram');
  r3 := public.set_signup_source('плохая метка!');
  begin
    perform count(*) from public.signup_sources;
  exception when others then sel_err := sqlerrm;
  end;
  reset role;
  select source into saved from public.signup_sources where user_id = u_new;

  perform set_config('request.jwt.claims', json_build_object('sub', u_old, 'role', 'authenticated')::text, true);
  set local role authenticated;
  r4 := public.set_signup_source('threads');
  reset role;

  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  set local role anon;
  begin
    r5 := public.set_signup_source('youtube');
  exception when others then anon_err := sqlerrm;
  end;
  reset role;

  -- ===== откат =====
drop function if exists public.set_signup_source(text);
drop table if exists public.signup_sources;
  gone := to_regclass('public.signup_sources') is null and to_regprocedure('public.set_signup_source(text)') is null;

  raise exception 'ПРОГОН 01 (всё откатано): новый игрок (возраст %): « TikTok » → %, сохранено «%»; повторно instagram → %; плохая метка → %; select из таблицы клиентом → %; старый игрок threads → %; гость → %; после отката таблицы и функции нет: %',
    date_trunc('minute', new_age), r1, saved, r2, r3, sel_err, r4, anon_err, gone;
end
$dry$;
