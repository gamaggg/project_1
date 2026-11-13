-- Проверка 01_partner_points.sql без следов. В SQL-редактор Supabase идёт ОДНИМ запуском: сначала текст миграции
-- (без последней строки insert into supabase_migrations…), затем этот блок. Блок всегда заканчивается ошибкой,
-- поэтому вся транзакция откатывается: «DRYRUN (всё откатано): …».
do $d$
declare
  v_super uuid;
  v_user uuid;
  v_mon date := date_trunc('week', (now() at time zone 'Europe/Moscow'))::date;
  v_today date := (now() at time zone 'Europe/Moscow')::date;
  a bigint;
  b bigint;
  n int;
  r text := '';
  v_prize text;
begin
  select id into v_super from public.profiles where is_super_admin limit 1;
  select id into v_user from public.profiles where not is_admin and not coalesce(is_super_admin, false) limit 1;
  r := r || '0) понедельник ' || v_mon || '; ';

  perform set_config('request.jwt.claims', json_build_object('sub', v_super, 'role', 'authenticated')::text, true);
  set local role authenticated;
  a := public.admin_partner_point_save(null, jsonb_build_object('city', 'moscow', 'plan', 'start', 'name', 'Тест Старт', 'lat', 55.7087, 'lng', 37.6227,
    'phone', '+7 900 000-00-00', 'website', 'https://example.com', 'photos', jsonb_build_array('https://photos.catchrange.com/x.jpg', 'http://bad'),
    'promo_code', 'RANGE10', 'promo_discount', '−10%', 'start', v_today::text, 'days', 30));
  b := public.admin_partner_point_save(null, jsonb_build_object('city', 'moscow', 'plan', 'partner', 'name', 'Тест Партнёр', 'lat', 55.71, 'lng', 37.62,
    'prize_title', 'Набор воблеров', 'prize_weeks', jsonb_build_array((v_mon + 2)::text, (v_mon + 7)::text, (v_mon + 7)::text), 'start', v_today::text, 'days', 30));
  r := r || '1) добавлены ' || a || ' и ' || b || ', недели приза ' || (select prize_weeks::text from public.partner_points where id = b)
    || ', фото ' || (select cardinality(photos) from public.partner_points where id = a) || '; ';
  begin
    perform public.admin_partner_point_save(null, jsonb_build_object('city', 'moscow', 'plan', 'partner', 'name', 'Тест 3', 'lat', 55.7, 'lng', 37.6,
      'prize_title', 'Кружка', 'prize_weeks', jsonb_build_array(v_mon::text), 'start', v_today::text, 'days', 10));
    r := r || '2) занятая неделя ПРИНЯТА (ошибка); ';
  exception when others then r := r || '2) занятая неделя: ' || sqlerrm || '; ';
  end;
  begin
    perform public.admin_partner_point_save(null, jsonb_build_object('city', 'moscow', 'plan', 'partner', 'name', 'Тест 4', 'lat', 55.7, 'lng', 37.6,
      'prize_weeks', jsonb_build_array((v_mon + 14)::text), 'start', v_today::text, 'days', 10));
    r := r || '3) приз без названия ПРИНЯТ (ошибка); ';
  exception when others then r := r || '3) приз без названия: ' || sqlerrm || '; ';
  end;
  begin
    perform public.admin_partner_point_save(null, jsonb_build_object('city', 'moscow', 'name', 'Тест 5', 'lat', 55.7, 'lng', 37.6, 'days', 0));
    r := r || '4) 0 дней ПРИНЯТО (ошибка); ';
  exception when others then r := r || '4) 0 дней: ' || sqlerrm || '; ';
  end;
  select count(*) into n from public.partner_points_live() where id in (a, b);
  r := r || '5) на карте ' || n || '; ';
  select prize_title into v_prize from public.partner_prize_of_week('moscow', v_mon);
  r := r || '6) приз этой недели: ' || coalesce(v_prize, 'нет') || ', следующей: '
    || coalesce((select prize_title from public.partner_prize_of_week('moscow', v_mon + 7)), 'нет')
    || ', через две: ' || coalesce((select prize_title from public.partner_prize_of_week('moscow', v_mon + 14)), 'нет') || '; ';
  perform public.admin_partner_point_save(a, jsonb_build_object('city', 'moscow', 'plan', 'start', 'name', 'Тест Старт', 'lat', 55.7087, 'lng', 37.6227,
    'start', (v_today - 40)::text, 'days', 10));
  select count(*) into n from public.partner_points_live() where id in (a, b);
  r := r || '7) срок A прошёл, на карте ' || n || '; ';
  select count(*) into n from public.partner_points where id in (a, b);
  r := r || '8) суперадмин видит в таблице ' || n || '; ';
  reset role;

  perform set_config('request.jwt.claims', json_build_object('sub', v_user, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from public.partner_points;
  r := r || '9) игрок видит в таблице ' || n || ', на карте ' || (select count(*) from public.partner_points_live() where id in (a, b)) || '; ';
  begin
    perform public.admin_partner_point_save(null, jsonb_build_object('city', 'moscow', 'name', 'Взлом', 'lat', 55.7, 'lng', 37.6, 'days', 5));
    r := r || '10) игрок СОХРАНИЛ (ошибка); ';
  exception when others then r := r || '10) игрок сохраняет: ' || sqlerrm || '; ';
  end;
  begin
    perform public.admin_partner_point_delete(b);
    r := r || '11) игрок УДАЛИЛ (ошибка); ';
  exception when others then r := r || '11) игрок удаляет: ' || sqlerrm || '; ';
  end;
  reset role;

  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  set local role anon;
  r := r || '12) гость: на карте ' || (select count(*) from public.partner_points_live() where id in (a, b))
    || ', приз ' || coalesce((select prize_title from public.partner_prize_of_week('moscow', v_mon)), 'нет') || '; ';
  begin
    select count(*) into n from public.partner_points;
    r := r || '13) гость читает таблицу: ' || n || ' строк (ошибка); ';
  exception when others then r := r || '13) гость читает таблицу: ' || sqlerrm || '; ';
  end;
  reset role;

  perform set_config('request.jwt.claims', json_build_object('sub', v_super, 'role', 'authenticated')::text, true);
  set local role authenticated;
  perform public.admin_partner_point_delete(b);
  reset role;
  r := r || '14) после удаления B строк ' || (select count(*) from public.partner_points where id in (a, b))
    || ', записей в журнале ' || (select count(*) from public.admin_actions where action like 'partner_%' and created_at > now() - interval '1 minute')
    || ': ' || (select string_agg(details, ' | ' order by id) from public.admin_actions where action like 'partner_%' and created_at > now() - interval '1 minute') || '; ';
  r := r || '15) права: anon save ' || has_function_privilege('anon', 'public.admin_partner_point_save(bigint, jsonb)', 'execute')
    || ', authenticated save ' || has_function_privilege('authenticated', 'public.admin_partner_point_save(bigint, jsonb)', 'execute')
    || ', anon live ' || has_function_privilege('anon', 'public.partner_points_live()', 'execute')
    || ', anon prize ' || has_function_privilege('anon', 'public.partner_prize_of_week(text, date)', 'execute');
  raise exception 'DRYRUN (всё откатано): %', r;
end
$d$;
