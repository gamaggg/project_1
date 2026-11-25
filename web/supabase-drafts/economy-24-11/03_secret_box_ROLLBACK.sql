-- Откат 03 (24.11.2026): убрать секретный бокс. Откатывать после отката 04 (его политика чтения shop_items использует
-- колонку released). Выпавшие вещи остаются в инвентаре, строки coin_transactions — в истории.
drop function if exists public.open_secret_box();
drop function if exists public.get_secret_box_state();
drop function if exists public._secret_box_open_for(uuid);
drop function if exists public._is_super_admin(uuid);
drop function if exists public._secret_box_roll();
drop function if exists public._secret_box_tier(int);
drop function if exists public._secret_box_price();
drop table if exists public.secret_box_opens;
drop table if exists public.feature_release;
alter table public.shop_items drop column if exists released;
