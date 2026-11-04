-- Улов под щитом, сохранённый «в дневник» до 04.11.2026, теперь считается (по просьбе владельца).
-- До 04.11 кнопка «Добавить в дневник» на окне «Сектор под щитом» клала улов в diary_catches:
-- такой улов не шёл ни в статистику, ни в челленджи, ни в награды. С 04.11 приложение шлёт его
-- в confirm_catch с моментом снимка: база сохраняет его как «опоздавший» (сектор не трогается,
-- монеты за вид платятся). Здесь четыре записи, сделанные до этого, переезжают в catches тем же
-- путём: confirm_catch от имени их хозяев, с их временем и фото. Дубль gamag (58, второй тап
-- на ту же скорпену, другое фото той же секунды) просто удаляется.
-- Уведомления подписчикам «поймал рыбу» не рассылаем: на время переноса выключен триггер
-- activity_log_fanout, в конце включается обратно. Откат: 01_backfill_shielded_diary_ROLLBACK.sql
do $backfill$
declare
  r record;
  v_late boolean;
begin
  alter table public.activity_log disable trigger activity_log_fanout;
  for r in select * from public.diary_catches where id in (57, 59, 61, 62) order by caught_at loop
    perform set_config('request.jwt.claim.sub', r.user_id::text, true);
    perform set_config('request.jwt.claims', json_build_object('sub', r.user_id, 'role', 'authenticated')::text, true);
    select c.late into v_late
    from public.confirm_catch(r.territory_id, r.species, r.photo_url, r.length_cm::int, r.weight_kg, null, null, r.caught_at) c;
    if not coalesce(v_late, false) then
      raise exception 'diary catch % would take the sector %, stopped', r.id, r.territory_id;
    end if;
  end loop;
  delete from public.diary_catches where id in (57, 58, 59, 61, 62);
  alter table public.activity_log enable trigger activity_log_fanout;
end
$backfill$;
