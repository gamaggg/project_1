-- Откат 02_city_name_in_moscow_mo.sql
update public.city_config set name_in = 'Москве' where id = 'moscow' and name_in = 'Москве и МО';
