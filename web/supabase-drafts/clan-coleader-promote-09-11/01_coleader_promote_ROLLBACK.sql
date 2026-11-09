-- Откат 01_coleader_promote.sql: прежнее тело (соруководитель двигает только member <-> elder).
create or replace function public.set_clan_member_role(p_user_id uuid, p_role text, p_clan_id bigint default null::bigint)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_uid uuid := auth.uid();
  v_me public.clan_members;
  v_target public.clan_members;
begin
  if p_role not in ('leader', 'co_leader', 'elder', 'member') then raise exception 'CLAN:not_allowed'; end if;
  v_me := public._clan_membership(v_uid, p_clan_id);
  if v_me.id is not null then
    select * into v_target from public.clan_members cm where cm.user_id = p_user_id and cm.clan_id = v_me.clan_id and cm.left_at is null;
  end if;
  if v_me.id is null or v_target.id is null or v_uid = p_user_id or v_target.role = p_role then
    raise exception 'CLAN:not_allowed';
  end if;
  if v_me.role = 'leader' then
    null;
  elsif v_me.role = 'co_leader' and v_target.role in ('member', 'elder') and p_role in ('member', 'elder') then
    null;
  else
    raise exception 'CLAN:not_allowed';
  end if;
  if p_role = 'leader' then
    update public.clan_members set role = 'co_leader' where id = v_me.id;
  end if;
  update public.clan_members set role = p_role where id = v_target.id;
  insert into public.clan_events (clan_id, kind, actor_id, target_id, payload)
  values (v_me.clan_id, case when public._clan_role_rank(p_role) > public._clan_role_rank(v_target.role) then 'promoted' else 'demoted' end,
          v_uid, p_user_id, jsonb_build_object('role', p_role));
  perform public._clan_notify(p_user_id, 'clan_role_changed', v_uid, v_me.clan_id, jsonb_build_object('role', p_role));
end;
$function$;
