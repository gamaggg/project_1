-- Dry run (after 01 in one transaction; ends in an exception). BFC's HQ B0536 under siege by a «Рыбнадзор» member:
-- its owner tries a shield → HQ_SIEGE, reserve unchanged; then a shield is set by hand, the siege ends → the sector goes
-- to the attacker with no shield.
do $$
declare v_owner uuid; v_att uuid; v_before int; v_after int; v_err text := 'none'; v_shield timestamptz; v_new_owner uuid;
begin
  select owner_id into v_owner from territories where id = 'B0536';
  select m.user_id into v_att from clan_members m where m.clan_id = 38 and m.left_at is null limit 1;
  update profiles set free_shields = greatest(free_shields, 1) where id = v_owner;
  select free_shields into v_before from profiles where id = v_owner;
  perform clan_hq_attack('B0536', v_att, 0);
  perform set_config('request.jwt.claims', json_build_object('sub', v_owner, 'role', 'authenticated')::text, true);
  begin
    perform use_free_shield('B0536');
  exception when others then v_err := sqlerrm;
  end;
  select free_shields into v_after from profiles where id = v_owner;
  update territories set shield_until = now() + interval '20 hours' where id = 'B0536';
  update clan_sieges set ends_at = now() - interval '1 second' where territory_id = 'B0536';
  perform clan_hq_tick();
  select shield_until, owner_id into v_shield, v_new_owner from territories where id = 'B0536';
  raise exception 'DRY RUN: shield during siege -> %, reserve % -> %, after the fall: shield_until=%, owner is the attacker=%',
    v_err, v_before, v_after, v_shield, v_new_owner = v_att;
end $$;
