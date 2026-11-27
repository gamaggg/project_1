-- Откат 01_rare_wins.sql (27.11.2026): убрать триггеры, функции и строки «Слоты: джекпот» на 0 монет.
-- Уведомления, которые уже ушли, остаются в notifications (как любая тревога).
drop trigger if exists slot_spins_rare on public.slot_spins;
drop trigger if exists secret_box_opens_rare on public.secret_box_opens;
drop function if exists public._slot_spin_rare();
drop function if exists public._secret_box_open_rare();
drop function if exists public._rare_win_alert(uuid, text, timestamptz, text);
drop function if exists public._lower_first(text);
delete from public.coin_transactions where reason = 'slots_jackpot' and amount = 0;
