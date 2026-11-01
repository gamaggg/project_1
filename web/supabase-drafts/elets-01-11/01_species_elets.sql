-- Елец во все пресноводные списки (01.11.2026, по просьбе владельца).
-- Пресноводных списков два: «пресноводные» (freshwater) у Батуми, Сочи и Тбилиси
-- и «хищные / мирные» у Москвы и Петербурга (ключи *_msk). Добавляем ельца в оба:
-- elets — в «пресноводные», elets_msk — в «мирные» (рядом с плотвой, густерой, уклейкой).
-- Монеты 10 в обоих: дороже плотвы и уклейки (5), дешевле голавля и язя (25).
-- Распознавание по фото: Leuciscus leuciscus → elets / elets_msk (fishSpeciesMatch.ts).
-- Названия на en и ka — в web/lib/i18n. Откат: 01_species_elets_ROLLBACK.sql
insert into public.species (key, name, category, sort_order, coin_value) values
  ('elets', 'Елец', 'freshwater', 0, 10),
  ('elets_msk', 'Елец', 'peaceful', 18, 10)
on conflict (key) do nothing;
