-- Выпуск новинок 24.11 для всех (ЧЕРНОВИК, применять в день выкладки кода, после «применяй»): 16 вещей из 04 и
-- секретный бокс из 03 до этого видны только суперадмину. Отсчёт NEW (90 дней на новинку) — с момента выпуска.
update public.shop_items set released = true
 where id in ('frame_line','frame_coral','frame_scales','frame_storm','snow','fog','floats','sunset',
              'name_sticker','name_neon_sign','name_wave','name_bubbles','skin_ice','skin_lilies','skin_bubbles','skin_whirlpool');
update public.feature_release set released = true, released_at = now() where key = 'secret_box';
-- 11 (25.11.2026): покупки за Звёзды и три скина за Звёзды — вместе с боксом.
update public.shop_items set released = true where id in ('skin_jellyfish', 'skin_lava', 'skin_constellations');
update public.feature_release set released = true, released_at = now() where key = 'stars';
update public.shop_novelties set added_at = now();
