-- Пять ключей за Звёзды (25.11.2026). ЧЕРНОВИК, применять только после «применяй».
-- Владелец: «давай сделаем 1, 3 и 5 ключей». Цена: 150 ⭐ (по 30 за ключ; 1 — 40, 3 — 100). Больше ничего не меняется:
-- ключи выдаёт тот же stars_fulfill (secret_box_free), витрина — тот же get_stars_products.
insert into public.stars_products (id, kind, amount, item_id, stars, sort_order) values ('keys_5', 'keys', 5, null, 150, 13)
on conflict (id) do nothing;
