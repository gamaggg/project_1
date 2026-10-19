-- Задания недели привязаны к городу (20.10.2026, вариант А владельца): набор выдан для города и
-- считает уловы только в нём, поэтому в другом городе он не показывается.
--  - sync_my_challenges: показывает только набор текущего города; новый набор выдаётся, только
--    если у игрока нет действующего набора ни в одном городе (раньше «неделя» считалась по
--    часовому поясу, и у городов с одним поясом — Москва, Петербург, Сочи — игрок, сменив город,
--    видел старый набор с прогрессом нового города);
--  - get_my_other_city_challenges: в каком городе у игрока действующий набор, если в текущем
--    набора нет (для текста «задания этой недели выданы для …»);
--  - get_my_challenge_week_state: число заданий считается по городу профиля;
--  - buy_extra_challenge: дополнительное задание — только к набору этого города;
--  - notify_challenge_deadline_approaching: напоминание только игрокам, чей набор — этого города.
-- Старые определения — в _city_migration_backup. Откат: 07_challenges_per_city_ROLLBACK.sql
do $mig$
declare
  v_def text;
  v_new text;
begin
  -- 1. sync_my_challenges
  v_def := pg_get_functiondef('public.sync_my_challenges(text,text)'::regprocedure);
  v_new := replace(v_def,
    'if not exists (select 1 from public.user_challenges uc2 where uc2.user_id = v_uid and uc2.week_start = v_week_start) then',
    'if not exists (select 1 from public.user_challenges uc2 where uc2.user_id = v_uid and uc2.week_start <= now() and uc2.week_start + interval ''7 days'' > now()) then');
  if v_new = v_def then raise exception 'sync_my_challenges: generation condition not found'; end if;
  v_def := v_new;
  v_new := replace(v_def,
    E'  where uc.user_id = v_uid and uc.week_start = v_week_start\n  order by array_position',
    E'  where uc.user_id = v_uid and uc.week_start = v_week_start and (uc.city = p_city or uc.city is null)\n  order by array_position');
  if v_new = v_def then raise exception 'sync_my_challenges: return filter not found'; end if;
  insert into public._city_migration_backup (fn_oid, proname, def)
  values ('public.sync_my_challenges(text,text)'::regprocedure::oid, 'sync_my_challenges',
          pg_get_functiondef('public.sync_my_challenges(text,text)'::regprocedure));
  execute v_new;

  -- 2. notify_challenge_deadline_approaching
  v_def := pg_get_functiondef('public.notify_challenge_deadline_approaching(text,text)'::regprocedure);
  v_new := replace(v_def, E'    and p.city = p_city\n', E'    and uc.city = p_city\n    and p.city = p_city\n');
  v_new := replace(v_new, 'where uc2.user_id = uc.user_id and uc2.week_start = v_week_start and uc2.completed_at is null',
                          'where uc2.user_id = uc.user_id and uc2.week_start = v_week_start and uc2.city = p_city and uc2.completed_at is null');
  if v_new = v_def or v_new not like '%uc.city = p_city%' or v_new not like '%uc2.city = p_city%' then
    raise exception 'notify_challenge_deadline_approaching: places not found';
  end if;
  insert into public._city_migration_backup (fn_oid, proname, def)
  values ('public.notify_challenge_deadline_approaching(text,text)'::regprocedure::oid, 'notify_challenge_deadline_approaching', v_def);
  execute v_new;

  -- 3. buy_extra_challenge: only on top of this city's set
  v_def := pg_get_functiondef('public.buy_extra_challenge(text,text)'::regprocedure);
  v_new := replace(v_def,
    E'  v_week_start := date_trunc(''week'', now() at time zone p_timezone) at time zone p_timezone;\n\n  insert into public.user_challenge_weeks',
    E'  v_week_start := date_trunc(''week'', now() at time zone p_timezone) at time zone p_timezone;\n\n  if not exists (select 1 from public.user_challenges where user_id = v_uid and week_start = v_week_start and city = p_city) then\n    raise exception ''no challenges for this city this week'';\n  end if;\n\n  insert into public.user_challenge_weeks');
  if v_new = v_def then raise exception 'buy_extra_challenge: place not found'; end if;
  insert into public._city_migration_backup (fn_oid, proname, def)
  values ('public.buy_extra_challenge(text,text)'::regprocedure::oid, 'buy_extra_challenge', v_def);
  execute v_new;

  -- 4. get_my_challenge_week_state: the count is of the profile city's set
  v_def := pg_get_functiondef('public.get_my_challenge_week_state(text)'::regprocedure);
  v_new := replace(v_def,
    'where uc.user_id = v_uid and uc.week_start = v_week_start),',
    'where uc.user_id = v_uid and uc.week_start = v_week_start and (uc.city = public._profile_city(v_uid) or uc.city is null)),');
  if v_new = v_def then raise exception 'get_my_challenge_week_state: place not found'; end if;
  insert into public._city_migration_backup (fn_oid, proname, def)
  values ('public.get_my_challenge_week_state(text)'::regprocedure::oid, 'get_my_challenge_week_state', v_def);
  execute v_new;
end
$mig$;

-- 5. In which city the player's current set is, when the current city has none.
create or replace function public.get_my_other_city_challenges(p_city text) returns text
  language sql stable security definer set search_path to 'public'
  as $$
  select uc.city
  from public.user_challenges uc
  where uc.user_id = auth.uid()
    and uc.city is not null and uc.city <> p_city
    and uc.week_start <= now() and uc.week_start + interval '7 days' > now()
    and not exists (
      select 1 from public.user_challenges m
      where m.user_id = auth.uid() and m.city = p_city
        and m.week_start <= now() and m.week_start + interval '7 days' > now())
  order by uc.week_start desc
  limit 1
$$;
revoke all on function public.get_my_other_city_challenges(text) from public, anon;
grant execute on function public.get_my_other_city_challenges(text) to authenticated, service_role;
