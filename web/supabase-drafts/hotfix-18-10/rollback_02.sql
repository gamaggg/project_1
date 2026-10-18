-- back to the 5-argument edit_my_catch (see ../update-16-10/02_edit_my_catch.sql) and drop the flags
drop function if exists public.edit_my_catch(bigint, integer, numeric, text, text, text);
-- then run update-16-10/02_edit_my_catch.sql again, and:
alter table public.catches drop column if exists species_changed, drop column if exists measures_changed;
