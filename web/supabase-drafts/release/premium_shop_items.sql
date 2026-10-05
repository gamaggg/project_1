-- РЕЛИЗ: дорогие вещи в магазине (800–2000 монет).
-- Вид у каждой — в коде: рамки в lib/data/shopItems.ts (анимация — AvatarFrameRing + .avatar-frame-fx),
-- фоны в lib/data/heroBackgrounds.ts (сцены — PremiumBackgrounds.tsx),
-- стили имени в lib/data/nameStyles.ts (.name-fx-*), скины — public/skins/<id>.svg.
-- Только в релиз: в нынешнем клиенте этих id нет — рамка показалась бы пустой, имя обычным, скин не нарисовался бы.
-- После применения удалить lib/data/premiumShopPreview.ts и его вызов в ShopScreen.

insert into public.shop_items (id, category, name, price, sort_order) values
  ('frame_aurora',    'avatar_frame',   'Рамка «Северное сияние»', 800,  16),
  ('frame_flame',     'avatar_frame',   'Рамка «Пламя»',           1000, 17),
  ('frame_comet',     'avatar_frame',   'Рамка «Комета»',          1200, 18),
  ('frame_holo',      'avatar_frame',   'Рамка «Голограмма»',      1500, 19),
  ('frame_royal',     'avatar_frame',   'Рамка «Королевская»',     2000, 20),
  ('deepwater',       'hero_bg',        'Глубина',                 800,  23),
  ('moonpath',        'hero_bg',        'Лунная дорожка',          1000, 24),
  ('school',          'hero_bg',        'Косяк',                   1500, 25),
  ('golddust',        'hero_bg',        'Золотая пыль',            2000, 26),
  ('name_aurora',     'name_style',     'Имя «Северное сияние»',   800,  7),
  ('name_lava',       'name_style',     'Имя «Лава»',              1000, 8),
  ('name_holo',       'name_style',     'Имя «Голограмма»',        1300, 9),
  ('name_gold_shine', 'name_style',     'Имя «Золотой блеск»',     1600, 10),
  ('skin_scales',     'territory_skin', 'Скин «Чешуя»',            800,  11),
  ('skin_depth',      'territory_skin', 'Скин «Глубины»',          1000, 12),
  ('skin_compass',    'territory_skin', 'Скин «Роза ветров»',      1300, 13),
  ('skin_school',     'territory_skin', 'Скин «Косяк»',            1600, 14)
on conflict (id) do nothing;
