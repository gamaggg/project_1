-- Откат 03_species_spb.sql (если уловов этих видов ещё нет).
delete from public.species where key like '%\_spb' escape '\' and not exists (select 1 from public.catches c where c.species = species.key);
