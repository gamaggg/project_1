-- Щ1 + Щ2 (24.11.2026). ЧЕРНОВИК, применять только после «применяй». Применять ПОСЛЕ shield-armor-24-11/01.
--
-- Щ1: щит нельзя ставить поверх щита. Пока на секторе стоит щит (из запаса или Прилив), use_free_shield отказывает
--     SHIELD_ACTIVE, щит остаётся в запасе. Новый щит — ровно 24 часа от момента постановки (было: +24 ч к остатку,
--     три подряд давали 72 часа).
-- Щ2: каждая постановка щита пишется в shield_uses (кто, какой сектор, запас или Прилив, до когда). Игрокам таблица
--     не видна: RLS включён, у anon / authenticated прав нет, пишут только функции (security definer).

create table if not exists public.shield_uses (
  id bigserial primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  territory_id text not null,
  source text not null check (source in ('reserve', 'tide')),
  shield_until timestamptz not null,
  created_at timestamptz not null default now()
);
create index if not exists shield_uses_territory_idx on public.shield_uses (territory_id, created_at desc);
create index if not exists shield_uses_user_idx on public.shield_uses (user_id, created_at desc);
alter table public.shield_uses enable row level security;
revoke all on table public.shield_uses from public, anon, authenticated;
revoke all on sequence public.shield_uses_id_seq from public, anon, authenticated;

-- use_free_shield: сигнатура та же (без DEFAULT), права сохраняются при CREATE OR REPLACE.
create or replace function public.use_free_shield(p_territory_id text)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_uid uuid := auth.uid();
  v_until timestamptz := now() + interval '24 hours';
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
  -- 24.11.2026 (Щ1): щит поверх щита не ставится — сначала пусть кончится этот. Щит остаётся в запасе.
  if exists (select 1 from public.territories t where t.id = p_territory_id and t.shield_until > now()) then
    raise exception 'SHIELD_ACTIVE';
  end if;
  update public.profiles set free_shields = free_shields - 1 where id = v_uid and free_shields > 0;
  if not found then
    raise exception 'no free shields';
  end if;
  update public.territories set shield_until = v_until where id = p_territory_id;
  insert into public.shield_uses (user_id, territory_id, source, shield_until) values (v_uid, p_territory_id, 'reserve', v_until);
end;
$function$;

-- Прилив в confirm_catch: тот же журнал. Правка по якорю (ровно одно вхождение, иначе ошибка и ничего не меняется);
-- CREATE OR REPLACE из pg_get_functiondef сохраняет DEFAULT у параметров.
do $migration$
declare
  v_def text := pg_get_functiondef('public.confirm_catch(text,text,text,integer,numeric,text,text,timestamptz)'::regprocedure);
  a_tide constant text := $a$      update public.territories t set shield_until = now() + interval '48 hours' where t.id = p_territory_id;$a$;
begin
  if (length(v_def) - length(replace(v_def, a_tide, ''))) / length(a_tide) <> 1 then
    raise exception 'confirm_catch: anchor not found exactly once: %', left(a_tide, 60);
  end if;
  v_def := replace(v_def, a_tide, a_tide || $b$
      -- 24.11.2026 (Щ2): журнал постановок щита.
      insert into public.shield_uses (user_id, territory_id, source, shield_until) values (v_uid, p_territory_id, 'tide', now() + interval '48 hours');$b$);
  execute v_def;
end $migration$;
