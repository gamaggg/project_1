-- Массовый подарок от супер-админа (решение 06.10): выбранным игрокам или всем — монеты и/или
-- бонусные прокруты слотов (slot_bonus_spins: не сгорают, тратятся после обычных) и, если хочется,
-- пара слов. Каждому — уведомление admin_gift в «Активности» (в Telegram не уходит: вида нет в
-- белом списке queue_telegram_notification). Заблокированным не начисляется.
-- Монеты в истории — «Подарок от RANGE» (reason admin_gift). В журнал админа — одна строка на раздачу.

create function public.admin_gift(p_user_ids uuid[], p_coins integer, p_spins integer, p_note text default null)
 returns integer
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_admin uuid := auth.uid();
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
  v_coins int := coalesce(p_coins, 0);
  v_spins int := coalesce(p_spins, 0);
  v_ids uuid[];
  v_n int;
begin
  if not exists (select 1 from public.profiles where id = v_admin and is_super_admin) then
    raise exception 'not authorized';
  end if;
  if v_coins < 0 or v_coins > 10000 or v_spins < 0 or v_spins > 100 or (v_coins = 0 and v_spins = 0) then
    raise exception 'GIFT:amount';
  end if;
  if v_note is not null and char_length(v_note) > 200 then raise exception 'GIFT:note'; end if;
  if p_user_ids is not null and cardinality(p_user_ids) = 0 then raise exception 'GIFT:nobody'; end if;

  v_ids := array(select p.id from public.profiles p
                  where (p_user_ids is null or p.id = any(p_user_ids)) and not coalesce(p.is_blocked, false));
  v_n := coalesce(cardinality(v_ids), 0);
  if v_n = 0 then raise exception 'GIFT:nobody'; end if;

  if v_coins > 0 then
    update public.profiles p set coins = p.coins + v_coins where p.id = any(v_ids);
    insert into public.coin_transactions (user_id, amount, reason, label)
    select id, v_coins, 'admin_gift', 'Подарок от RANGE' from unnest(v_ids) as id;
  end if;
  if v_spins > 0 then
    insert into public.slot_bonus_spins as b (user_id, spins)
    select id, v_spins from unnest(v_ids) as id
    on conflict (user_id) do update set spins = b.spins + excluded.spins;
  end if;

  insert into public.notifications (user_id, kind, actor_id, payload)
  select id, 'admin_gift', v_admin, jsonb_strip_nulls(jsonb_build_object('coins', v_coins, 'spins', v_spins, 'note', v_note))
  from unnest(v_ids) as id;

  insert into public.admin_actions (admin_id, action, details)
  values (v_admin, 'gift',
          'Подарок ' || v_n || ' игрок(ам)' || case when p_user_ids is null then ' — всем' else '' end || ': '
          || concat_ws(' и ', case when v_coins > 0 then v_coins || ' монет' end, case when v_spins > 0 then v_spins || ' прокрутов' end)
          || coalesce(' · «' || v_note || '»', ''));
  return v_n;
end;
$function$;
revoke all on function public.admin_gift(uuid[], integer, integer, text) from public, anon;
grant execute on function public.admin_gift(uuid[], integer, integer, text) to authenticated;
