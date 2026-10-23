delete from public.species where key = 'kalkan' and not exists (select 1 from public.catches c where c.species = 'kalkan' or c.species = 'Калкан');
