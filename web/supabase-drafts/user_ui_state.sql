-- Per-account «seen / hidden» flags for one-time UI: which achievements'
-- popups were shown, which week's recap sticker was hidden, the last week's
-- top-3 and clan-battle ceremonies, the spotlight tours. They lived in each
-- device's localStorage, so the same popup came back on the next device (phone
-- browser → Telegram → desktop) — and on iPhone Telegram even on the same one,
-- whenever it dropped the Mini App's storage. One small row per key per user,
-- read once per launch (useUiState); localStorage stays as a cache and for
-- guests.
create table public.user_ui_state (
  user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  key text not null check (char_length(key) between 1 and 64),
  value jsonb not null check (pg_column_size(value) <= 8192),
  updated_at timestamptz not null default now(),
  primary key (user_id, key)
);

alter table public.user_ui_state enable row level security;

create policy "own ui state: read" on public.user_ui_state
  for select to authenticated using (user_id = auth.uid());
create policy "own ui state: add" on public.user_ui_state
  for insert to authenticated with check (user_id = auth.uid());
create policy "own ui state: change" on public.user_ui_state
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- New public tables need their grants spelled out (see project notes).
grant select, insert, update on public.user_ui_state to authenticated;
