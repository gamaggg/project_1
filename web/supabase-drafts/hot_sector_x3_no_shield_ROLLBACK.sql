-- Откат hot_sector_x3_no_shield.sql: горячий сектор снова ×2 поверх удвоения
-- (вместе ×4), Прилив срабатывает и на горячем, щит на горячий ставится.

do $mig$
declare
  d text := pg_get_functiondef('public.confirm_catch'::regproc);
begin
  d := replace(d, $o$  v_multiplier := public.coin_multiplier(v_uid);
  v_hot := exists (select 1 from public.hot_sectors hs where hs.territory_id = p_territory_id and v_at >= hs.starts_at and v_at < hs.ends_at);
$o$, $n$  v_multiplier := public.coin_multiplier(v_uid);
$n$);
  d := replace(d, $o$    -- Горячий сектор — ×2 за улов, вместе с «Двойными монетами» ×3, не ×4.
    v_species_coins := v_species_coins * case when v_hot then v_multiplier + 1 else v_multiplier end;
$o$, $n$    v_species_coins := v_species_coins * v_multiplier;
    v_hot := exists (select 1 from public.hot_sectors hs where hs.territory_id = p_territory_id and v_at >= hs.starts_at and v_at < hs.ends_at);
    if v_hot then
      v_species_coins := v_species_coins * 2;
    end if;
$n$);
  d := replace(d, $o$case when v_hot then ' · горячий сектор ×' || (v_multiplier + 1) else '' end$o$,
                  $n$case when v_hot then ' · горячий сектор ×2' else '' end$n$);
  d := replace(d, $o$    -- На горячем секторе Прилив не срабатывает — щит туда не ставится.
    where not v_hot and ab.user_id = v_uid and ab.buff_id = 'tide' and ab.consumed = false and ab.expires_at > now()
$o$, $n$    where ab.user_id = v_uid and ab.buff_id = 'tide' and ab.consumed = false and ab.expires_at > now()
$n$);
  if position('v_multiplier + 1' in d) > 0 then raise exception 'rollback: confirm_catch not restored'; end if;
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
  update public.profiles set free_shields = free_shields - 1 where id = v_uid and free_shields > 0;
  if not found then
    raise exception 'no free shields';
  end if;
  update public.territories set shield_until = greatest(coalesce(shield_until, now()), now()) + interval '24 hours' where id = p_territory_id;
end;
$function$;
