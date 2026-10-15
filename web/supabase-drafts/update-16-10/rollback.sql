-- Rollback for owner_territory_color + edit_my_catch.
-- The new view column / co_holders key are additive and harmless: leave them.
drop function if exists public.edit_my_catch(bigint, integer, numeric, text, text);
