-- Откат 01_hq_free_rebuild.sql: прежний clan_hq_place (как в живой базе 13.11, clan-update-06-11/03), без функции
-- clan_hq_free_rebuild и без столбца hq_free_rebuild_used.
set local lock_timeout = '3s';

create or replace function public.clan_hq_place(p_territory_id text)
returns void language plpgsql security definer set search_path = public as $$
declare v_clan bigint; v_e public.clan_economy; v_cur public.clan_hq; v_cost int;
begin
  select clan_id into v_clan from public._my_clan_membership(auth.uid());
  perform public._clan_leader_check(v_clan);
  select * into v_e from public.clan_economy where id = 1;
  if not public._clan_econ_on(v_clan) then raise exception 'CLAN:treasury_off'; end if;
  if exists (select 1 from public.clan_hq_ruins r where r.clan_id = v_clan and r.until > now()) then raise exception 'CLAN:hq_ruins'; end if;
  if not exists (select 1 from public.territories t join public.clan_members cm on cm.user_id = t.owner_id and cm.clan_id = v_clan and cm.left_at is null
                 where t.id = p_territory_id and not t.is_deleted) then raise exception 'CLAN:hq_not_ours'; end if;
  if exists (select 1 from public.clan_hq h where h.territory_id = p_territory_id) then raise exception 'CLAN:hq_taken'; end if;
  select * into v_cur from public.clan_hq where clan_id = v_clan for update;
  if v_cur.clan_id is not null and coalesce(v_cur.moved_at, v_cur.placed_at) + interval '3 days' > now() then raise exception 'CLAN:hq_cooldown'; end if;
  v_cost := case when v_cur.clan_id is null then v_e.hq_place_cost else v_e.hq_move_cost end;
  perform public._clan_treasury_spend(v_clan, v_cost, 'spend_hq', auth.uid(), 'Штаб-квартира · ' || p_territory_id);
  delete from public.clan_sieges where clan_id = v_clan;
  delete from public.clan_hq_ruins where clan_id = v_clan;
  if v_cur.clan_id is null then
    insert into public.clan_hq (clan_id, territory_id) values (v_clan, p_territory_id);
  else
    update public.clan_hq set territory_id = p_territory_id, moved_at = now(), defense_at = now() where clan_id = v_clan;
  end if;
end $$;

drop function if exists public.clan_hq_free_rebuild(bigint);
alter table public.clan_treasury drop column if exists hq_free_rebuild_used;
