-- Выпуск живых фонов, рамок, имён и комплектов для всех (ЧЕРНОВИК, в день выкладки кода, после «применяй»).
-- До этого их видит и покупает только суперадмин.
update public.shop_items set released = true
 where id like 'bg\_gl\_%' or id like 'frame\_gl\_%' or id like 'name\_gl\_%' or id like 'skin\_gl\_%';
update public.stars_products set released = true where id like '%\_gl\_%';
update public.shop_novelties set added_at = now() where id like 'bg\_gl\_%' or id like 'frame\_gl\_%' or id like 'name\_gl\_%' or id like 'skin\_gl\_%';
-- (в выпуск входят и скины секторов skin_gl_*, черновик 15: у них та же маска '%\_gl\_%' в stars_products)
