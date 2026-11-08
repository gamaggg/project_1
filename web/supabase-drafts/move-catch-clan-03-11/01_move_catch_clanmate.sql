-- Перенос улова соклановца на сектор клана даёт долю, а не меняет хозяина (03.11.2026).
-- Было: admin_move_catch ставил хозяином того, чей перенесённый улов на новом секторе
-- самый свежий, и триггер _territory_owner_changed стирал все доли сектора.
-- Б-1031: хозяин gamag, Руслан (соклановец) в доле; перенос улова Руслана с Б-1030 сделал
-- хозяином Руслана, а gamag вылетел из сектора совсем.
-- Стало: как в confirm_catch (ветка v_clan_mate) — если рыбак состоит в одном клане города
-- с текущим хозяином нового сектора, хозяин остаётся, рыбак входит в долю (до 3 долей),
-- записи «захват» для такого улова нет. Остальные случаи как раньше.
-- Функция меняется приёмом pg_get_functiondef + replace: тело, SECURITY DEFINER и права целы.
-- Откат: 01_move_catch_clanmate_ROLLBACK.sql
do $mig$
declare
  v_def text := pg_get_functiondef('public.admin_move_catch(bigint, text)'::regprocedure);
  v_new text := v_def;
  v_old text;
  v_rep text;
begin
  -- 1. переменная
  v_old := E'  v_tgt_now_latest boolean;\nbegin';
  v_rep := E'  v_tgt_now_latest boolean;\n  v_clan_mate boolean := false;\nbegin';
  if (length(v_new) - length(replace(v_new, v_old, ''))) / length(v_old) <> 1 then raise exception 'admin_move_catch: declare block not unique'; end if;
  v_new := replace(v_new, v_old, v_rep);

  -- 2. соклановец хозяина нового сектора — не захват
  v_old := E'  v_is_claim := v_owner_then is distinct from v_catch.user_id;\n';
  v_rep := v_old
    || E'  -- Соклановец хозяина (клан города сектора) не отбирает сектор, а входит в долю,\n'
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
  if (length(v_new) - length(replace(v_new, v_old, ''))) / length(v_old) <> 1 then raise exception 'admin_move_catch: v_is_claim line not unique'; end if;
  v_new := replace(v_new, v_old, v_rep);

  -- 3. новый сектор: доля соклановцу или смена хозяина, как раньше
  v_old := E'  if v_tgt_now_latest then\n    update public.territories t set owner_id = v_catch.user_id,';
  v_rep := E'  if v_clan_mate then\n'
    || E'    insert into public.territory_shares (territory_id, user_id)\n'
    || E'    select p_territory_id, v_catch.user_id\n'
    || E'    where (select count(*) from public.territory_shares s where s.territory_id = p_territory_id) < 3\n'
    || E'    on conflict do nothing;\n'
    || E'  elsif v_tgt_now_latest then\n'
    || E'    update public.territories t set owner_id = v_catch.user_id,';
  if (length(v_new) - length(replace(v_new, v_old, ''))) / length(v_old) <> 1 then raise exception 'admin_move_catch: owner update not unique'; end if;
  v_new := replace(v_new, v_old, v_rep);

  execute v_new;
end
$mig$;
