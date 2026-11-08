-- Откат: тело _first_steps_state до 09.11.2026 (снято с живой базы перед правкой), шаг «treasury» возвращается.
create or replace function public._first_steps_state(p_uid uuid)
 returns jsonb
 language sql
 stable security definer
 set search_path to 'public'
as $function$
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
