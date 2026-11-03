-- Морской налим в Батуми и Сочи (03.11.2026, по просьбе владельца).
-- Морской список (marine) показывают только Батуми и Сочи (lib/data/species.ts),
-- Тбилиси его не видит. Ключ morskoy_nalim, рядом с московским nalim_msk не путается.
-- Монеты 25: небольшая придонная рыба (Gaidropsarus mediterraneus, до 30–40 см),
-- как морской дракон, сарган и луфарь.
-- Распознавание по фото: Gaidropsarus mediterraneus → morskoy_nalim (fishSpeciesMatch.ts).
-- Названия на en и ka — в web/lib/i18n. Откат: 01_species_morskoy_nalim_ROLLBACK.sql
insert into public.species (key, name, category, sort_order, coin_value) values
  ('morskoy_nalim', 'Морской налим', 'marine', 0, 25)
on conflict (key) do nothing;
