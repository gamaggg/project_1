-- Для проверки владельцем (ЧЕРНОВИК, только после «применяй» и только суперадмину): выдать себе вещи без оплаты Звёздами,
-- чтобы посмотреть в магазине покупку «после» (пресеты на купленном фоне, «Надеть комплект»). Звёзды при этом не тратятся.
-- Выдаёт три семейства: «Северное сияние» целиком (комплект), «Матрица» только фон, «Туман» только рамку и имя.
insert into public.user_inventory (user_id, item_id)
select p.id, x.item from public.profiles p,
  (values ('bg_gl_aurora'), ('frame_gl_aurora'), ('name_gl_aurora'), ('bg_gl_matrix'), ('frame_gl_fog'), ('name_gl_fog')) as x(item)
where p.is_super_admin
on conflict do nothing;
