-- Горячий сектор (09.10.2026, по просьбе):
-- 1. С «Двойными монетами» улов на горячем секторе — ×3, а не ×4: горячий
--    сектор сам по себе ×2, удвоение добавляет +1, а не умножает. Захват
--    (25 × удвоение) и Казна не меняются.
-- 2. На горячий сектор нельзя поставить щит (use_free_shield → HOT_SECTOR),
--    и Прилив при захвате горячего сектора не срабатывает — остаётся на
--    следующий захват. Щит, поставленный до того, как сектор стал горячим,
--    достаивает свой срок.
-- confirm_catch правится точечно по тексту текущей функции (сигнатура и
-- DEFAULT'ы остаются как есть); если какой-то кусок не найден — ошибка, и
-- ничего не меняется.

do $mig$
declare
  d text := pg_get_functiondef('public.confirm_catch'::regproc);
begin
  -- v_hot считается сразу, рядом с удвоением: он нужен и монетам, и Приливу.
  if position($o$  v_multiplier := public.coin_multiplier(v_uid);
$o$ in d) = 0 then raise exception 'confirm_catch: multiplier line not found'; end if;
  d := replace(d, $o$  v_multiplier := public.coin_multiplier(v_uid);
$o$, $n$  v_multiplier := public.coin_multiplier(v_uid);
  v_hot := exists (select 1 from public.hot_sectors hs where hs.territory_id = p_territory_id and v_at >= hs.starts_at and v_at < hs.ends_at);
$n$);

  if position($o$    v_species_coins := v_species_coins * v_multiplier;
    v_hot := exists (select 1 from public.hot_sectors hs where hs.territory_id = p_territory_id and v_at >= hs.starts_at and v_at < hs.ends_at);
    if v_hot then
      v_species_coins := v_species_coins * 2;
    end if;
$o$ in d) = 0 then raise exception 'confirm_catch: species block not found'; end if;
  d := replace(d, $o$    v_species_coins := v_species_coins * v_multiplier;
    v_hot := exists (select 1 from public.hot_sectors hs where hs.territory_id = p_territory_id and v_at >= hs.starts_at and v_at < hs.ends_at);
    if v_hot then
      v_species_coins := v_species_coins * 2;
    end if;
$o$, $n$    -- Горячий сектор — ×2 за улов, вместе с «Двойными монетами» ×3, не ×4.
    v_species_coins := v_species_coins * case when v_hot then v_multiplier + 1 else v_multiplier end;
$n$);

  if position($o$case when v_hot then ' · горячий сектор ×2' else '' end$o$ in d) = 0 then raise exception 'confirm_catch: label not found'; end if;
  d := replace(d, $o$case when v_hot then ' · горячий сектор ×2' else '' end$o$,
                  $n$case when v_hot then ' · горячий сектор ×' || (v_multiplier + 1) else '' end$n$);

  if position($o$    where ab.user_id = v_uid and ab.buff_id = 'tide' and ab.consumed = false and ab.expires_at > now()
$o$ in d) = 0 then raise exception 'confirm_catch: tide select not found'; end if;
  d := replace(d, $o$    where ab.user_id = v_uid and ab.buff_id = 'tide' and ab.consumed = false and ab.expires_at > now()
$o$, $n$    -- На горячем секторе Прилив не срабатывает — щит туда не ставится.
    where not v_hot and ab.user_id = v_uid and ab.buff_id = 'tide' and ab.consumed = false and ab.expires_at > now()
$n$);

  execute d;
end
$mig$;

create or replace function public.use_free_shield(p_territory_id text)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;
  if not exists (
    select 1 from public.territories t
    where t.id = p_territory_id and not t.is_deleted
      and (t.owner_id = v_uid
        or exists (select 1 from public.territory_shares s where s.territory_id = t.id and s.user_id = v_uid))
  ) then
    raise exception 'not your sector';
  end if;
  -- Горячий сектор открыт для всех до конца недели: щит на него не ставится.
  if exists (select 1 from public.hot_sectors hs where hs.territory_id = p_territory_id and now() >= hs.starts_at and now() < hs.ends_at) then
    raise exception 'HOT_SECTOR';
  end if;
  update public.profiles set free_shields = free_shields - 1 where id = v_uid and free_shields > 0;
  if not found then
    raise exception 'no free shields';
  end if;
  update public.territories set shield_until = greatest(coalesce(shield_until, now()), now()) + interval '24 hours' where id = p_territory_id;
end;
$function$;
