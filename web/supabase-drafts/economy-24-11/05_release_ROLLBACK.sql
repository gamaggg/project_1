-- Откат 05: снова спрятать новинки 24.11 и бокс от всех, кроме суперадмина. Купленное остаётся у игроков.
update public.shop_items set released = false
 where id in ('frame_line','frame_coral','frame_scales','frame_storm','snow','fog','floats','sunset',
              'name_sticker','name_neon_sign','name_wave','name_bubbles','skin_ice','skin_lilies','skin_bubbles','skin_whirlpool');
update public.feature_release set released = false, released_at = null where key = 'secret_box';
update public.shop_items set released = false where id in ('skin_jellyfish', 'skin_lava', 'skin_constellations');
update public.feature_release set released = false, released_at = null where key = 'stars';
