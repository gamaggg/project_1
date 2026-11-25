-- Откат 11 (25.11.2026): убрать покупки за Звёзды. Внимание: если кто-то уже платил, заказы удаляются вместе с
-- таблицей — перед откатом сохранить stars_orders (status = 'paid'), выданное (монеты, ключи, скины) остаётся у игроков.
-- Скины за Звёзды остаются в shop_items, если они уже у кого-то есть; иначе удаляются.
drop function if exists public.stars_fulfill(uuid, int, text, text, bigint);
drop function if exists public.stars_precheck(uuid, int);
drop function if exists public.stars_order_create(text);
drop function if exists public.get_stars_products();
drop function if exists public._stars_open_for(uuid);
drop table if exists public.stars_orders;
drop table if exists public.stars_products;
delete from public.shop_novelties where id in ('skin_jellyfish', 'skin_lava', 'skin_constellations');
delete from public.shop_items s
 where s.id in ('skin_jellyfish', 'skin_lava', 'skin_constellations')
   and not exists (select 1 from public.user_inventory i where i.item_id = s.id);
delete from public.feature_release where key = 'stars';
