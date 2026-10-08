-- Монеты за виды рыб (08.10.2026), по просьбе: Карась 20, Зеленушка 10,
-- Голавль 25, Кефаль 20, Амур 50, Щука 50, Звездочёт 50, Толстолобик 50.
-- В обоих городах, где вид есть (у московских ключ с _msk). Монеты за улов
-- берёт только confirm_catch из species.coin_value — больше ничего менять не
-- нужно; уже начисленные монеты не пересчитываются.
-- Было: karas 5, karas_msk 10, zelenushka 5, golavl 15, golavl_msk 25,
-- kefal 25, amur 25, amur_msk 75, shchuka 75, shchuka_msk 75, zvezdochet 25,
-- tolstolobik 25, tolstolobik_msk 50.
update public.species s
set coin_value = v.coins
from (values
  ('karas', 20), ('karas_msk', 20),
  ('zelenushka', 10),
  ('golavl', 25), ('golavl_msk', 25),
  ('kefal', 20),
  ('amur', 50), ('amur_msk', 50),
  ('shchuka', 50), ('shchuka_msk', 50),
  ('zvezdochet', 50),
  ('tolstolobik', 50), ('tolstolobik_msk', 50)
) as v(key, coins)
where s.key = v.key;
