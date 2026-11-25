-- Откат выпуска 13: снова скрыть новое от игроков (у кого уже куплено, остаётся).
update public.shop_items set released = false
 where id like 'bg\_gl\_%' or id like 'frame\_gl\_%' or id like 'name\_gl\_%';
update public.stars_products set released = false where id like '%\_gl\_%';
