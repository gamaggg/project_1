-- Мерланг в морских видах Чёрного моря (23.11.2026, по просьбе владельца).
-- Морской список (marine) показывают Батуми, Сочи/Адлер, Анапа, Варна/Бургас, Одесса (lib/data/species.ts).
-- Монеты 25 (решение владельца), как морской налим, морской дракон, луфарь, сарган. Merlangius merlangus, обычно 15–30 см.
-- Распознавание по фото: Merlangius merlangus → merlang (fishSpeciesMatch.ts).
-- Названия на en и ka — в web/lib/i18n. Откат: 01_species_merlang_ROLLBACK.sql
insert into public.species (key, name, category, sort_order, coin_value) values
  ('merlang', 'Мерланг', 'marine', 0, 25)
on conflict (key) do nothing;
