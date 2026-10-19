-- Регулярные задания новых городов (20.10.2026): те же девять заданий, что у шаблонного города,
-- с тем же расписанием, но минутой позже, чтобы города не стартовали вместе:
--   Петербург (spb)  — копия москвовских, +1 мин (часовой пояс Москвы)
--   Сочи (sochi)     — копия москвовских, +2 мин (часовой пояс Москвы)
--   Тбилиси (tbilisi) — копия батумских, +1 мин (часовой пояс Тбилиси)
-- В командах подставляются имя города (`'moscow'` / `city=moscow`) и буква сектора (`'M'`).
-- Секрет прогноза клёва берётся из команды шаблонного задания, в файле его нет.
-- Задание clan-race-tick одно на все города: к нему дописываются вызовы для новых.
-- Откат: 05_cron_jobs_ROLLBACK.sql
do $cron$
declare
  t record;
  j record;
  v_name text;
  v_sched text;
  v_cmd text;
  v_tick_id bigint;
  v_tick_cmd text;
begin
  for t in
    select * from (values
      ('spb',     'moscow', 'P', 'M', 1),
      ('sochi',   'moscow', 'S', 'M', 2),
      ('tbilisi', 'batumi', 'T', 'B', 1)
    ) as v(city, tmpl, prefix, tprefix, mins)
  loop
    for j in
      select jobname, schedule, command from cron.job
      where jobname ~ ('-' || t.tmpl || '$')
    loop
      v_name := regexp_replace(j.jobname, '-' || t.tmpl || '$', '-' || t.city);
      v_sched := ((split_part(j.schedule, ' ', 1))::int + t.mins)::text || substr(j.schedule, position(' ' in j.schedule));
      v_cmd := replace(j.command, '''' || t.tmpl || '''', '''' || t.city || '''');
      v_cmd := replace(v_cmd, 'city=' || t.tmpl, 'city=' || t.city);
      v_cmd := replace(v_cmd, '''' || t.tprefix || '''', '''' || t.prefix || '''');
      if not exists (select 1 from cron.job where jobname = v_name) then
        perform cron.schedule(v_name, v_sched, v_cmd);
      end if;
    end loop;
  end loop;

  select jobid, command into v_tick_id, v_tick_cmd from cron.job where jobname = 'clan-race-tick';
  if v_tick_id is not null and v_tick_cmd not like '%''spb''%' then
    perform cron.alter_job(v_tick_id, command := v_tick_cmd
      || ' select public.clan_race_tick(''spb''); select public.clan_race_tick(''sochi''); select public.clan_race_tick(''tbilisi'');');
  end if;
end
$cron$;
