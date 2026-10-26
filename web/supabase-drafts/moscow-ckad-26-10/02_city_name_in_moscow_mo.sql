-- Название города в предложном падеже («в Москве и МО»): его читает _city_name_in для сообщений
-- (Telegram и др.). Приложение уже пишет «Москва и МО» (lib/i18n/{ru,en,ka}.ts), здесь та же правка в базе.
-- Откат: 02_city_name_in_moscow_mo_ROLLBACK.sql
update public.city_config set name_in = 'Москве и МО' where id = 'moscow' and name_in = 'Москве';
