-- Новые города (22.11.2026): Казань, Нижний Новгород, «Варна/Бургас», Анапа, Киев, Одесса, «Ереван/Севан».
-- Строка в city_config — всё, что нужно функциям базы (префикс секторов, часовой пояс, тема видов,
-- рамка джекпота, виды воды, название в предложном падеже). Казань, Нижний и Киев играют как Москва
-- (fresh, рамка «Сом»), Варна/Бургас, Анапа и Одесса — как Сочи (sea, рамка «Катран»), Ереван/Севан —
-- как Тбилиси (fresh, рамка «Сом», пресноводные виды).
-- Часовые пояса: Варна/Бургас — Europe/Sofia, Киев и Одесса — Europe/Kiev (UTC+2, летом +3; старое имя
-- зоны, потому что «Europe/Kyiv» нет в часовых базах старых телефонов), Ереван — Asia/Yerevan (UTC+4).
-- Морским городам — та же карточка «Двустихийник» (улов в море и на реке), что у Сочи и Петербурга.
-- Откат: 01_city_config_ROLLBACK.sql
insert into public.city_config (id, prefix, tz, theme, jackpot_frame, water_kinds, name_in) values
  ('kazan', 'K', 'Europe/Moscow', 'fresh', 'frame_som',    array['river','lake','pond'],       'Казани'),
  ('nnov',  'N', 'Europe/Moscow', 'fresh', 'frame_som',    array['river','lake','pond'],       'Нижнем Новгороде'),
  ('varna', 'V', 'Europe/Sofia',  'sea',   'frame_katran', array['sea','river','lake','pond'], 'Варне/Бургасе'),
  ('anapa', 'A', 'Europe/Moscow', 'sea',   'frame_katran', array['sea','river','lake','pond'], 'Анапе'),
  ('kyiv',  'Y', 'Europe/Kiev',   'fresh', 'frame_som',    array['river','lake','pond'],       'Киеве'),
  ('odesa', 'O', 'Europe/Kiev',   'sea',   'frame_katran', array['sea','river','lake','pond'], 'Одессе'),
  ('yerevan', 'E', 'Asia/Yerevan', 'fresh', 'frame_som',   array['river','lake','pond'],       'Ереване/Севане')
on conflict (id) do nothing;

insert into public.challenges (id, tier, name, description, metric, target, params, coin_reward, city_scope, sort_order)
select c.id || '_' || v.city, c.tier, c.name, c.description, c.metric, c.target, c.params, c.coin_reward, v.city, c.sort_order
from public.challenges c cross join (values ('varna'), ('anapa'), ('odesa')) as v(city)
where c.id = 'dvustihiynik'
on conflict (id) do nothing;
