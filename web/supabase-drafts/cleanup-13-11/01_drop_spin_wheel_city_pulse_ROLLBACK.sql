-- Откат 01_drop_spin_wheel_city_pulse.sql: обе функции в точности как в живой базе 13.11.2026 (pg_get_functiondef,
-- md5 spin_wheel 5a2259c7…, get_city_pulse 844a9e1d…) и их права.

set local lock_timeout = '3s';

CREATE OR REPLACE FUNCTION public.spin_wheel(p_bet integer)
 RETURNS TABLE(segment_index integer, multiplier numeric, payout integer, new_balance integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_uid uuid := auth.uid();
  -- 12 equal-probability slots, clockwise from the pointer at top — index
  -- order here must exactly match WheelScreen.tsx's rendered slice order,
  -- since the frontend rotates the dial to land on segment_index.
  v_segments numeric[] := array[0,0,2,0,0,2,0,0,2,0,0,3];
  v_idx int;
  v_mult numeric;
  v_payout int;
  v_balance int;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  if p_bet is null or p_bet < 10 then raise exception 'bet below minimum'; end if;

  update public.profiles set coins = coins - p_bet where id = v_uid and coins >= p_bet;
  if not found then raise exception 'not enough coins'; end if;

  v_idx := floor(random() * 12)::int;
  v_mult := v_segments[v_idx + 1];
  v_payout := round(p_bet * v_mult)::int;

  update public.profiles set coins = coins + v_payout where id = v_uid returning coins into v_balance;

  insert into public.coin_transactions (user_id, amount, reason, label)
  values (v_uid, v_payout - p_bet, 'wheel_spin', case when v_mult = 0 then 'ДЭП: пусто' else 'ДЭП: x' || v_mult::int::text end);

  return query select v_idx, v_mult, v_payout, v_balance;
end;
$function$
;
revoke all on function public.spin_wheel(integer) from public, anon, authenticated;
grant execute on function public.spin_wheel(integer) to service_role;

CREATE OR REPLACE FUNCTION public.get_city_pulse(p_city text)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  with week as (
    select c.id, c.user_id, c.territory_id, c.species, c.photo_url, c.caught_at
    from public.catches c
    join public.profiles p on p.id = c.user_id and not coalesce(p.is_blocked, false)
    where c.caught_at > now() - interval '7 days'
      and left(c.territory_id, 1) = public._city_prefix(p_city)
  )
  select jsonb_build_object(
    'catches', (select count(*) from week),
    'anglers', (select count(distinct user_id) from week),
    'captures', (select count(*) from public.activity_log a
                 join public.profiles p on p.id = a.user_id and not coalesce(p.is_blocked, false)
                 where a.kind = 'claim' and a.created_at > now() - interval '7 days'
                   and left(a.territory_id, 1) = public._city_prefix(p_city)),
    'recent', coalesce((
      select jsonb_agg(jsonb_build_object(
        'catch_id', w.id, 'user_id', w.user_id, 'name', p.display_name, 'avatar_url', p.avatar_url,
        'species', s.name, 'photo_url', w.photo_url, 'territory_id', w.territory_id, 'caught_at', w.caught_at
      ) order by w.caught_at desc)
      from (select * from week order by caught_at desc limit 8) w
      join public.profiles p on p.id = w.user_id
      left join public.species s on s.key = w.species
    ), '[]'::jsonb)
  )
  where auth.uid() is not null;
$function$
;
revoke all on function public.get_city_pulse(text) from public, anon;
grant execute on function public.get_city_pulse(text) to authenticated, service_role;
