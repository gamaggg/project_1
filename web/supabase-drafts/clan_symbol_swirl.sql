-- New free clan crest symbol «Вихрь» (id 'swirl', level 1).
-- Point replace in _clan_item_level; everything else is unchanged.
do $$
declare v_def text;
begin
  v_def := pg_get_functiondef('public._clan_item_level(text,text)'::regprocedure);
  if position('when ''crossed_rods'' then 1' in v_def) = 0 then
    raise exception 'anchor not found';
  end if;
  execute replace(v_def, 'when ''crossed_rods'' then 1', 'when ''crossed_rods'' then 1 when ''swirl'' then 1');
end $$;
