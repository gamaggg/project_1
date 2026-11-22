-- Откат 01_city_config.sql. Сначала откатить 02 (сектора) и 03 (задания); профилей и кланов в этих
-- городах быть не должно (иначе внешний ключ не даст удалить строку — это и есть защита).
delete from public.challenges where id in ('dvustihiynik_varna', 'dvustihiynik_anapa', 'dvustihiynik_odesa')
  and not exists (select 1 from public.user_challenges uc where uc.challenge_id in ('dvustihiynik_varna', 'dvustihiynik_anapa', 'dvustihiynik_odesa'));
delete from public.city_config where id in ('kazan', 'nnov', 'varna', 'anapa', 'kyiv', 'odesa', 'yerevan');
