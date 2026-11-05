-- Rollback of 02_buff_hq.sql. Restores part 1's clan_rent_tick (without the HQ double rent) by re-running it from 01_treasury.sql.
drop trigger if exists clan_buff_bonus on public.coin_transactions;
drop function if exists public._clan_buff_bonus();
drop function if exists public.clan_hq_tick();
drop function if exists public.clan_hq_defend(text, uuid);
drop function if exists public.clan_hq_attack(text, uuid, int);
drop function if exists public.clan_hq_place(text);
drop function if exists public.clan_buff_rsvp(bigint, boolean);
drop function if exists public.clan_buff_launch(int);
drop table if exists public.clan_sieges;
drop table if exists public.clan_hq;
drop table if exists public.clan_buff_rsvp;
drop table if exists public.clan_buffs;
drop function if exists public._clan_treasury_spend(bigint, int, text, uuid, text);
-- Then re-create clan_rent_tick() from 01_treasury.sql (the version without the HQ term).
-- Coins the buff paid out (reason 'clan_buff') stay with the players, treasury spends stay spent: nothing to give back.
