-- Откат 15: убрать семь новых скинов (купленные остаются у игроков) и вернуть три старых («Медузы», «Лава», «Созвездия»).
-- Внимание: код старых трёх рисовался в animatedSkins.ts и после 25.11.2026 из кода удалён; для возврата нужен откат кода.
delete from public.stars_products p where p.id like 'skin\_gl\_%' and not exists (select 1 from public.stars_orders o where o.product_id = p.id);
delete from public.shop_novelties where id like 'skin\_gl\_%';
delete from public.shop_items s where s.id like 'skin\_gl\_%'
  and not exists (select 1 from public.user_inventory i where i.item_id = s.id)
  and not exists (select 1 from public.stars_products p where p.item_id = s.id);
insert into public.shop_items (id, category, name, price, sort_order, purchasable, released) values
  ('skin_jellyfish', 'territory_skin', 'Медузы', 3000, -30, false, true),
  ('skin_lava', 'territory_skin', 'Лава', 3000, -29, false, true),
  ('skin_constellations', 'territory_skin', 'Созвездия', 3000, -28, false, true)
on conflict (id) do nothing;
insert into public.stars_products (id, kind, amount, item_id, stars, sort_order) values
  ('skin_jellyfish', 'item', 0, 'skin_jellyfish', 150, 21), ('skin_lava', 'item', 0, 'skin_lava', 150, 22), ('skin_constellations', 'item', 0, 'skin_constellations', 150, 23)
on conflict (id) do nothing;
