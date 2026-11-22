-- Откат 01_city_name_in_sochi_adler.sql
update public.city_config set name_in = 'Сочи' where id = 'sochi' and name_in = 'Сочи/Адлере';
