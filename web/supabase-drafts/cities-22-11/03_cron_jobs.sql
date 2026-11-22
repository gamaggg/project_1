-- Регулярные задания новых городов (22.11.2026): те же девять заданий, что у шаблонного города, с тем же
-- расписанием (cron в UTC), но минутой позже, чтобы города не стартовали вместе. Шаблон — Москва:
--   Казань (kazan)         — +3 мин (Петербург +1, Сочи +2)
--   Нижний Новгород (nnov) — +4 мин
--   Анапа (anapa)          — +5 мин
--   Варна/Бургас (varna)   — +1 час и +6 мин: София на час западнее Москвы зимой (UTC+2) и
--                            совпадает с ней летом (UTC+3). Через час после московского задания
--                            неделя в Софии уже закончилась в любой сезон (итоги недели, битва
--                            кланов), а напоминания и прогноз приходят в то же местное время зимой.
--   Киев (kyiv)            — +1 час и +7 мин (тот же часовой пояс, что у Софии)
--   Одесса (odesa)         — +1 час и +8 мин
-- Шаблон — Батуми (Asia/Tbilisi, UTC+4, как Ереван):
--   Ереван/Севан (yerevan) — +2 мин (Тбилиси +1)
-- В командах подставляются имя города (`'moscow'` / `city=moscow`), буква сектора (`'M'`) и часовой пояс.
-- Секрет прогноза клёва берётся из команды шаблонного задания, в файле его нет.
-- Ежедневный «прогноз клёва» новых городов зовёт сайт, только если в городе есть занятые сектора
-- (без них рассылать некому): пустой город не тратит вызов Vercel и Open-Meteo каждый день.
-- Общие задания clan-race-tick и rating-tick переписаны: идут по city_config (см. ниже).
-- Откат: 03_cron_jobs_ROLLBACK.sql
do $cron$
declare
  t record;
  j record;
  v_name text;
  v_min int;
  v_hour text;
  v_sched text;
  v_cmd text;
  v_id bigint;
begin
  for t in
    select * from (values
      ('kazan',   'K', 'moscow', 'M', 'Europe/Moscow', 3, 0),
      ('nnov',    'N', 'moscow', 'M', 'Europe/Moscow', 4, 0),
      ('anapa',   'A', 'moscow', 'M', 'Europe/Moscow', 5, 0),
      ('varna',   'V', 'moscow', 'M', 'Europe/Moscow', 6, 1),
      ('kyiv',    'Y', 'moscow', 'M', 'Europe/Moscow', 7, 1),
      ('odesa',   'O', 'moscow', 'M', 'Europe/Moscow', 8, 1),
      ('yerevan', 'E', 'batumi', 'B', 'Asia/Tbilisi',  2, 0)
    ) as v(city, prefix, tmpl, tprefix, ttz, mins, hours)
  loop
    for j in
      select jobname, schedule, command from cron.job
      where jobname ~ ('-' || t.tmpl || '$')
    loop
      v_name := regexp_replace(j.jobname, '-' || t.tmpl || '$', '-' || t.city);
      v_min := (split_part(j.schedule, ' ', 1))::int + t.mins;
      if v_min > 59 then raise exception '%: minute % out of range', j.jobname, v_min; end if;
      v_hour := split_part(j.schedule, ' ', 2);
      if t.hours <> 0 then
        if v_hour !~ '^\d+$' or v_hour::int + t.hours > 23 then raise exception '%: hour % cannot be shifted', j.jobname, v_hour; end if;
        v_hour := (v_hour::int + t.hours)::text;
      end if;
      v_sched := v_min::text || ' ' || v_hour || substr(j.schedule, length(split_part(j.schedule, ' ', 1)) + length(split_part(j.schedule, ' ', 2)) + 2);
      v_cmd := replace(j.command, '''' || t.tmpl || '''', '''' || t.city || '''');
      v_cmd := replace(v_cmd, 'city=' || t.tmpl, 'city=' || t.city);
      v_cmd := replace(v_cmd, '''' || t.tprefix || '''', '''' || t.prefix || '''');
      v_cmd := replace(v_cmd, '''' || t.ttz || '''', '''' || public._city_tz(t.city) || '''');
      if v_name like 'forecast-alert-%' then
        v_cmd := regexp_replace(v_cmd, ';\s*$', '')
          || format(E'\n  where exists (select 1 from public.territories t where t.id >= %L and t.id < %L and t.owner_id is not null and not t.is_deleted);', t.prefix, chr(ascii(t.prefix) + 1));
      end if;
      if not exists (select 1 from cron.job where jobname = v_name) then
        perform cron.schedule(v_name, v_sched, v_cmd);
      end if;
    end loop;
  end loop;

  -- Общие тики (каждые 10 минут) больше не перечисляют города: проходят по city_config и зовут функцию
  -- только там, где ей есть что делать. Новый город подхватывается сам, а пустые города не грузят базу
  -- каждые 10 минут (было: 5 вызовов на тик, с этим списком стало бы 12):
  --   clan-race-tick — города, где есть хоть один живой клан (без кланов функция ничего не делает);
  --   rating-tick    — города, где за 8 дней был улов (без уловов рейтинг недели пуст; старые недели
  --                    дочистит первый же тик с уловом).
  -- Сектора города — диапазон ключа (id >= 'K' and id < 'L'), а не like 'K%': так работает индекс.
  select jobid into v_id from cron.job where jobname = 'clan-race-tick';
  if v_id is not null then
    perform cron.alter_job(v_id, command :=
      'select public.clan_race_tick(c.id) from public.city_config c where exists (select 1 from public.clans k where k.city = c.id and k.disbanded_at is null);');
  end if;
  select jobid into v_id from cron.job where jobname = 'rating-tick';
  if v_id is not null then
    perform cron.alter_job(v_id, command :=
      'select public.rating_tick(c.id) from public.city_config c where exists (select 1 from public.catches k where k.caught_at >= now() - interval ''8 days'' and k.territory_id >= c.prefix and k.territory_id < chr(ascii(c.prefix) + 1));');
  end if;
end
$cron$;
