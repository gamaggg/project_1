-- Откат 05: убрать девять челленджей (и их строки у игроков), вернуть _challenge_eligible и _challenge_progress_new
-- к виду до 05 (07.11.2026).
delete from public.user_challenges where challenge_id in ('vznos','idu','plechom','dvoynoy_ulov','strazh_shtaba','za_klan','spasatel','shturm','verbovshik');
delete from public.challenges where id in ('vznos','idu','plechom','dvoynoy_ulov','strazh_shtaba','za_klan','spasatel','shturm','verbovshik');

create or replace function public._challenge_eligible(p_uid uuid, p_metric text)
 returns boolean
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select case
    when p_metric = 'clan_messages_sent'
      then exists (select 1 from public.clan_members m where m.user_id = p_uid and m.left_at is null)
    when p_metric in ('geo_correct', 'geo_days')
      then exists (select 1 from public.geo_panoramas g where g.city = public._profile_city(p_uid) and g.status = 'approved')
    when p_metric = 'catch_hot_sector'
      then exists (select 1 from public.hot_sectors h where h.city = public._profile_city(p_uid))
    else true
  end;
$function$;

-- The clan metrics come out of _challenge_progress_new by the same anchor they went in by.
do $rollback$
declare
  v_def text;
  v_from int;
  v_to int;
begin
  v_def := pg_get_functiondef('public._challenge_progress_new(uuid,text,jsonb,timestamptz,timestamptz,text,text)'::regprocedure);
  v_from := position(E'\n  -- Клановые челленджи (05_clan_challenges.sql).' in v_def);
  if v_from = 0 then
    raise notice '_challenge_progress_new has no clan metrics: nothing to take out';
    return;
  end if;
  v_to := position(E'  end if;\n\n  return coalesce(v_result, 0);' in v_def);
  v_def := substr(v_def, 1, v_from - 1) || E'\n' || substr(v_def, v_to);
  execute v_def;
end
$rollback$;
