-- «Все игроки» in the rating counted only sectors a player OWNS; the map, «Мои»,
-- the weekly rating and the achievements count a shared sector (a clan mate's
-- catch on the clan's sector) as the player's own. One number everywhere:
-- profiles_with_stats.territories_count = owned + shared (not deleted).
-- CREATE OR REPLACE keeps the columns, types and grants as they are.
do $$
declare d text; d2 text;
begin
  d := pg_get_viewdef('public.profiles_with_stats'::regclass, true);
  d2 := replace(d, 'WHERE t.owner_id = p.id) AS territories_count',
    'WHERE t.owner_id = p.id OR (NOT COALESCE(t.is_deleted, false) AND EXISTS ( SELECT 1 FROM territory_shares s WHERE s.territory_id = t.id AND s.user_id = p.id))) AS territories_count');
  if d2 = d then raise exception 'territories_count pattern not found'; end if;
  execute 'create or replace view public.profiles_with_stats as ' || rtrim(d2, ';');
end $$;
