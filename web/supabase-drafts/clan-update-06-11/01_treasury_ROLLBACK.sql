-- Rollback of 01_treasury.sql. Everything it adds is dropped; nothing existing was edited, so nothing else to restore.
-- Coins already moved into treasuries (donations, tax, rent) are NOT returned by this script: if the
-- treasury was used for real, first run the refund block at the bottom (it pays donations and tax back).
drop trigger if exists clan_tax_on_catch on public.coin_transactions;
drop function if exists public._clan_tax_on_catch();
drop function if exists public.clan_rent_tick();
drop function if exists public.admin_set_clan_economy(jsonb);
drop function if exists public.clan_set_goal(text);
drop function if exists public.clan_set_tax(int);
drop function if exists public.clan_treasury_donate(int);
drop function if exists public.get_clan_treasury(bigint);
drop function if exists public._clan_leader_check(bigint);
drop function if exists public._clan_treasury_add(bigint, int, text, uuid, text);
drop function if exists public._clan_treasury_cap(bigint);
drop table if exists public.clan_treasury_log;
drop table if exists public.clan_treasury;
drop table if exists public.clan_economy;

-- REFUND BLOCK (run BEFORE the drops above, only if real coins went in):
-- update public.profiles p set coins = coins + x.s from (
--   select user_id, sum(amount) s from public.clan_treasury_log where kind in ('donation', 'tax') and user_id is not null group by user_id) x
--   where p.id = x.user_id;
-- insert into public.coin_transactions (user_id, amount, reason, label)
--   select user_id, sum(amount), 'clan_refund', 'Возврат из общака клана' from public.clan_treasury_log
--   where kind in ('donation', 'tax') and user_id is not null group by user_id;
