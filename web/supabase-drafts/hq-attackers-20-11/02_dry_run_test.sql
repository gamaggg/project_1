-- Dry run (append after 01 in one transaction; it always ends in an exception, so nothing stays).
-- Clan 38 («Рыбнадзор», 7) attacks BFC's HQ B0536: siege → broken by a BFC member → siege again → it ends → taken.
do $$
declare
  v_att uuid; v_def uuid; v_ours int; v_broken int; v_taken int; v_fell int; v_tg int; t0 timestamptz := now();
begin
  select m.user_id into v_att from clan_members m where m.clan_id = 38 and m.left_at is null limit 1;
  select m.user_id into v_def from clan_members m where m.clan_id = 34 and m.left_at is null limit 1;
  perform clan_hq_attack('B0536', v_att, 0);
  select count(*) into v_ours from notifications where kind = 'clan_hq_siege_ours' and created_at >= t0 and payload->>'clan_id' = '38' and payload->>'enemy' = 'BFC';
  perform clan_hq_defend('B0536', v_def);
  select count(*) into v_broken from notifications where kind = 'clan_hq_siege_broken' and created_at >= t0 and payload->>'clan_id' = '38';
  perform clan_hq_attack('B0536', v_att, 0);
  update clan_sieges set ends_at = now() - interval '1 second' where territory_id = 'B0536';
  perform clan_hq_tick();
  select count(*) into v_taken from notifications where kind = 'clan_hq_taken' and created_at >= t0 and payload->>'clan_id' = '38';
  select count(*) into v_fell from notifications where kind = 'clan_hq_fell' and created_at >= t0 and payload->>'clan_id' = '34';
  select count(*) into v_tg from telegram_outbox o join notifications n on n.id = o.notification_id
    where n.created_at >= t0 and n.kind in ('clan_hq_siege_ours', 'clan_hq_siege_broken', 'clan_hq_taken');
  raise exception 'DRY RUN: siege_ours=% (clan 38 minus the attacker), broken=%, taken=%, fell for BFC=%, telegram queued=%, taken payload=%',
    v_ours, v_broken, v_taken, v_fell, v_tg,
    (select payload - 'crest' - 'enemy_crest' from notifications where kind = 'clan_hq_taken' and created_at >= t0 limit 1);
end $$;
