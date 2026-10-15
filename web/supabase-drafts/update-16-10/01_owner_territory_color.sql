-- The map paints every player's sectors in the colour that player chose
-- (it used to be one «someone else's» blue for everyone but the viewer):
-- the owner's colour as a new last column, and each shared-sector holder's
-- colour inside co_holders. Appended only, so every existing column keeps
-- its place and the view's grants stay.
do $m$
declare
  v text := pg_get_viewdef('public.territories_with_stats'::regclass, true);
  v2 text;
begin
  v := regexp_replace(v, ';\s*$', '');
  v2 := replace(v, $a$'equipped_skin', sp.equipped_skin)$a$, $a$'equipped_skin', sp.equipped_skin, 'territory_color', sp.territory_color)$a$);
  if v2 = v then raise exception 'co_holders pattern not found'; end if;
  v := v2;
  v2 := replace(v, E'END AS defense\n   FROM territories t', E'END AS defense,\n    p.territory_color AS owner_territory_color\n   FROM territories t');
  if v2 = v then raise exception 'defense pattern not found'; end if;
  execute 'create or replace view public.territories_with_stats as ' || v2;
end
$m$;
