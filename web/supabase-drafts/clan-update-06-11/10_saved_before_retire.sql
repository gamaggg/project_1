-- Тела функций до снятия Казны (сняты с живой базы 08.11.2026): откат 10 после вызова retire_personal_treasury().
-- Перед самим вызовом сверить с живой базой ещё раз (pg_get_functiondef) и обновить файл, если что-то менялось.

CREATE OR REPLACE FUNCTION public.collect_treasury()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_uid uuid := auth.uid();
  v record;
  v_balance int;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;
  perform 1 from public.profiles where id = v_uid for update;
  select * into v from public._treasury_state(v_uid);
  if v.available <= 0 then
    raise exception 'TREASURY:empty';
  end if;
  insert into public.treasury_collections (user_id, coins) values (v_uid, v.available);
  update public.profiles set coins = coins + v.available where id = v_uid returning coins into v_balance;
  insert into public.coin_transactions (user_id, amount, reason, label) values (v_uid, v.available, 'treasury', 'Казна секторов');
  return jsonb_build_object('coins', v.available, 'balance', v_balance);
end;
$function$;

CREATE OR REPLACE FUNCTION public.get_treasury()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_uid uuid := auth.uid();
  v record;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;
  select * into v from public._treasury_state(v_uid);
  return jsonb_build_object('available', v.available, 'collected_today', v.collected_today, 'daily_cap', 30,
    'per_day', v.per_day, 'sectors', v.sectors);
end;
$function$;

CREATE OR REPLACE FUNCTION public.activate_buff(p_buff_id text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_uid uuid := auth.uid();
  v_price int;
  v_duration_hours int;
  v_name text;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  if p_buff_id not in ('tide', 'echo', 'double_coins', 'hunter_mark') then
    raise exception 'this buff is bought a different way';
  end if;

  select price, duration_hours, name into v_price, v_duration_hours, v_name from public.buffs where id = p_buff_id;
  if v_price is null then raise exception 'unknown buff'; end if;

  if p_buff_id in ('tide', 'echo') and exists (
    select 1 from public.active_buffs where user_id = v_uid and buff_id = p_buff_id and consumed = false and expires_at > now()
  ) then
    raise exception 'already armed';
  end if;

  update public.profiles set coins = coins - v_price where id = v_uid and coins >= v_price;
  if not found then raise exception 'not enough coins'; end if;

  insert into public.active_buffs (user_id, buff_id, expires_at)
  values (v_uid, p_buff_id, now() + make_interval(hours => coalesce(v_duration_hours, 168)));
  insert into public.coin_transactions (user_id, amount, reason, label) values (v_uid, -v_price, 'buy_buff', v_name);
end;
$function$;
