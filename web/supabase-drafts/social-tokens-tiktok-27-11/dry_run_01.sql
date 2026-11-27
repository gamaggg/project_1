-- Прогон в откатываемой транзакции: после применения строка tiktok вставляется, а чужое имя нет.
do $$
begin
  alter table public.social_tokens drop constraint if exists social_tokens_name_check;
  alter table public.social_tokens add constraint social_tokens_name_check check (name in ('threads', 'tiktok'));
  insert into public.social_tokens(name, token, expires_at) values ('tiktok', repeat('x', 30), now() + interval '1 year');
  begin
    insert into public.social_tokens(name, token, expires_at) values ('other', repeat('x', 30), now() + interval '1 year');
    raise exception 'DRYRUN_FAIL: other name accepted';
  exception when check_violation then null;
  end;
  raise exception 'DRYRUN_OK: tiktok accepted, other rejected (rolled back)';
end $$;
