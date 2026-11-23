-- Рамка «Чемпионская» (frame_champion): не продаётся, клан 10 уровня может её надеть.
-- Меняется только clan_shop_equip: для frame_champion вместо «куплено» проверяется уровень клана (_clan_level(xp) >= 10).
-- Купить и поставить целью нельзя: frame_champion нет в _clan_shop_item, clan_shop_buy → CLAN:bad_item, clan_set_goal → CLAN:bad_goal.
-- Сигнатура и права те же (CREATE OR REPLACE, DEFAULT-ов у функции нет).
create or replace function public.clan_shop_equip(p_kind text, p_item text)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare v_clan bigint;
begin
  select clan_id into v_clan from public._my_clan_membership(auth.uid());
  perform public._clan_leader_check(v_clan);
  if p_kind not in ('clan_skin', 'boat', 'frame') then raise exception 'CLAN:bad_item'; end if;
  if p_item = 'frame_champion' then
    if p_kind <> 'frame' or (select public._clan_level(xp) from public.clans where id = v_clan) < 10 then
      raise exception 'CLAN:not_owned';
    end if;
  elsif p_item is not null and not exists (
    select 1 from public.clan_items ci cross join lateral public._clan_shop_item(ci.item_id) s
     where ci.clan_id = v_clan and ci.item_id = p_item and s.kind = p_kind) then
    raise exception 'CLAN:not_owned';
  end if;
  insert into public.clan_equipped (clan_id) values (v_clan) on conflict do nothing;
  update public.clan_equipped set
    skin = case when p_kind = 'clan_skin' then p_item else skin end,
    boat = case when p_kind = 'boat' then p_item else boat end,
    frame = case when p_kind = 'frame' then p_item else frame end,
    updated_at = now()
  where clan_id = v_clan;
end $function$;
