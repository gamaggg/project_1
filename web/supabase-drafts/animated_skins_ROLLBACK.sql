-- Откат: убрать скины из магазина. Кто уже купил или надел — сначала вернуть монеты и снять скин.
delete from public.shop_items where id in ('skin_sonar', 'skin_aquarium', 'skin_lighthouse', 'skin_lightning')
  and not exists (select 1 from public.user_inventory ui where ui.item_id in ('skin_sonar', 'skin_aquarium', 'skin_lighthouse', 'skin_lightning'));
