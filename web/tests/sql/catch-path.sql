-- Проверка пути «улов → монеты → сектор» (confirm_catch) на живой базе, без следа.
--
-- Весь прогон — один блок DO, который ВСЕГДА заканчивается ошибкой, поэтому всё,
-- что он сделал (два временных игрока, их уловы, монеты, уведомления, очередь
-- Telegram), откатывается. Ответ читается из текста этой ошибки:
--   «ТЕСТ ПРОЙДЕН (всё откатано): …»   — все шаги совпали с правилами;
--   «ТЕСТ НЕ ПРОЙДЕН, шаг N: …»         — что именно разошлось.
-- Запуск: целиком в SQL-редакторе Supabase или через execute_sql у помощника.
-- Гонять перед применением любой миграции, которая трогает confirm_catch,
-- триггеры на catches/territories или монеты (см. «Миграции базы — правила»).
--
-- Правила, которые проверяются (из confirm_catch и «Сектора, защита и щит»):
--  1. свободный сектор: улов = захват, защита 1, монеты за вид + 25 за захват;
--  2. улов владельца: защита +1, монет за захват нет;
--  3. чужой улов при защите > 0: атака, защита −1, сектор не переходит, владельцу уведомление;
--  4. второй улов раньше 2 мин 30 с: COOLDOWN;
--  5. при защите 0 чужой улов забирает сектор (защита 1, +25);
--  6. под чужим щитом улов не принимается: SHIELDED;
--  7. горячий сектор: монеты за вид ×2;
--  8. горячий сектор + «Двойные монеты»: ×3 (так в коде, см. комментарий в confirm_catch);
--     +25 за захват того же сектора — не чаще раза в сутки;
--  9. выдуманный сектор, чужая ссылка на фото, время улова за пределами суток — отказ;
-- 10. каждая выплата за улов записана в coin_transactions с catch_id.
do $test$
declare
  a uuid := gen_random_uuid();
  b uuid := gen_random_uuid();
  photo_prefix text := 'https://yhgdcdkfkerzuhnzjzrz.supabase.co/storage/v1/object/public/catch-photos/';
  sector text;
  sp text;
  price int;
  r record;
  t public.territories;
  paid int := 0;
  ledger int;
  err text;
  step int := 0;
begin
  -- Помощники живут во временной схеме и откатываются вместе со всем.
  create function pg_temp.act(u uuid) returns void language sql as $f$
    select set_config('request.jwt.claim.sub', u::text, true),
           set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true);
  $f$;
  -- Кулдаун считается от прошлого улова, а now() внутри транзакции стоит на месте:
  -- сдвигаем прошлые уловы тестовых игроков на 3 минуты назад.
  create function pg_temp.later(x uuid, y uuid) returns void language sql as $f$
    update public.catches set caught_at = caught_at - interval '3 minutes' where user_id in (x, y);
  $f$;

  insert into auth.users (id, email, aud, role, raw_user_meta_data) values
    (a, 'catch-test-a-' || a || '@example.invalid', 'authenticated', 'authenticated', '{"display_name":"Тест А"}'),
    (b, 'catch-test-b-' || b || '@example.invalid', 'authenticated', 'authenticated', '{"display_name":"Тест Б"}');
  -- Не новички: «Задание новичка» (первый улов ×3 в первые 7 дней) проверяется отдельно, здесь только правила улова.
  update public.profiles set created_at = now() - interval '30 days' where id in (a, b);

  select tt.id into sector from public.territories tt
  where tt.owner_id is null and not tt.is_deleted and tt.id like 'B%'
    and not exists (select 1 from public.hot_sectors h where h.territory_id = tt.id and now() >= h.starts_at and now() < h.ends_at)
  order by random() limit 1;
  if sector is null then raise exception 'ТЕСТ НЕ ПРОЙДЕН, шаг 0: нет свободного сектора в Батуми'; end if;
  select s.key, s.coin_value into sp, price from public.species s where s.coin_value > 0 order by s.coin_value, s.key limit 1;

  -- 1. Захват свободного сектора.
  step := 1;
  perform pg_temp.act(a);
  select * into r from public.confirm_catch(sector, sp, photo_prefix || a || '/1.jpg');
  select * into t from public.territories where id = sector;
  if r.species_coins <> price or r.capture_coins <> 25 or r.attacked or r.defense <> 1 or t.owner_id <> a or t.defense <> 1 then
    raise exception 'ТЕСТ НЕ ПРОЙДЕН, шаг 1 (захват): ответ %, владелец А? %, защита %', row_to_json(r), t.owner_id = a, t.defense;
  end if;
  if not exists (select 1 from public.activity_log l where l.user_id = a and l.territory_id = sector and l.kind = 'claim') then
    raise exception 'ТЕСТ НЕ ПРОЙДЕН, шаг 1: нет записи claim в activity_log';
  end if;
  paid := paid + r.species_coins + r.capture_coins;

  -- 2. Улов владельца укрепляет защиту, без монет за захват.
  step := 2;
  perform pg_temp.later(a, b);
  select * into r from public.confirm_catch(sector, sp, photo_prefix || a || '/2.jpg');
  select * into t from public.territories where id = sector;
  if r.capture_coins <> 0 or r.defense <> 2 or t.defense <> 2 or t.owner_id <> a then
    raise exception 'ТЕСТ НЕ ПРОЙДЕН, шаг 2 (улов владельца): ответ %, защита %', row_to_json(r), t.defense;
  end if;
  paid := paid + r.species_coins + r.capture_coins;

  -- 3. Чужой улов — атака: защита −1, сектор остаётся у А, А получает уведомление.
  step := 3;
  perform pg_temp.later(a, b);
  perform pg_temp.act(b);
  select * into r from public.confirm_catch(sector, sp, photo_prefix || b || '/1.jpg');
  select * into t from public.territories where id = sector;
  if not r.attacked or r.defense <> 1 or r.capture_coins <> 0 or r.species_coins <> price or t.owner_id <> a then
    raise exception 'ТЕСТ НЕ ПРОЙДЕН, шаг 3 (атака): ответ %, владелец А? %', row_to_json(r), t.owner_id = a;
  end if;
  if not exists (select 1 from public.notifications n where n.user_id = a and n.kind = 'sector_attacked' and n.territory_id = sector) then
    raise exception 'ТЕСТ НЕ ПРОЙДЕН, шаг 3: владельцу не пришло sector_attacked';
  end if;

  -- 4. Сразу второй улов — кулдаун.
  step := 4;
  err := null;
  begin
    perform public.confirm_catch(sector, sp, photo_prefix || b || '/2.jpg');
  exception when others then err := sqlerrm;
  end;
  if err is null or err not like 'COOLDOWN:%' then
    raise exception 'ТЕСТ НЕ ПРОЙДЕН, шаг 4 (кулдаун): ожидался COOLDOWN, получено %', coalesce(err, 'улов принят');
  end if;

  -- 5. Защита до 0, затем захват.
  step := 5;
  perform pg_temp.later(a, b);
  select * into r from public.confirm_catch(sector, sp, photo_prefix || b || '/3.jpg');
  if not r.attacked or r.defense <> 0 then
    raise exception 'ТЕСТ НЕ ПРОЙДЕН, шаг 5 (атака до 0): ответ %', row_to_json(r);
  end if;
  perform pg_temp.later(a, b);
  select * into r from public.confirm_catch(sector, sp, photo_prefix || b || '/4.jpg');
  select * into t from public.territories where id = sector;
  if r.attacked or r.capture_coins <> 25 or r.defense <> 1 or t.owner_id <> b or t.shield_until is not null then
    raise exception 'ТЕСТ НЕ ПРОЙДЕН, шаг 5 (перехват): ответ %, владелец Б? %', row_to_json(r), t.owner_id = b;
  end if;

  -- 6. Под щитом Б улов А не принимается.
  step := 6;
  update public.territories set shield_until = now() + interval '1 hour' where id = sector;
  perform pg_temp.later(a, b);
  perform pg_temp.act(a);
  err := null;
  begin
    perform public.confirm_catch(sector, sp, photo_prefix || a || '/3.jpg');
  exception when others then err := sqlerrm;
  end;
  if err is null or err not like 'SHIELDED:%' then
    raise exception 'ТЕСТ НЕ ПРОЙДЕН, шаг 6 (щит): ожидался SHIELDED, получено %', coalesce(err, 'улов принят');
  end if;
  update public.territories set shield_until = null where id = sector;

  -- 7. Горячий сектор: ×2 за вид (атака А на сектор Б с защитой 1).
  step := 7;
  insert into public.hot_sectors (territory_id, city, kind, starts_at, ends_at)
  values (sector, 'batumi', 'popular', now() - interval '1 hour', now() + interval '1 hour');
  select * into r from public.confirm_catch(sector, sp, photo_prefix || a || '/4.jpg');
  if r.species_coins <> price * 2 or not r.attacked or r.defense <> 0 then
    raise exception 'ТЕСТ НЕ ПРОЙДЕН, шаг 7 (горячий сектор): ответ %, ожидалось % монет за вид', row_to_json(r), price * 2;
  end if;
  paid := paid + r.species_coins + r.capture_coins;

  -- 8. Горячий + «Двойные монеты»: ×3; сектор снова у А, но +25 за него уже было сегодня.
  step := 8;
  insert into public.active_buffs (user_id, buff_id, expires_at) values (a, 'double_coins', now() + interval '1 hour');
  perform pg_temp.later(a, b);
  select * into r from public.confirm_catch(sector, sp, photo_prefix || a || '/5.jpg');
  select * into t from public.territories where id = sector;
  if r.species_coins <> price * 3 or r.capture_coins <> 0 or t.owner_id <> a then
    raise exception 'ТЕСТ НЕ ПРОЙДЕН, шаг 8 (горячий + двойные): ответ %, ожидалось % за вид и 0 за захват', row_to_json(r), price * 3;
  end if;
  paid := paid + r.species_coins + r.capture_coins;

  -- 9. Отказы: выдуманный сектор, чужое фото, время улова вне суток.
  step := 9;
  perform pg_temp.later(a, b);
  err := null;
  begin
    perform public.confirm_catch('B99999', sp, photo_prefix || a || '/6.jpg');
  exception when others then err := sqlerrm;
  end;
  if err is null or err not like 'unknown territory%' then
    raise exception 'ТЕСТ НЕ ПРОЙДЕН, шаг 9 (выдуманный сектор): получено %', coalesce(err, 'улов принят');
  end if;
  err := null;
  begin
    perform public.confirm_catch(sector, sp, photo_prefix || b || '/чужое.jpg');
  exception when others then err := sqlerrm;
  end;
  if err is distinct from 'PHOTO_URL_INVALID' then
    raise exception 'ТЕСТ НЕ ПРОЙДЕН, шаг 9 (чужое фото): получено %', coalesce(err, 'улов принят');
  end if;
  err := null;
  begin
    perform public.confirm_catch(sector, sp, photo_prefix || a || '/7.jpg', p_caught_at => now() - interval '2 days');
  exception when others then err := sqlerrm;
  end;
  if err is distinct from 'CAUGHT_AT_INVALID' then
    raise exception 'ТЕСТ НЕ ПРОЙДЕН, шаг 9 (старое время улова): получено %', coalesce(err, 'улов принят');
  end if;

  -- 10. Всё, что confirm_catch вернул игроку А, лежит в журнале монет с catch_id.
  step := 10;
  select coalesce(sum(ct.amount), 0) into ledger from public.coin_transactions ct
  where ct.user_id = a and ct.reason in ('catch_reward', 'sector_capture') and ct.catch_id is not null;
  if ledger <> paid then
    raise exception 'ТЕСТ НЕ ПРОЙДЕН, шаг 10 (журнал монет): в журнале %, выплачено по ответам %', ledger, paid;
  end if;

  raise exception 'ТЕСТ ПРОЙДЕН (всё откатано): сектор %, вид % (% мон.), 10 шагов', sector, sp, price;
exception when others then
  -- Неожиданная ошибка самой базы (не наша проверка) — с номером шага, где случилась.
  if sqlerrm like 'ТЕСТ %' then raise; end if;
  raise exception 'ТЕСТ НЕ ПРОЙДЕН, шаг %: ошибка базы: %', step, sqlerrm;
end
$test$;
