-- Откат 01_species_elets.sql (если уловов ельца ещё нет).
delete from public.species
where key in ('elets', 'elets_msk')
  and not exists (select 1 from public.catches c where c.species = species.key);
