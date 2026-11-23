-- Откат: как было до 23.11.2026 (звать могут только глава и соруководитель).
CREATE OR REPLACE FUNCTION public.clan_nudge(p_user uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_clan bigint;
begin
  select clan_id into v_clan from public._my_clan_membership(auth.uid());
  perform public._clan_leader_check(v_clan);
  if p_user = auth.uid() or not exists (select 1 from public.clan_members cm where cm.clan_id = v_clan and cm.user_id = p_user and cm.left_at is null) then
    raise exception 'CLAN:not_member';
  end if;
  if exists (select 1 from public.notifications n where n.user_id = p_user and n.kind = 'clan_nudge' and n.created_at > now() - interval '24 hours') then
    raise exception 'CLAN:nudge_once';
  end if;
  perform public._clan_notify_many(v_clan, 'clan_nudge', auth.uid(), '{}'::jsonb, 'users', array[p_user]);
end $function$;
