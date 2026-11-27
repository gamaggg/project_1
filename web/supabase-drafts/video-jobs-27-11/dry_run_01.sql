-- Прогон в откатываемой транзакции: создаётся таблица и корзина, вставка работает, чужой статус отвергается.
do $$
begin
  create table public.video_jobs (
    id bigint generated always as identity primary key, chat_id bigint not null, src_path text not null,
    caption_in text not null default '',
    status text not null default 'new' check (status in ('new','working','ready','changes','done','failed')),
    result_path text, caption_out text, feedback text, token text not null, sent_at timestamptz, bot_message_id bigint, error text,
    created_at timestamptz not null default now(), updated_at timestamptz not null default now());
  insert into public.video_jobs(chat_id, src_path, token) values (1, 'in/x.mp4', 'tok');
  begin
    insert into public.video_jobs(chat_id, src_path, token, status) values (1, 'in/y.mp4', 'tok', 'bogus');
    raise exception 'DRYRUN_FAIL: bad status accepted';
  exception when check_violation then null;
  end;
  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('social-videos-dryrun', 'social-videos-dryrun', true, 52428800, array['video/mp4']);
  raise exception 'DRYRUN_OK: table and bucket created, bad status rejected (rolled back)';
end $$;
