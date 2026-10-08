-- Back to the technical alert text, client errors only, Telegram only with
-- game notifications on.
create or replace function public.system_health_tick()
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_problems text;
  e record;
begin
  select string_agg(ch.rpc || '(' || array_to_string(ch.keys, ', ') || ') — ' || ch.problem, '; ')
  into v_problems
  from public.admin_rpc_contract_check(
    (select coalesce(jsonb_agg(jsonb_build_object('rpc', w.rpc, 'keys', to_jsonb(w.keys))), '[]'::jsonb) from public.rpc_contract_watch w)
  ) ch;
  if v_problems is not null then
    perform public._system_alert('rpc_contract', 'Сайт вызывает функции базы, которые не находятся: ' || v_problems);
  end if;

  for e in
    select ce.context, count(*) as n, count(distinct ce.user_id) as users,
      (array_agg(ce.message order by ce.created_at desc))[1] as sample
    from public.client_errors ce
    where ce.created_at > now() - interval '10 minutes' and not ce.network
    group by ce.context
  loop
    perform public._system_alert('client:' || e.context,
      format('У игроков ошибка «%s»: %s раз за 10 минут у %s чел. Пример: %s',
             e.context, e.n, e.users, left(coalesce(e.sample, ''), 200)));
  end loop;
end;
$function$;

do $m$
declare
  d text := pg_get_functiondef('public.queue_telegram_notification'::regproc);
  n text;
begin
  n := replace(d, $b$    -- Alerts reach the admins even with game notifications switched off.
    and (p.tg_notifications_enabled or new.kind = 'system_alert')$b$, $a$    and p.tg_notifications_enabled$a$);
  if n = d then raise exception 'queue_telegram_notification: rollback did not apply'; end if;
  execute n;
end
$m$;

drop function if exists public._alert_meaning(text);
drop function if exists public._alert_area(text);
drop function if exists public._ru_count(bigint, text, text, text);
