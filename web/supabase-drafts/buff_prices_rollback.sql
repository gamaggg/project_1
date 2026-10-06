-- Откат buff_prices.sql: прежние цены.

update public.buffs set price = 80 where id = 'shield';
update public.buffs set price = 120 where id = 'tide';
