-- The language a player picked in the app (ru / en / ka). The server needs it
-- to write the Telegram messages (notifications, reminders) in their language;
-- empty means Russian. Written only through set_my_language.
alter table public.profiles add column if not exists language text check (language in ('ru', 'en', 'ka'));

create or replace function public.set_my_language(p_lang text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if p_lang is null or p_lang not in ('ru', 'en', 'ka') then raise exception 'bad language'; end if;
  update public.profiles set language = p_lang where id = auth.uid() and language is distinct from p_lang;
end;
$$;

revoke all on function public.set_my_language(text) from public, anon;
grant execute on function public.set_my_language(text) to authenticated;
