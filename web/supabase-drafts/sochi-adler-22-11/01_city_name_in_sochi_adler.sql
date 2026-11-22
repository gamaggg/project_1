-- Название города в предложном падеже («в Сочи/Адлере»): его читает _city_name_in для сообщений
-- (Telegram и др.). Приложение уже пишет «Сочи/Адлер» (lib/i18n/{ru,en,ka}.ts), здесь та же правка в базе.
-- Откат: 01_city_name_in_sochi_adler_ROLLBACK.sql
update public.city_config set name_in = 'Сочи/Адлере' where id = 'sochi' and name_in = 'Сочи';
