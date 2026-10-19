-- Виды Финского залива и Невской губы для Санкт-Петербурга (20.10.2026).
-- Петербург играет все московские виды (хищные и мирные, ключи *_msk) и эти (ключи *_spb).
-- Москва *_spb не видит: приложение отбирает виды города по суффиксу ключа
-- (web/lib/data/species.ts, speciesOfCity). Названия на en и ka — в lib/i18n.
-- Откат: 03_species_spb_ROLLBACK.sql
insert into public.species (key, name, category, sort_order, coin_value) values
  ('korjushka_spb', 'Корюшка', 'predator', 13, 10),
  ('kolyushka_spb', 'Колюшка', 'predator', 14, 5),
  ('kambala_spb', 'Камбала', 'predator', 15, 50),
  ('ugor_spb', 'Угорь', 'predator', 16, 100),
  ('kumzha_spb', 'Кумжа', 'predator', 17, 150),
  ('losos_spb', 'Атлантический лосось', 'predator', 18, 250),
  ('salaka_spb', 'Салака', 'peaceful', 12, 10),
  ('ryapushka_spb', 'Ряпушка', 'peaceful', 13, 25),
  ('chekhon_spb', 'Чехонь', 'peaceful', 14, 15),
  ('sinets_spb', 'Синец', 'peaceful', 15, 10),
  ('beloglazka_spb', 'Белоглазка', 'peaceful', 16, 10),
  ('sig_spb', 'Сиг', 'peaceful', 17, 75)
on conflict (key) do nothing;
