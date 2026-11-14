-- Проверка 03_partner_stats.sql без следов: в SQL-редактор ОДНИМ запуском текст миграции (без строки insert into
-- supabase_migrations…) и этот блок; всегда кончается ошибкой «DRYRUN», всё откатывается. Берёт первую действующую точку.
do $d$
declare
  v_super uuid; u1 uuid; u2 uuid; v_point bigint; r text := ''; s jsonb; n int;
begin
  select id into v_super from public.profiles where is_super_admin limit 1;
  select id into u1 from public.profiles where not is_admin and not coalesce(is_super_admin, false) order by created_at limit 1;
  select id into u2 from public.profiles where not is_admin and not coalesce(is_super_admin, false) and id <> u1 order by created_at limit 1;
  select id into v_point from public.partner_points_live() limit 1;
  if v_point is null then raise exception 'DRYRUN: нет действующей точки'; end if;
  r := r || '0) точка ' || v_point || '; ';

  -- игрок u1: метка, повтор метки (не считается), карточка, промокод, потом сайт
  perform set_config('request.jwt.claims', json_build_object('sub', u1, 'role', 'authenticated')::text, true);
  set local role authenticated;
  perform public.partner_point_track(v_point, 'pin', 'dev-u1');
  perform public.partner_point_track(v_point, 'pin', 'dev-u1');
  perform public.partner_point_track(v_point, 'open', 'dev-u1');
  perform public.partner_point_track(v_point, 'copy_promo', 'dev-u1');
  perform public.partner_point_track(v_point, 'site', 'dev-u1');
  perform public.partner_point_track(v_point, 'hack', 'dev-u1');
  reset role;
  -- в одной транзакции время у всех строк одно; «сайт» сдвигаем на секунду позже промокода, как было бы в жизни
  update public.partner_point_events set created_at = created_at + interval '1 second' where point_id = v_point and user_id = u1 and kind = 'site';

  -- гость: карточка и маршрут
  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  set local role anon;
  perform public.partner_point_track(v_point, 'open', 'dev-guest');
  perform public.partner_point_track(v_point, 'route', 'dev-guest');
  begin
    s := public.partner_point_stats(v_point, now() - interval '1 day', now() + interval '1 day');
    r := r || '1) гость видит статистику (ошибка); ';
  exception when others then r := r || '1) гость статистику: ' || left(sqlerrm, 40) || '; ';
  end;
  reset role;

  -- суперадмин: его нажатие не считается
  perform set_config('request.jwt.claims', json_build_object('sub', v_super, 'role', 'authenticated')::text, true);
  set local role authenticated;
  perform public.partner_point_track(v_point, 'open', 'dev-admin');
  s := public.partner_point_stats(v_point, now() - interval '1 day', now() + interval '1 day');
  reset role;
  select count(*) into n from public.partner_point_events where point_id = v_point and user_id = u1 and kind = 'pin';
  r := r || '2) повторная метка: записей ' || n || '; ';
  r := r || '3) людей ' || (s->>'people') || ', метка ' || (s->'totals'->'pin'->>'count') || ', открытий ' || (s->'totals'->'open'->>'count')
    || ' (' || (s->'totals'->'open'->>'people') || ' чел.), промокод ' || (s->'totals'->'copy_promo'->>'count') || ', сайт ' || (s->'totals'->'site'->>'count')
    || ', маршрут ' || (s->'totals'->'route'->>'count') || '; ';
  r := r || '4) воронка ' || (s->'funnel')::text || '; 5) дней ' || jsonb_array_length(s->'days') || '; ';

  -- игрок u2: без доступа нельзя, с доступом можно, после закрытия снова нельзя
  perform set_config('request.jwt.claims', json_build_object('sub', u2, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin
    s := public.partner_point_stats(v_point, now() - interval '1 day', now() + interval '1 day');
    r := r || '6) чужой игрок видит (ошибка); ';
  exception when others then r := r || '6) чужой игрок: ' || left(sqlerrm, 30) || '; ';
  end;
  begin
    perform public.admin_partner_viewer_set(v_point, u2, true);
    r := r || '7) игрок выдал себе доступ (ошибка); ';
  exception when others then r := r || '7) игрок выдаёт доступ: ' || left(sqlerrm, 30) || '; ';
  end;
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', v_super, 'role', 'authenticated')::text, true);
  set local role authenticated;
  perform public.admin_partner_viewer_set(v_point, u2, true);
  r := r || '8) суперадмин открыл: в списке ' || (select count(*) from public.admin_partner_viewers(v_point)) || ', у игрока точек ' || (select count(*) from public.admin_partner_access_of(u2)) || '; ';
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', u2, 'role', 'authenticated')::text, true);
  set local role authenticated;
  s := public.partner_point_stats(v_point, now() - interval '1 day', now() + interval '1 day');
  r := r || '9) партнёр видит: людей ' || (s->>'people') || ', его точек ' || (select count(*) from public.partner_points_shared_with_me()) || '; ';
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', v_super, 'role', 'authenticated')::text, true);
  set local role authenticated;
  perform public.admin_partner_viewer_set(v_point, u2, false);
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', u2, 'role', 'authenticated')::text, true);
  set local role authenticated;
  r := r || '10) после закрытия у партнёра точек ' || (select count(*) from public.partner_points_shared_with_me()) || '; ';
  begin
    select count(*) into n from public.partner_point_events;
    r := r || '11) игрок читает таблицу событий (ошибка); ';
  exception when others then r := r || '11) таблица событий: ' || left(sqlerrm, 40) || '; ';
  end;
  reset role;
  r := r || '12) журнал: ' || (select string_agg(details, ' / ' order by id) from public.admin_actions where action like 'partner_stats_%' and created_at >= now())
    || '; 13) права: anon track ' || has_function_privilege('anon', 'public.partner_point_track(bigint, text, text)', 'execute')
    || ', anon stats ' || has_function_privilege('anon', 'public.partner_point_stats(bigint, timestamptz, timestamptz)', 'execute')
    || ', anon viewer_set ' || has_function_privilege('anon', 'public.admin_partner_viewer_set(bigint, uuid, boolean)', 'execute');
  raise exception 'DRYRUN (всё откатано): %', r;
end
$d$;
