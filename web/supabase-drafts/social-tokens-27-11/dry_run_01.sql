-- Прогон 01_social_tokens.sql без следов: всё внутри блока, который заканчивается ошибкой.
do $$
declare r text;
begin
  create table if not exists public.social_tokens (
    name         text primary key check (name in ('threads')),
    token        text not null check (length(token) > 20),
    expires_at   timestamptz not null,
    refreshed_at timestamptz not null default now()
  );
  alter table public.social_tokens enable row level security;
  revoke all on table public.social_tokens from public, anon, authenticated;
  grant select, insert, update, delete on table public.social_tokens to service_role;

  insert into public.social_tokens (name, token, expires_at) values ('threads', repeat('x', 40), now() + interval '60 days');
  -- повторная запись того же имени обновляет строку
  insert into public.social_tokens (name, token, expires_at) values ('threads', repeat('y', 40), now() + interval '60 days')
    on conflict (name) do update set token = excluded.token, expires_at = excluded.expires_at, refreshed_at = now();
  if (select count(*) from public.social_tokens) <> 1 then raise exception 'ожидалась одна строка'; end if;
  begin
    insert into public.social_tokens (name, token, expires_at) values ('other', repeat('z', 40), now());
    raise exception 'чужое имя не должно проходить';
  exception when check_violation then null;
  end;
  select string_agg(grantee || ':' || privilege_type, ', ' order by grantee, privilege_type) into r
    from information_schema.role_table_grants where table_schema = 'public' and table_name = 'social_tokens' and grantee in ('anon', 'authenticated', 'service_role');
  raise exception 'ПРОГОН ОК (всё откатано). Права: %', r;
end $$;
