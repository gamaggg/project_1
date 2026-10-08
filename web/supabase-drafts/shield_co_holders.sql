-- Щит может поставить и совладелец сектора (доля в territory_shares), а не
-- только хозяин (просьба 09.10). Остальное как было: щит из своего запаса,
-- +24 часа поверх действующего.
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
