-- Проверка 02_partner_icon.sql без следов: в SQL-редактор ОДНИМ запуском текст миграции (без строки insert into
-- supabase_migrations…) и этот блок; всегда кончается ошибкой «DRYRUN», всё откатывается.
do $d$
declare
  v_super uuid;
  a bigint;
  r text := '';
  base jsonb := jsonb_build_object('city', 'moscow', 'plan', 'start', 'name', 'Тест значок', 'lat', 55.7087, 'lng', 37.6227, 'days', 10);
begin
  select id into v_super from public.profiles where is_super_admin limit 1;
  perform set_config('request.jwt.claims', json_build_object('sub', v_super, 'role', 'authenticated')::text, true);
  set local role authenticated;
  a := public.admin_partner_point_save(null, base || jsonb_build_object('icon', 'boat'));
  r := r || '1) готовый значок: ' || coalesce((select icon from public.partner_points_live() where id = a), 'NULL') || '; ';
  perform public.admin_partner_point_save(a, base || jsonb_build_object('icon', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><circle r="4" cx="5" cy="5" fill="#0B4F8A"/></svg>'));
  r := r || '2) свой SVG: ' || left(coalesce((select icon from public.partner_points_live() where id = a), 'NULL'), 40) || '…; ';
  perform public.admin_partner_point_save(a, base);
  r := r || '3) без значка: ' || coalesce((select icon from public.partner_points_live() where id = a), 'NULL') || '; ';
  begin
    perform public.admin_partner_point_save(a, base || jsonb_build_object('icon', '<svg onload="alert(1)"></svg>'));
    r := r || '4) SVG с onload ПРИНЯТ (ошибка); ';
  exception when others then r := r || '4) SVG с onload: отклонён (' || left(sqlerrm, 60) || '); ';
  end;
  begin
    perform public.admin_partner_point_save(a, base || jsonb_build_object('icon', '<svg><script>alert(1)</script></svg>'));
    r := r || '5) SVG со script ПРИНЯТ (ошибка); ';
  exception when others then r := r || '5) SVG со script: отклонён; ';
  end;
  begin
    perform public.admin_partner_point_save(a, base || jsonb_build_object('icon', 'rocket'));
    r := r || '6) неизвестный значок ПРИНЯТ (ошибка); ';
  exception when others then r := r || '6) неизвестный значок: отклонён; ';
  end;
  reset role;
  r := r || '7) права: anon live ' || has_function_privilege('anon', 'public.partner_points_live()', 'execute')
    || ', authenticated live ' || has_function_privilege('authenticated', 'public.partner_points_live()', 'execute')
    || ', public live ' || has_function_privilege('public', 'public.partner_points_live()', 'execute')
    || ', anon save ' || has_function_privilege('anon', 'public.admin_partner_point_save(bigint, jsonb)', 'execute')
    || '; 8) реальных точек в таблице (кроме теста): ' || (select count(*) from public.partner_points where id <> a);
  raise exception 'DRYRUN (всё откатано): %', r;
end
$d$;
