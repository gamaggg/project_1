-- Rolls back clan_symbol_swirl.sql. Clans that already picked 'swirl' keep it
-- in their crest jsonb; the client falls back through resolveCrest if it is gone.
do $$
declare v_def text;
begin
  v_def := pg_get_functiondef('public._clan_item_level(text,text)'::regprocedure);
  execute replace(v_def, ' when ''swirl'' then 1', '');
end $$;
