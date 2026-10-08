-- Shields: slots only, at most 3 in reserve (decided 07.10).
-- 1) Not for sale anywhere: buy_shield keeps its signature so a tab still on
--    the old build gets a clear refusal instead of «function not found».
-- 2) spin_slots: a shield won on top of a full reserve (3) pays 70 coins
--    instead; the prize stays 'shield' (coins > 0 tells the app), so old
--    builds still render it. Patched in place from the live definition — only
--    the shield branch and the ledger label change — and it refuses to run if
--    the expected lines aren't there.

create or replace function public.buy_shield(p_territory_id text)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  raise exception 'SHIELD_NOT_FOR_SALE';
end;
$function$;

do $m$
declare
  d text := pg_get_functiondef('public.spin_slots'::regproc);
  n text;
begin
  n := replace(d,
$a$    v_prize := 'shield';
    update public.profiles set free_shields = free_shields + 1 where id = v_uid;$a$,
$b$    v_prize := 'shield';
    -- At most 3 shields in reserve: one won on top of a full reserve pays 70 coins.
    if (select free_shields from public.profiles where id = v_uid) >= 3 then
      v_coins := 70;
    else
      update public.profiles set free_shields = free_shields + 1 where id = v_uid;
    end if;$b$);
  n := replace(n,
$a$      when 'triple' then 'Слоты: три в ряд'$a$,
$b$      when 'triple' then 'Слоты: три в ряд'
      when 'shield' then 'Слоты: щит, запас полон'$b$);
  if n = d or position('v_coins := 70;' in n) = 0 or position('запас полон' in n) = 0 then
    raise exception 'spin_slots: patch did not apply';
  end if;
  execute n;
end
$m$;
