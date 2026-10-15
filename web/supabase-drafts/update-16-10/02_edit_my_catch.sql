-- A player fills in or corrects the size, weight, bait and fishing method of
-- their own catch after the fact (weighed it at home). The species stays as
-- it was — the coins were paid for it. Same limits as the catch form.
create or replace function public.edit_my_catch(p_catch_id bigint, p_length_cm integer, p_weight_kg numeric, p_bait text, p_method text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_catch public.catches;
  v_bait text := nullif(btrim(coalesce(p_bait, '')), '');
  v_method text := nullif(btrim(coalesce(p_method, '')), '');
  v_changes text[] := '{}';
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  if exists (select 1 from public.profiles where id = v_uid and coalesce(is_blocked, false)) then
    raise exception 'EDIT:blocked';
  end if;
  select * into v_catch from public.catches where id = p_catch_id for update;
  if not found then raise exception 'EDIT:catch_not_found'; end if;
  if v_catch.user_id <> v_uid then raise exception 'EDIT:not_yours'; end if;
  if p_length_cm is not null and (p_length_cm < 1 or p_length_cm > 300) then raise exception 'EDIT:bad_length'; end if;
  if p_weight_kg is not null and (p_weight_kg < 0.01 or p_weight_kg > 9.999) then raise exception 'EDIT:bad_weight'; end if;
  if (v_bait is not null and (length(v_bait) > 40 or public.moderate_text(v_bait, 'catch_bait') is not null))
     or (v_method is not null and (length(v_method) > 40 or public.moderate_text(v_method, 'catch_method') is not null)) then
    raise exception 'EDIT:bad_text';
  end if;

  if p_length_cm is distinct from v_catch.length_cm then
    v_changes := v_changes || format('размер %s → %s', coalesce(v_catch.length_cm || ' см', '—'), coalesce(p_length_cm || ' см', '—'));
  end if;
  if p_weight_kg is distinct from v_catch.weight_kg then
    v_changes := v_changes || format('вес %s → %s', coalesce(round(v_catch.weight_kg * 1000) || ' г', '—'), coalesce(round(p_weight_kg * 1000) || ' г', '—'));
  end if;
  if v_bait is distinct from v_catch.bait then
    v_changes := v_changes || format('приманка %s → %s', coalesce(v_catch.bait, '—'), coalesce(v_bait, '—'));
  end if;
  if v_method is distinct from v_catch.method then
    v_changes := v_changes || format('способ %s → %s', coalesce(v_catch.method, '—'), coalesce(v_method, '—'));
  end if;
  if cardinality(v_changes) = 0 then raise exception 'EDIT:no_changes'; end if;

  update public.catches
  set length_cm = p_length_cm, weight_kg = p_weight_kg, bait = v_bait, method = v_method
  where id = p_catch_id;

  -- A bigger fish or a new bait can unlock an achievement; never blocks the edit.
  begin
    perform public._sync_achievements_for_user(v_uid);
  exception when others then
    raise warning 'edit_my_catch: achievements sync failed: %', sqlerrm;
  end;

  -- Super admins hear about it (Activity + Telegram): a player changing the
  -- numbers of a catch is worth a look. Once per catch and person in 30 min.
  begin
    insert into public.notifications (user_id, kind, actor_id, territory_id, catch_id, payload)
    select p.id, 'catch_edited', v_uid, v_catch.territory_id, p_catch_id,
      jsonb_build_object('changes', to_jsonb(v_changes), 'species', (select sp.name from public.species sp where sp.key = v_catch.species))
    from public.profiles p
    where p.is_super_admin and p.id <> v_uid
      and not exists (select 1 from public.notifications n
                      where n.user_id = p.id and n.kind = 'catch_edited' and n.catch_id = p_catch_id
                        and n.actor_id = v_uid and n.created_at > now() - interval '30 minutes');
  exception when others then
    raise warning 'edit_my_catch: admin notification failed: %', sqlerrm;
  end;

  return jsonb_build_object('changes', to_jsonb(v_changes));
end;
$$;

revoke all on function public.edit_my_catch(bigint, integer, numeric, text, text) from public, anon;
grant execute on function public.edit_my_catch(bigint, integer, numeric, text, text) to authenticated, service_role;
