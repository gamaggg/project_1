-- Откат 01_species_morskoy_nalim.sql (если уловов морского налима ещё нет).
delete from public.species
where key = 'morskoy_nalim'
  and not exists (select 1 from public.catches c where c.species = species.key);
