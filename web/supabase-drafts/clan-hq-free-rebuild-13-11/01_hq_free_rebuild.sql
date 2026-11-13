-- ЧЕРНОВИК. Применять только после «применяй» владельца. Откат: 01_hq_free_rebuild_ROLLBACK.sql.
--
-- Решение владельца 13.11.2026: восстановить штаб после падения можно один раз бесплатно, потом — 1 000 монет
-- (обычная цена постановки, clan_economy.hq_place_cost). Самая первая постановка штаба — по-прежнему 1 000.
--   «Восстановление» = постановка штаба, когда у клана нет штаба и есть строка в clan_hq_ruins (она появляется при
--   падении в clan_hq_tick и удаляется при постановке нового штаба, поэтому живёт и после 24 часов руин).
--   clan_treasury.hq_free_rebuild_used — бесплатное восстановление уже потрачено (один раз за всё время клана).
--   clan_hq_free_rebuild(p_clan_id) — доступно ли оно сейчас (для экрана: «Восстановить бесплатно»).
-- clan_hq_place: тело как в живой базе (clan-update-06-11/03), изменён только расчёт цены и отметка.

set local lock_timeout = '3s';

alter table public.clan_treasury add column if not exists hq_free_rebuild_used boolean not null default false;

create or replace function public.clan_hq_place(p_territory_id text)
returns void language plpgsql security definer set search_path = public as $$
declare v_clan bigint; v_e public.clan_economy; v_cur public.clan_hq; v_cost int; v_free boolean := false;
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
  -- После падения первый новый штаб бесплатный (один раз за всё время клана).
  if v_cur.clan_id is null and exists (select 1 from public.clan_hq_ruins r where r.clan_id = v_clan)
     and not coalesce((select t.hq_free_rebuild_used from public.clan_treasury t where t.clan_id = v_clan), false) then
    v_free := true;
    v_cost := 0;
  end if;
  if v_cost > 0 then
    perform public._clan_treasury_spend(v_clan, v_cost, 'spend_hq', auth.uid(), 'Штаб-квартира · ' || p_territory_id);
  end if;
  if v_free then
    insert into public.clan_treasury (clan_id) values (v_clan) on conflict do nothing;
    update public.clan_treasury set hq_free_rebuild_used = true where clan_id = v_clan;
  end if;
  delete from public.clan_sieges where clan_id = v_clan;
  delete from public.clan_hq_ruins where clan_id = v_clan;
  if v_cur.clan_id is null then
    insert into public.clan_hq (clan_id, territory_id) values (v_clan, p_territory_id);
  else
    update public.clan_hq set territory_id = p_territory_id, moved_at = now(), defense_at = now() where clan_id = v_clan;
  end if;
end $$;

-- Доступно ли клану бесплатное восстановление штаба прямо сейчас (штаба нет, он падал, бесплатное не потрачено).
create or replace function public.clan_hq_free_rebuild(p_clan_id bigint)
returns boolean language sql stable security definer set search_path = public as $$
  select not exists (select 1 from public.clan_hq h where h.clan_id = p_clan_id)
     and exists (select 1 from public.clan_hq_ruins r where r.clan_id = p_clan_id)
     and not coalesce((select t.hq_free_rebuild_used from public.clan_treasury t where t.clan_id = p_clan_id), false);
$$;
revoke all on function public.clan_hq_free_rebuild(bigint) from public, anon;
grant execute on function public.clan_hq_free_rebuild(bigint) to authenticated;
