-- Dry run of 01_treasury.sql: run THIS FILE'S text right after the migration text, in one request.
-- The DO block ends with `raise exception`, so the whole request (migration included) is rolled back
-- and the message shows what happened. Clan 34 «BFC» and two of its members are used (live ids, read only).
do $test$
declare
  v_clan bigint := 34;
  v_leader uuid := '77c8ade9-7df4-4f81-a32c-61153d9a859e';
  v_member uuid := '746786af-4d12-4307-b6d2-577ba86e1122';
  out text := '';
  j jsonb; n int; c0 int; c1 int; bal int; plain int; shared int; exp int; t0 int;
begin
  perform set_config('request.jwt.claims', json_build_object('sub', v_leader)::text, true);
  update public.clan_economy set enabled = true where id = 1;

  -- 1. the leader sets the tax; a wrong rate is refused
  perform public.clan_set_tax(10);
  begin perform public.clan_set_tax(7); out := out || 'FAIL tax 7 accepted; '; exception when others then out := out || 'ok tax7 refused (' || sqlerrm || '); '; end;

  -- 2. an ordinary member cannot set the tax
  perform set_config('request.jwt.claims', json_build_object('sub', v_member)::text, true);
  begin perform public.clan_set_tax(5); out := out || 'FAIL member set tax; '; exception when others then out := out || 'ok member refused (' || sqlerrm || '); '; end;

  -- 3. a donation
  select coins into c0 from public.profiles where id = v_member;
  j := public.clan_treasury_donate(50);
  select coins into c1 from public.profiles where id = v_member;
  out := out || format('donate: %s, member coins %s -> %s; ', j, c0, c1);
  begin perform public.clan_treasury_donate(0); out := out || 'FAIL donate 0; '; exception when others then out := out || 'ok donate0 refused; '; end;

  -- 4. the catch tax: a 100-coin catch reward line -> 10 taken
  c0 := c1;
  insert into public.coin_transactions (user_id, amount, reason, label) values (v_member, 100, 'catch_reward', 'dry-run catch');
  select coins into c1 from public.profiles where id = v_member;
  select balance into bal from public.clan_treasury where clan_id = v_clan;
  select count(*) into n from public.coin_transactions where user_id = v_member and reason = 'clan_tax' and amount = -10;
  out := out || format('tax: member coins %s -> %s (expect -10), treasury %s (expect 60), tax lines %s; ', c0, c1, bal, n);

  -- 5. the rent for 3 days
  select count(*) filter (where not exists (select 1 from public.territory_shares s where s.territory_id = t.id)),
         count(*) filter (where exists (select 1 from public.territory_shares s where s.territory_id = t.id))
    into plain, shared
  from public.territories t join public.clan_members cm on cm.user_id = t.owner_id and cm.clan_id = v_clan and cm.left_at is null where not t.is_deleted;
  exp := round(3 * (plain * 8 + shared * 8 * 1.5))::int;
  update public.clan_treasury set last_rent_at = now() - interval '3 days 2 hours' where clan_id = v_clan;
  select balance into t0 from public.clan_treasury where clan_id = v_clan;
  perform public.clan_rent_tick();
  select balance into bal from public.clan_treasury where clan_id = v_clan;
  out := out || format('rent: plain %s shared %s, expected +%s, got +%s, cap %s; ', plain, shared, exp, bal - t0, public._clan_treasury_cap(v_clan));
  perform public.clan_rent_tick();
  select balance into n from public.clan_treasury where clan_id = v_clan;
  out := out || format('second tick adds %s (expect 0); ', n - bal);

  -- 6. the cap
  perform public._clan_treasury_add(v_clan, 100000, 'rent', null, 'cap test');
  select balance into bal from public.clan_treasury where clan_id = v_clan;
  out := out || format('after +100000 balance %s (cap %s); ', bal, public._clan_treasury_cap(v_clan));

  -- 7. reading
  j := public.get_clan_treasury(v_clan);
  out := out || format('get: keys %s, log rows %s, givers %s; ', (select string_agg(k, ',') from jsonb_object_keys(j) k), jsonb_array_length(j->'log'), j->'week_givers');

  -- 8. a stranger cannot read
  perform set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-0000-0000-000000000001')::text, true);
  begin perform public.get_clan_treasury(v_clan); out := out || 'FAIL stranger read; '; exception when others then out := out || 'ok stranger refused; '; end;

  raise exception 'DRYRUN RESULT: %', out;
end
$test$;
