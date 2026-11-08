-- 11 · «Выход»: метры Битвы кланов ×1,5 (решение владельца 09.11.2026). ЧЕРНОВИК, применять только после «применяй».
-- Зависит от 01 (clan_economy.buff_min_rsvp) и 02 (clan_buffs, clan_buff_rsvp). Порядок: 01 → … → 10 → 11.
--
-- Улов и захват сектора участника, сделанные во время «Выхода» его клана, на который он сказал «иду» (и «иду» набралось
-- не меньше buff_min_rsvp), дают в Битве кланов в полтора раза больше метров: улов 15 вместо 10, захват 45/75 вместо 30/50.
-- Очки сундука не меняются (они целые: 1 за улов, 3 за захват). Правка _clan_week_events по двум якорям (ровно один раз).

create or replace function public._clan_buff_on_at(p_clan_id bigint, p_user uuid, p_at timestamptz)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.clan_buffs b
     where b.clan_id = p_clan_id and p_at >= b.starts_at and p_at < b.ends_at
       and exists (select 1 from public.clan_buff_rsvp r where r.buff_id = b.id and r.user_id = p_user)
       and (select count(*) from public.clan_buff_rsvp r where r.buff_id = b.id) >= (select e.buff_min_rsvp from public.clan_economy e where e.id = 1)
  );
$$;
revoke all on function public._clan_buff_on_at(bigint, uuid, timestamptz) from public, anon, authenticated;

do $migration$
declare
  v_def text := pg_get_functiondef('public._clan_week_events(bigint,timestamptz)'::regprocedure);
  a_catch constant text := $a$  select k.user_id, k.caught_at, 'catch'::text, 10, 1$a$;
  a_capture constant text := $a$    ) then 50 else 30 end,
    3$a$;
  a text;
begin
  foreach a in array array[a_catch, a_capture] loop
    if (length(v_def) - length(replace(v_def, a, ''))) / length(a) <> 1 then
      raise exception '_clan_week_events: anchor not found exactly once: %', left(a, 60);
    end if;
  end loop;
  v_def := replace(v_def, a_catch, $b$  select k.user_id, k.caught_at, 'catch'::text, case when public._clan_buff_on_at(clan.id, k.user_id, k.caught_at) then 15 else 10 end, 1$b$);
  v_def := replace(v_def, a_capture, $b$    ) then 50 else 30 end * (case when public._clan_buff_on_at(clan.id, al.user_id, al.created_at) then 3 else 2 end) / 2,
    3$b$);
  execute v_def;
end
$migration$;
