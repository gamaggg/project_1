-- Большое обновление: «Первые шаги» — список заданий новичка с наградой 100 монет (решение 05.10).
-- Шаги считаются по реальным данным игрока, поэтому прогресс один и тот же на любом устройстве:
--   catch     — поймал первую рыбу;
--   treasury  — забрал Казну;
--   daily     — забрал ежедневную награду;
--   fortify   — поймал 2 рыбы в одном секторе (укрепил защиту);
--   challenge — выполнил челлендж недели;
--   clan      — вступил в клан (или создал).
-- Кому: новым игрокам и старым без уловов. Старых с уловами в день релиза отмечаем
-- eligible = false (release-шаг ниже, в комментарии) — им вместо этого тур «Что нового».
-- Нет строки в таблице = новичок, награда не получена.

create table public.first_steps (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  eligible boolean not null default true,
  claimed_at timestamptz
);
alter table public.first_steps enable row level security;
revoke all on public.first_steps from public, anon, authenticated;
grant all on public.first_steps to service_role;

create function public._first_steps_state(p_uid uuid)
 returns jsonb
 language sql
 stable
 security definer
 set search_path to 'public'
as $function$
  select jsonb_build_object(
    'eligible', coalesce((select f.eligible from public.first_steps f where f.user_id = p_uid), true),
    'claimed', (select f.claimed_at from public.first_steps f where f.user_id = p_uid) is not null,
    'reward', 100,
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
revoke all on function public._first_steps_state(uuid) from public, anon, authenticated;

create function public.get_first_steps()
 returns jsonb
 language plpgsql
 stable
 security definer
 set search_path to 'public'
as $function$
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  return public._first_steps_state(auth.uid());
end;
$function$;
revoke all on function public.get_first_steps() from public, anon;
grant execute on function public.get_first_steps() to authenticated;

-- Забрать награду: только новичку, один раз, когда выполнены все шаги.
create function public.claim_first_steps()
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_uid uuid := auth.uid();
  v_state jsonb;
  v_balance int;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  perform 1 from public.profiles where id = v_uid for update;
  v_state := public._first_steps_state(v_uid);
  if not (v_state->>'eligible')::boolean then raise exception 'FIRST_STEPS:not_eligible'; end if;
  if (v_state->>'claimed')::boolean then raise exception 'FIRST_STEPS:claimed'; end if;
  if exists (select 1 from jsonb_each_text(v_state->'steps') s where s.value <> 'true') then
    raise exception 'FIRST_STEPS:incomplete';
  end if;
  insert into public.first_steps (user_id, eligible, claimed_at) values (v_uid, true, now())
  on conflict (user_id) do update set claimed_at = now();
  update public.profiles set coins = coins + 100 where id = v_uid returning coins into v_balance;
  insert into public.coin_transactions (user_id, amount, reason, label) values (v_uid, 100, 'first_steps', 'Первые шаги');
  return jsonb_build_object('coins', 100, 'balance', v_balance);
end;
$function$;
revoke all on function public.claim_first_steps() from public, anon;
grant execute on function public.claim_first_steps() to authenticated;

-- РЕЛИЗ (в релизной миграции, не сейчас): старые игроки с уловами — не новички.
--   insert into public.first_steps (user_id, eligible)
--   select distinct c.user_id, false from public.catches c
--   on conflict (user_id) do update set eligible = false where public.first_steps.claimed_at is null;
