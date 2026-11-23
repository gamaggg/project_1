-- Откат 01_species_merlang.sql (если уловов мерланга ещё нет).
delete from public.species
where key = 'merlang'
  and not exists (select 1 from public.catches c where c.species = species.key);
