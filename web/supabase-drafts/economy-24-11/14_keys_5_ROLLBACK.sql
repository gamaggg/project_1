-- Откат 14: убрать пятёрку ключей с продажи. Если её уже покупали, заказы остаются, товар снимается с продажи.
update public.stars_products set active = false where id = 'keys_5' and exists (select 1 from public.stars_orders where product_id = 'keys_5');
delete from public.stars_products where id = 'keys_5' and not exists (select 1 from public.stars_orders where product_id = 'keys_5');
