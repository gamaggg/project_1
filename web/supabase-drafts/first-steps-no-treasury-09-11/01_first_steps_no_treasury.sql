-- «Первые шаги» без «Забери Казну» (09.11.2026, решение владельца «убери у новичков этот пункт»). ЧЕРНОВИК, применять
-- только после «применяй». Личная Казна закрыта (retire_personal_treasury, 09.11), собрать её больше нельзя — шаг
-- «treasury» новичку не выполнить, а claim_first_steps платит 100 монет только когда выполнены ВСЕ шаги из steps.
-- Здесь шаг просто убран из steps; claim_first_steps не меняется (проверяет то, что есть в steps). Приложение
-- (FirstSteps.tsx) уже без этого шага и лишний ключ в ответе не читает — выкладывать приложение можно раньше миграции.
-- Сигнатура и права не меняются (create or replace, без drop).
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
    -- «Забери Казну» убран 09.11.2026 вместе с личной Казной.
    'steps', jsonb_build_object(
      'catch', exists (select 1 from public.catches c where c.user_id = p_uid),
      'daily', exists (select 1 from public.daily_rewards d where d.user_id = p_uid),
      'fortify', exists (select 1 from public.catches c where c.user_id = p_uid group by c.territory_id having count(*) >= 2),
      'challenge', exists (select 1 from public.user_challenges u where u.user_id = p_uid and u.completed_at is not null),
      'clan', exists (select 1 from public.clan_members m where m.user_id = p_uid)
    )
  );
$function$;
