-- 07 · Чужие базы на карте (решение владельца 08.11.2026). ЧЕРНОВИК, применять только после «применяй».
-- Зависит от 01 (clan_treasury.projects), 02 (clan_hq, clan_sieges), 03 (clan_hq_ruins). Порядок: 01 → … → 06 → 07.
--
-- Штабы видны всем (политика «hq: all read» из 02), а постройки клана лежат в clan_treasury, которую читают только
-- участники. Карте и экрану сектора нужно знать про каждый клан города: где штаб, в осаде ли он, где руины и какие
-- постройки какого уровня — без баланса общака и прочего. Это и только это отдаёт get_clan_bases.
-- Клиент: lib/clan2/live/otherHqs.ts (сейчас там предпросмотр: штаб на самом ловимом секторе клана, постройки условные).

create or replace function public.get_clan_bases(p_city text)
returns table (clan_id bigint, territory_id text, under_siege boolean, ruins_territory_id text, projects jsonb)
language sql stable security definer set search_path = public as $$
  select c.id,
         h.territory_id,
         exists (select 1 from public.clan_sieges s where s.territory_id = h.territory_id and s.ends_at > now()),
         (select r.territory_id from public.clan_hq_ruins r where r.clan_id = c.id and r.until > now()),
         coalesce((select jsonb_object_agg(k, v) from jsonb_each(t.projects) as e(k, v)
                    where k in ('dock', 'beacon', 'fort', 'board', 'storage', 'market')), '{}'::jsonb)
  from public.clans c
  left join public.clan_hq h on h.clan_id = c.id
  left join public.clan_treasury t on t.clan_id = c.id
  where c.city = p_city and c.disbanded_at is null
    and (h.territory_id is not null or exists (select 1 from public.clan_hq_ruins r where r.clan_id = c.id and r.until > now()));
$$;
revoke all on function public.get_clan_bases(text) from public, anon;
grant execute on function public.get_clan_bases(text) to authenticated;
