-- РЕЛИЗ: рамки за джекпот слотов — «Катран» (Батуми) и «Сом» (Москва). Не продаются (purchasable = false):
-- только джекпот 0,1% в слотах своего города (spin_slots, supabase-drafts/slots_jackpot_frames.sql).
-- Вид — в коде: lib/data/shopItems.ts (fx katran / som, AvatarFrameRing). Только в релиз: в нынешнем
-- клиенте этих id нет, а магазин прода показал бы их с ценой.
-- price — только для «редкости» карточки и порядка; списать или вернуть её нельзя.
-- После применения убрать эти две строки из lib/data/premiumShopPreview.ts (весь файл и так удаляется).

insert into public.shop_items (id, category, name, price, sort_order, purchasable) values
  ('frame_katran', 'avatar_frame', 'Рамка «Катран»', 5000, 21, false),
  ('frame_som',    'avatar_frame', 'Рамка «Сом»',    5000, 22, false);
