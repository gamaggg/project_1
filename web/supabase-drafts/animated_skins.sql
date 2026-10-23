-- Четыре анимированных скина сектора (рисуются кодом: web/lib/map/animatedSkins.ts, SVG-файла нет).
-- Без этих строк в магазине их нет; id уже знает клиент. Цены: на 20% выше первоначальных, округлены.
insert into public.shop_items (id, category, name, price, sort_order) values
  ('skin_sonar',      'territory_skin', 'Скин «Эхолот»',   2200, 15),
  ('skin_aquarium',   'territory_skin', 'Скин «Аквариум»', 2400, 16),
  ('skin_lighthouse', 'territory_skin', 'Скин «Маяк»',     2600, 17),
  ('skin_lightning',  'territory_skin', 'Скин «Молния»',   3000, 18)
on conflict (id) do nothing;
