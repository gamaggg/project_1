-- Отмена тестовой выдачи: забрать эти вещи у суперадминов и снять их с профиля.
update public.profiles set
  hero_bg = case when split_part(hero_bg, '~', 1) in ('bg_gl_aurora', 'bg_gl_matrix') then 'default' else hero_bg end,
  equipped_frame = case when equipped_frame in ('frame_gl_aurora', 'frame_gl_fog') then null else equipped_frame end,
  equipped_name_style = case when equipped_name_style in ('name_gl_aurora', 'name_gl_fog') then null else equipped_name_style end
where is_super_admin;
delete from public.user_gl_presets where user_id in (select id from public.profiles where is_super_admin) and item_id in ('bg_gl_aurora', 'bg_gl_matrix');
delete from public.user_inventory where user_id in (select id from public.profiles where is_super_admin)
  and item_id in ('bg_gl_aurora', 'frame_gl_aurora', 'name_gl_aurora', 'bg_gl_matrix', 'frame_gl_fog', 'name_gl_fog');
