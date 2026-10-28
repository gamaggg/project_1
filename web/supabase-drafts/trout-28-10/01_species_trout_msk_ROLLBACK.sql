-- Откат 01_species_trout_msk.sql (если уловов этих видов ещё нет).
delete from public.species
where key in ('rechnaya_forel_msk', 'raduzhnaya_forel_msk')
  and not exists (select 1 from public.catches c where c.species = species.key);
