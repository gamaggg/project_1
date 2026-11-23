-- «Позвать на воду»: старейшины тоже могут звать (23.11.2026).
-- Подсказка в клане («Глава и старейшины могут раз в сутки позвать участника на воду») и кнопка в приложении
-- (MembersTab: всем, кроме участника) это уже обещали, а сервер пускал только главу и соруководителя
-- (_clan_leader_check) — старейшина получал «Это может только глава или соруководитель».
-- Меняется только проверка роли; _clan_leader_check не трогаем (им закрыты другие действия главы).
-- CREATE OR REPLACE: права (authenticated, service_role) сохраняются, аргументов без DEFAULT.
CREATE OR REPLACE FUNCTION public.clan_nudge(p_user uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_clan bigint;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  select clan_id into v_clan from public._my_clan_membership(auth.uid());
  if not exists (select 1 from public.clan_members cm where cm.clan_id = v_clan and cm.user_id = auth.uid()
                 and cm.left_at is null and cm.role in ('leader', 'co_leader', 'elder')) then
    raise exception 'CLAN:not_manager';
  end if;
  if p_user = auth.uid() or not exists (select 1 from public.clan_members cm where cm.clan_id = v_clan and cm.user_id = p_user and cm.left_at is null) then
    raise exception 'CLAN:not_member';
  end if;
  if exists (select 1 from public.notifications n where n.user_id = p_user and n.kind = 'clan_nudge' and n.created_at > now() - interval '24 hours') then
    raise exception 'CLAN:nudge_once';
  end if;
  perform public._clan_notify_many(v_clan, 'clan_nudge', auth.uid(), '{}'::jsonb, 'users', array[p_user]);
end $function$;
