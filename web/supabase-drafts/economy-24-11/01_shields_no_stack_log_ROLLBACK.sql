-- Откат 01 (24.11.2026): use_free_shield — как до 24.11 (щит поверх щита +24 ч), Прилив без журнала, таблица убрана.
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
  -- 20.11: штаб в осаде — щит не поможет (осаду снимает только улов на секторе), а при падении штаба ушёл бы
  -- к захватчику. Не ставим; щит остаётся в запасе.
  if exists (select 1 from public.clan_sieges s where s.territory_id = p_territory_id) then
    raise exception 'HQ_SIEGE';
  end if;
  update public.profiles set free_shields = free_shields - 1 where id = v_uid and free_shields > 0;
  if not found then
    raise exception 'no free shields';
  end if;
  update public.territories set shield_until = greatest(coalesce(shield_until, now()), now()) + interval '24 hours' where id = p_territory_id;
end;
$function$;

do $rollback$
declare
  v_def text := pg_get_functiondef('public.confirm_catch(text,text,text,integer,numeric,text,text,timestamptz)'::regprocedure);
begin
  v_def := replace(v_def, $b$
      -- 24.11.2026 (Щ2): журнал постановок щита.
      insert into public.shield_uses (user_id, territory_id, source, shield_until) values (v_uid, p_territory_id, 'tide', now() + interval '48 hours');$b$, '');
  if position('shield_uses' in v_def) > 0 then
    raise exception 'confirm_catch rollback: leftovers of 01 remain';
  end if;
  execute v_def;
end $rollback$;

drop table if exists public.shield_uses;
