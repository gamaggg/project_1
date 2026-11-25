-- Скины секторов к живым фонам (25.11.2026). ЧЕРНОВИК, применять только после «применяй». Применяется после 13.
-- Владелец: три платных скина («Медузы», «Лава», «Созвездия») убрать, вместо них новые в нашем стиле по пяти из новых
-- платных фонов (сияние, звёздное небо, частицы, лучи, матрица); в комплект они не входят, продаются отдельно. Цена 150 ⭐ (как у фона). Только за Звёзды: за монеты не
-- продаются (purchasable = false), из бокса не выпадают. До выпуска (13_release.sql) видит и покупает только суперадмин.
-- Старые три: проверено 25.11.2026 — ни у кого не куплены, нет заказов, ни у кого не надеты.

delete from public.stars_products where id in ('skin_jellyfish', 'skin_lava', 'skin_constellations')
  and not exists (select 1 from public.stars_orders o where o.product_id = stars_products.id);
delete from public.shop_novelties where id in ('skin_jellyfish', 'skin_lava', 'skin_constellations');
delete from public.shop_items s where s.id in ('skin_jellyfish', 'skin_lava', 'skin_constellations')
  and not exists (select 1 from public.user_inventory i where i.item_id = s.id)
  and not exists (select 1 from public.stars_products p where p.item_id = s.id);

insert into public.shop_items (id, category, name, price, sort_order, purchasable, released) values
  ('skin_gl_aurora',    'territory_skin', 'Северное сияние', 3000, -30, false, false),
  ('skin_gl_starfield', 'territory_skin', 'Звёздное небо',   3000, -28, false, false),
  ('skin_gl_particles', 'territory_skin', 'Частицы',         3000, -27, false, false),
  ('skin_gl_beams',     'territory_skin', 'Лучи',            3000, -26, false, false),
  ('skin_gl_matrix',    'territory_skin', 'Матрица',         3000, -25, false, false)
on conflict (id) do nothing;
insert into public.shop_novelties (id, added_at)
select id, now() from public.shop_items where id like 'skin\_gl\_%'
on conflict (id) do nothing;

insert into public.stars_products (id, kind, amount, item_id, stars, sort_order, released) values
  ('skin_gl_aurora',    'item', 0, 'skin_gl_aurora',    150, 21, false),
  ('skin_gl_starfield', 'item', 0, 'skin_gl_starfield', 150, 23, false),
  ('skin_gl_particles', 'item', 0, 'skin_gl_particles', 150, 24, false),
  ('skin_gl_beams',     'item', 0, 'skin_gl_beams',     150, 25, false),
  ('skin_gl_matrix',    'item', 0, 'skin_gl_matrix',    150, 26, false)
on conflict (id) do nothing;
