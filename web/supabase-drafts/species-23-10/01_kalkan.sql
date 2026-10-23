-- Калкан (черноморская камбала-калкан, Scophthalmus maximus) — морской вид для Батуми и Сочи (23.10.2026, по просьбе владельца).
-- Морские виды (category 'marine') играют Батуми и Сочи, Тбилиси их не видит (только пресные), Москва и Петербург не видят.
-- 150 монет (решение владельца): как у катрана, ската, кумжи и сома.
-- Названия на en и ka — в web/lib/i18n, распознавание по фото — в web/lib/data/fishSpeciesMatch.ts.
-- Откат: 01_kalkan_ROLLBACK.sql (удалять можно, только пока никто не поймал калкана).
insert into public.species (key, name, category, sort_order, coin_value)
values ('kalkan', 'Калкан', 'marine', 0, 150)
on conflict (key) do nothing;
