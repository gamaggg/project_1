-- Откат species_coins_oct8.sql: прежние монеты за эти виды.
update public.species s
set coin_value = v.coins
from (values
  ('karas', 5), ('karas_msk', 10),
  ('zelenushka', 5),
  ('golavl', 15), ('golavl_msk', 25),
  ('kefal', 25),
  ('amur', 25), ('amur_msk', 75),
  ('shchuka', 75), ('shchuka_msk', 75),
  ('zvezdochet', 25),
  ('tolstolobik', 25), ('tolstolobik_msk', 50)
) as v(key, coins)
where s.key = v.key;
