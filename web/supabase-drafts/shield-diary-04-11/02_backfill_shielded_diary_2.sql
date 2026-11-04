-- Ещё три улова под щитом, лежавшие в diary_catches (04.11.2026, продолжение 01_backfill_shielded_diary.sql).
-- Корейский окунь gamag (63) записан в дневник в 19:53 старой версией приложения: телефон ещё не
-- перезагрузил новую (код выложен в ~19:40). Два морских карася istepkin630 (56, 60) остались от
-- 19:00 и 19:15 тем же путём. Все три переходят в catches через confirm_catch с их временем и фото,
-- как «опоздавшие» (сектор B1173, защита и щит не меняются). Рассылка «поймал рыбу» на время
-- переноса выключена. Откат: 02_backfill_shielded_diary_2_ROLLBACK.sql
do $backfill$
declare
  r record;
  v_late boolean;
begin
  alter table public.activity_log disable trigger activity_log_fanout;
  for r in select * from public.diary_catches where id in (56, 60, 63) order by caught_at loop
    perform set_config('request.jwt.claim.sub', r.user_id::text, true);
    perform set_config('request.jwt.claims', json_build_object('sub', r.user_id, 'role', 'authenticated')::text, true);
    select c.late into v_late
    from public.confirm_catch(r.territory_id, r.species, r.photo_url, r.length_cm::int, r.weight_kg, null, null, r.caught_at) c;
    if not coalesce(v_late, false) then
      raise exception 'diary catch % would take the sector %, stopped', r.id, r.territory_id;
    end if;
  end loop;
  delete from public.diary_catches where id in (56, 60, 63);
  alter table public.activity_log enable trigger activity_log_fanout;
end
$backfill$;
