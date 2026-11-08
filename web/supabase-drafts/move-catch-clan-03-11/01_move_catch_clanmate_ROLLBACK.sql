-- Откат 01_move_catch_clanmate.sql: возвращает прежнее тело admin_move_catch.
do $mig$
declare
  v_new text := pg_get_functiondef('public.admin_move_catch(bigint, text)'::regprocedure);
  v_old text;
  v_rep text;
begin
  v_old := E'  v_tgt_now_latest boolean;\n  v_clan_mate boolean := false;\nbegin';
  v_rep := E'  v_tgt_now_latest boolean;\nbegin';
  if (length(v_new) - length(replace(v_new, v_old, ''))) / length(v_old) <> 1 then raise exception 'rollback: declare block not found once'; end if;
  v_new := replace(v_new, v_old, v_rep);

  v_old := E'  -- Соклановец хозяина (клан города сектора) не отбирает сектор, а входит в долю,\n'
    || E'  -- как в confirm_catch.\n'
    || E'  if v_tgt_owner_before is not null and v_tgt_owner_before <> v_catch.user_id then\n'
    || E'    select exists (\n'
    || E'      select 1 from public.clan_members a\n'
    || E'      join public.clan_members b on b.clan_id = a.clan_id and b.left_at is null\n'
    || E'      where a.user_id = v_catch.user_id and a.left_at is null and b.user_id = v_tgt_owner_before\n'
    || E'        and a.city = public._prefix_city(left(p_territory_id, 1))\n'
    || E'    ) into v_clan_mate;\n'
    || E'  end if;\n'
    || E'  if v_clan_mate then v_is_claim := false; end if;\n';
  if (length(v_new) - length(replace(v_new, v_old, ''))) / length(v_old) <> 1 then raise exception 'rollback: clan block not found once'; end if;
  v_new := replace(v_new, v_old, '');

  v_old := E'  if v_clan_mate then\n'
    || E'    insert into public.territory_shares (territory_id, user_id)\n'
    || E'    select p_territory_id, v_catch.user_id\n'
    || E'    where (select count(*) from public.territory_shares s where s.territory_id = p_territory_id) < 3\n'
    || E'    on conflict do nothing;\n'
    || E'  elsif v_tgt_now_latest then\n';
  v_rep := E'  if v_tgt_now_latest then\n';
  if (length(v_new) - length(replace(v_new, v_old, ''))) / length(v_old) <> 1 then raise exception 'rollback: share block not found once'; end if;
  v_new := replace(v_new, v_old, v_rep);

  execute v_new;
end
$mig$;
