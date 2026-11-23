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

-- Пробный прогон: всё откатывается исключением в конце. Клан 36 (Fish-hook, 6 уровень), его глава.
do $$
declare r text := ''; v_err text;
begin
  perform set_config('request.jwt.claims', '{"sub":"09c12425-6524-4ca8-b0dc-93433d5f027e","role":"authenticated"}', true);
  -- 1. 6 уровень: надеть «Чемпионскую» нельзя
  begin perform public.clan_shop_equip('frame', 'frame_champion'); r := r || '1:надел(ПЛОХО) ';
  exception when others then r := r || '1:' || sqlerrm || ' '; end;
  -- 2. купить нельзя
  begin perform public.clan_shop_buy('frame_champion'); r := r || '2:купил(ПЛОХО) ';
  exception when others then r := r || '2:' || sqlerrm || ' '; end;
  -- 3. поставить целью нельзя
  begin perform public.clan_set_goal('frame_champion'); r := r || '3:цель(ПЛОХО) ';
  exception when others then r := r || '3:' || sqlerrm || ' '; end;
  -- 4. клан дошёл до 10 уровня: надеть можно
  update public.clans set xp = 3200 where id = 36;
  begin perform public.clan_shop_equip('frame', 'frame_champion'); r := r || '4:надел=' || (select frame from public.clan_equipped where clan_id = 36) || ' ';
  exception when others then r := r || '4:' || sqlerrm || ' '; end;
  -- 5. как лодку — нельзя
  begin perform public.clan_shop_equip('boat', 'frame_champion'); r := r || '5:лодка(ПЛОХО) ';
  exception when others then r := r || '5:' || sqlerrm || ' '; end;
  -- 6. купленная серебряная надевается как раньше
  begin perform public.clan_shop_equip('frame', 'frame_silver'); r := r || '6:надел=' || (select frame from public.clan_equipped where clan_id = 36) || ' ';
  exception when others then r := r || '6:' || sqlerrm || ' '; end;
  -- 7. некупленная легендарная — нельзя
  begin perform public.clan_shop_equip('frame', 'frame_legend'); r := r || '7:легенд(ПЛОХО) ';
  exception when others then r := r || '7:' || sqlerrm || ' '; end;
  -- 8. снять рамку
  begin perform public.clan_shop_equip('frame', null); r := r || '8:снял=' || coalesce((select frame from public.clan_equipped where clan_id = 36), 'null') || ' ';
  exception when others then r := r || '8:' || sqlerrm || ' '; end;
  -- 9. не глава (участник) — нельзя
  perform set_config('request.jwt.claims', '{"sub":"60bdeee7-fd45-4223-a4bd-805e1954226f","role":"authenticated"}', true);
  begin perform public.clan_shop_equip('frame', 'frame_champion'); r := r || '9:участник надел(ПЛОХО) ';
  exception when others then r := r || '9:' || sqlerrm || ' '; end;
  r := r || '| grants=' || (select string_agg(grantee || ':' || privilege_type, ',' order by grantee) from information_schema.routine_privileges where routine_schema = 'public' and routine_name = 'clan_shop_equip');
  raise exception 'DRYRUN %', r;
end $$;
