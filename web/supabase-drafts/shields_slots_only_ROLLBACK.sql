-- Restores buying a shield onto a sector and shields without a reserve cap.
create or replace function public.buy_shield(p_territory_id text)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_uid uuid := auth.uid();
  v_price int;
  v_name text;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;

  select price, name into v_price, v_name from public.buffs where id = 'shield';

  if not exists (select 1 from public.territories where id = p_territory_id and owner_id = v_uid and not is_deleted) then
    raise exception 'not your sector';
  end if;

  update public.profiles set coins = coins - v_price where id = v_uid and coins >= v_price;
  if not found then raise exception 'not enough coins'; end if;

  update public.territories set shield_until = now() + interval '24 hours' where id = p_territory_id;
  insert into public.coin_transactions (user_id, amount, reason, label) values (v_uid, -v_price, 'buy_shield', v_name || ' · ' || p_territory_id);
end;
$function$;

do $m$
declare
  d text := pg_get_functiondef('public.spin_slots'::regproc);
  n text;
begin
  n := replace(d,
$b$    v_prize := 'shield';
    -- At most 3 shields in reserve: one won on top of a full reserve pays 70 coins.
    if (select free_shields from public.profiles where id = v_uid) >= 3 then
      v_coins := 70;
    else
      update public.profiles set free_shields = free_shields + 1 where id = v_uid;
    end if;$b$,
$a$    v_prize := 'shield';
    update public.profiles set free_shields = free_shields + 1 where id = v_uid;$a$);
  n := replace(n,
$b$      when 'triple' then 'Слоты: три в ряд'
      when 'shield' then 'Слоты: щит, запас полон'$b$,
$a$      when 'triple' then 'Слоты: три в ряд'$a$);
  if n = d then raise exception 'spin_slots: rollback did not apply'; end if;
  execute n;
end
$m$;
