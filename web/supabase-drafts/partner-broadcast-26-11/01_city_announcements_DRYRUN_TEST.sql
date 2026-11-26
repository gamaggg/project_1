-- Проверка 01_city_announcements.sql без следов: ОДНИМ запуском текст миграции и этот блок; всегда кончается
-- ошибкой «DRYRUN», всё откатывается (очередь бота тоже: ничего не уходит).
do $d$
declare
  v_super uuid; u_msk uuid; u_bat uuid; r text := ''; n int; q int; v_ann bigint;
begin
  select id into v_super from public.profiles where is_super_admin limit 1;
  select id into u_msk from public.profiles where city = 'moscow' and not coalesce(is_super_admin, false) limit 1;
  select id into u_bat from public.profiles where city = 'batumi' and not coalesce(is_super_admin, false) limit 1;

  -- суперадмин: пост для Москвы с ботом
  perform set_config('request.jwt.claims', json_build_object('sub', v_super, 'role', 'authenticated')::text, true);
  set local role authenticated;
  n := public.admin_post_announcement('DRYRUN Москва', null, null, true, null, 'moscow');
  r := r || '1) поставлено в бот ' || n || '; ';
  select count(*) into q from public.announcements where body = 'DRYRUN Москва';
  r := r || '2) суперадмин видит свой пост ' || q || '; ';
  n := public.admin_post_announcement('DRYRUN всем без бота');
  r := r || '3) старый вызов без города вернул ' || n || '; ';
  begin
    perform public.admin_post_announcement('x', null, null, false, null, 'atlantis');
    r := r || '4) неизвестный город принят (ошибка); ';
  exception when others then r := r || '4) неизвестный город: ' || left(sqlerrm, 40) || '; ';
  end;
  reset role;

  select id into v_ann from public.announcements where body = 'DRYRUN Москва';
  select count(*) into q from public.telegram_broadcast_queue t
    join public.profiles p on p.telegram_id = t.chat_id
    where t.announcement_id = v_ann and p.city <> 'moscow';
  r := r || '5) в очереди не из Москвы ' || q || '; ';

  -- игрок Москвы
  perform set_config('request.jwt.claims', json_build_object('sub', u_msk, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into q from public.announcements where body like 'DRYRUN%';
  r := r || '6) игрок Москвы видит ' || q || ' из 2; ';
  begin
    perform public.admin_post_announcement('x', null, null, true, null, 'moscow');
    r := r || '7) игрок разослал (ошибка); ';
  exception when others then r := r || '7) игрок рассылает: ' || left(sqlerrm, 30) || '; ';
  end;
  reset role;

  -- игрок Батуми
  perform set_config('request.jwt.claims', json_build_object('sub', u_bat, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into q from public.announcements where body like 'DRYRUN%';
  r := r || '8) игрок Батуми видит ' || q || ' из 2; ';
  reset role;

  -- гость
  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  set local role anon;
  select count(*) into q from public.announcements where body like 'DRYRUN%';
  r := r || '9) гость видит ' || q || ' из 2; ';
  select count(*) into q from public.announcements;
  r := r || '10) гость видит старых постов ' || q || '; ';
  reset role;

  r := r || '11) права: anon ' || has_function_privilege('anon', 'public.admin_post_announcement(text,text,text,boolean,text,text)', 'execute')
        || ', authenticated ' || has_function_privilege('authenticated', 'public.admin_post_announcement(text,text,text,boolean,text,text)', 'execute')
        || ', старых версий функции ' || (select count(*) from pg_proc where proname = 'admin_post_announcement') || '; ';

  raise exception 'DRYRUN: %', r;
end
$d$;
