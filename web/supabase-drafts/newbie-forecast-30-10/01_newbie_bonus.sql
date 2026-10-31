-- Задание новичка (30.10.2026, по просьбе владельца): первый улов в течение 7 дней после регистрации —
-- монеты за вид втрое (к обычной цене вида ещё две цены) и щит в запас (не больше 3, как всегда).
-- Зачем: за 30 дней до 30.10 зарегистрировались 92 человека, рыбу поймали 12, из них 9 в первую неделю.
--
-- 1) Триггер на catches: первый улов игрока, не позже 7 дней от profiles.created_at, бонус ещё не выдавался.
--    Монеты пишутся как catch_reward с catch_id: модератор, удаляя улов (admin_delete_catch), списывает их
--    вместе с остальными монетами улова, а смена вида (admin_edit_catch) пересчитывает по цене вида.
--    Ошибка внутри никогда не мешает сохранить улов.
-- 2) _first_steps_state отдаёт newbie_until — до какого момента действует задание (null, когда уже нет):
--    плашка «Первые шаги» на карте показывает обратный отсчёт.
-- 3) onboarding_due: два новых напоминания в Telegram — на 3-й день («осталось 4 дня») и на 6-й
--    («последний день»), у трёх с датой окончания; старые шаги не менялись, только приоритеты.
-- Откат: 01_newbie_bonus_ROLLBACK.sql.

create or replace function public._newbie_first_catch_bonus()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $fn$
declare
  v_created timestamptz;
  v_value int;
  v_bonus int := 0;
begin
  select p.created_at into v_created from public.profiles p where p.id = new.user_id;
  if v_created is null or new.caught_at > v_created + interval '7 days' then
    return new;
  end if;
  if exists (select 1 from public.catches c where c.user_id = new.user_id and c.id <> new.id) then
    return new;
  end if;
  -- Один раз: если первый улов удалил модератор, следующий бонус уже не даёт.
  if exists (select 1 from public.notifications n
             where n.user_id = new.user_id and n.kind = 'award_granted' and n.payload->>'title' = 'Задание новичка выполнено') then
    return new;
  end if;

  select s.coin_value into v_value from public.species s where s.key = new.species;
  v_bonus := 2 * coalesce(v_value, 0);
  if v_bonus > 0 then
    update public.profiles set coins = coins + v_bonus where id = new.user_id;
    insert into public.coin_transactions (user_id, amount, reason, label, catch_id)
    values (new.user_id, v_bonus, 'catch_reward', 'Задание новичка: первый улов ×3', new.id);
  end if;
  update public.profiles set free_shields = least(3, coalesce(free_shields, 0) + 1) where id = new.user_id;

  insert into public.notifications (user_id, kind, payload)
  values (new.user_id, 'award_granted', jsonb_build_object(
    'title', 'Задание новичка выполнено',
    'subtitle', case when v_bonus > 0 then 'Первый улов ×3: +' || v_bonus || ' монет и щит в запас' else 'Щит в запас' end,
    'coins', v_bonus));
  return new;
exception when others then
  raise warning '_newbie_first_catch_bonus: %', sqlerrm;
  return new;
end;
$fn$;

revoke all on function public._newbie_first_catch_bonus() from public, anon, authenticated;

drop trigger if exists catches_newbie_bonus on public.catches;
create trigger catches_newbie_bonus
  after insert on public.catches
  for each row execute function public._newbie_first_catch_bonus();

CREATE OR REPLACE FUNCTION public._first_steps_state(p_uid uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select jsonb_build_object(
    'eligible', coalesce((select f.eligible from public.first_steps f where f.user_id = p_uid), true),
    'claimed', (select f.claimed_at from public.first_steps f where f.user_id = p_uid) is not null,
    'reward', 100,
    -- Задание новичка: до какого момента первый улов даёт ×3 и щит; null — задания уже нет.
    'newbie_until', (select p.created_at + interval '7 days' from public.profiles p
                     where p.id = p_uid and p.created_at + interval '7 days' > now()
                       and not exists (select 1 from public.catches c where c.user_id = p_uid)),
    'steps', jsonb_build_object(
      'catch', exists (select 1 from public.catches c where c.user_id = p_uid),
      'treasury', exists (select 1 from public.treasury_collections t where t.user_id = p_uid),
      'daily', exists (select 1 from public.daily_rewards d where d.user_id = p_uid),
      'fortify', exists (select 1 from public.catches c where c.user_id = p_uid group by c.territory_id having count(*) >= 2),
      'challenge', exists (select 1 from public.user_challenges u where u.user_id = p_uid and u.completed_at is not null),
      'clan', exists (select 1 from public.clan_members m where m.user_id = p_uid)
    )
  );
$function$;

CREATE OR REPLACE FUNCTION public.onboarding_due(p_limit integer DEFAULT 200)
 RETURNS TABLE(chat_id bigint, user_id uuid, step text, city text, name text, data jsonb)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  with
  reg as (
    select p.id, p.telegram_id as chat_id, p.city, p.display_name, p.created_at,
           now() at time zone public._city_tz(p.city) as local_now
    from public.profiles p
    where p.telegram_id is not null
      and not coalesce(p.is_blocked, false)
      and coalesce(p.tg_notifications_enabled, false)
      and p.tg_unreachable_at is null
      and not exists (select 1 from public.catches c where c.user_id = p.id)
  ),
  reg_steps as (
    select r.*, s.step, s.prio
    from reg r
    cross join lateral (values
      ('new_2h', 1, now() - r.created_at between interval '2 hours' and interval '26 hours'),
      -- Задание новичка (30.10): напоминание на 3-й день и в последний, 6-й.
      ('new_day3', 2, now() - r.created_at between interval '3 days' and interval '4 days'),
      ('new_day6', 3, now() - r.created_at between interval '6 days' and interval '7 days'),
      ('new_day14', 4, now() - r.created_at between interval '14 days' and interval '15 days'),
      ('new_day7', 5, now() - r.created_at between interval '7 days' and interval '8 days'),
      ('new_friday', 6, extract(isodow from r.local_now) = 5 and extract(hour from r.local_now) between 18 and 20
                        and now() - r.created_at between interval '12 hours' and interval '8 days'),
      ('old_friday', 7, extract(isodow from r.local_now) = 5 and extract(hour from r.local_now) between 18 and 20
                        and now() - r.created_at > interval '15 days')
    ) as s(step, prio, due)
    where s.due and extract(hour from r.local_now) between 10 and 20
  ),
  starts as (
    select s.chat_id, s.started_at, now() at time zone 'Asia/Tbilisi' as local_now
    from public.telegram_bot_starts s
    where s.stopped_at is null
      and not exists (select 1 from public.profiles p where p.telegram_id = s.chat_id)
  ),
  start_steps as (
    select st.chat_id, null::uuid as id, null::text as city, null::text as display_name, x.step, x.prio
    from starts st
    cross join lateral (values
      ('start_day1', 1, now() - st.started_at between interval '1 day' and interval '2 days'),
      ('start_day4', 2, now() - st.started_at between interval '4 days' and interval '5 days')
    ) as x(step, prio, due)
    where x.due and extract(hour from st.local_now) between 10 and 20
  ),
  candidates as (
    select chat_id, id as user_id, city, display_name, step, prio from reg_steps
    union all
    select chat_id, id, city, display_name, step, prio from start_steps
  ),
  fresh as (
    select c.* from candidates c
    where not exists (select 1 from public.onboarding_messages m where m.chat_id = c.chat_id and m.step = c.step)
      and not exists (select 1 from public.onboarding_messages m where m.chat_id = c.chat_id and m.sent_at > now() - interval '20 hours')
  ),
  one_per_chat as (
    select distinct on (chat_id) * from fresh order by chat_id, prio
  )
  select o.chat_id, o.user_id, o.step, o.city, o.display_name,
    case
      when o.step in ('new_2h', 'new_day3') then (
        select jsonb_build_object(
          'free', (select count(*) from public.territories t
                   where not t.is_deleted and t.owner_id is null and left(t.id, 1) = public._city_prefix(o.city)),
          'sector', x.territory_id, 'sector_catches', x.n,
          'until', (select to_char((p.created_at + interval '7 days') at time zone public._city_tz(o.city), 'DD.MM')
                    from public.profiles p where p.id = o.user_id))
        from (select null::text as territory_id, 0::bigint as n
              union all
              select c.territory_id, count(*) as n from public.catches c
              where c.caught_at > now() - interval '7 days' and left(c.territory_id, 1) = public._city_prefix(o.city)
              group by c.territory_id) x
        order by x.n desc limit 1)
      when o.step = 'new_day6' then (
        select jsonb_build_object('until', to_char((p.created_at + interval '7 days') at time zone public._city_tz(o.city), 'DD.MM HH24:MI'))
        from public.profiles p where p.id = o.user_id)
      when o.step in ('new_day7', 'old_friday') then (
        select jsonb_build_object(
          'catches', count(*),
          'best_species', (select s.name from public.catches c2 join public.species s on s.key = c2.species
                           where c2.caught_at > now() - interval '7 days' and left(c2.territory_id, 1) = public._city_prefix(o.city)
                             and c2.length_cm is not null order by c2.length_cm desc limit 1),
          'best_cm', (select max(c3.length_cm) from public.catches c3
                      where c3.caught_at > now() - interval '7 days' and left(c3.territory_id, 1) = public._city_prefix(o.city)))
        from public.catches c
        where c.caught_at > now() - interval '7 days' and left(c.territory_id, 1) = public._city_prefix(o.city))
      else '{}'::jsonb
    end
  from one_per_chat o
  limit least(greatest(coalesce(p_limit, 200), 1), 500);
$function$;
