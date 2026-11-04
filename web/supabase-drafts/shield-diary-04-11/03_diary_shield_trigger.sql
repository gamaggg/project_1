-- Улов под щитом, записанный «в дневник» старой сборкой приложения, переезжает в catches сам (04.11.2026).
-- С 04.11 новое приложение шлёт такой улов прямо в confirm_catch с моментом снимка («опоздавший»:
-- статистика, челленджи, награды, монеты за вид; сектор, защита и щит не трогаются). Но Telegram держит
-- мини-приложение открытым днями, и старая сборка продолжала писать в diary_catches: 04.11 так
-- потеряли улов gamag (корейский окунь) и istepkin630 (два карася). Этот триггер делает то же самое
-- на стороне базы для таких записей: узнаёт их по месту (центр сектора, а не GPS снимка), вызывает
-- confirm_catch от имени игрока и убирает запись из дневника. Улов из галереи, добавленный вручную,
-- не трогается. Не вышло (пауза, потолок, заморозка, снимок старше суток, щит уже кончился) —
-- запись остаётся в дневнике, как было. Лишнюю запись двойного тапа удаляет (у админа паузы между уловами нет, поэтому дубль ловится явной проверкой, а не паузой).
-- Откат: 03_diary_shield_trigger_ROLLBACK.sql
create or replace function public._diary_shield_catch_to_catches()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_lat double precision;
  v_lng double precision;
  v_late boolean;
begin
  -- Только запрос самого игрока (приложение), не вставка админа или сервиса.
  if new.territory_id is null or new.lat is null or new.lng is null or auth.uid() is distinct from new.user_id then
    return null;
  end if;
  -- Окно «Сектор под щитом» старой сборки приложения кладёт улов в дневник с центром сектора
  -- как местом; улов из галереи несёт GPS самого снимка. Только первый случай переезжает.
  select t.lat, t.lng into v_lat, v_lng from public.territories t where t.id = new.territory_id and not t.is_deleted;
  if not found or abs(new.lat - v_lat) > 0.0000015 or abs(new.lng - v_lng) > 0.0000015 then
    return null;
  end if;
  -- Двойной тап (или повтор): этот самый улов уже принят, лишняя запись просто удаляется.
  if exists (
    select 1 from public.catches c
    where c.user_id = new.user_id and c.species = new.species and c.territory_id = new.territory_id
      and abs(extract(epoch from (c.caught_at - least(new.caught_at, now())))) < 2
  ) then
    delete from public.diary_catches where id = new.id;
    return null;
  end if;
  begin
    select c.late into v_late
    from public.confirm_catch(new.territory_id, new.species, new.photo_url, new.length_cm::int, new.weight_kg, null, null, least(new.caught_at, now())) c;
    -- Сектор трогать нельзя: если улов вдруг принял бы сектор (щит уже кончился), всё откатывается,
    -- запись остаётся в дневнике, как раньше.
    if not coalesce(v_late, false) then
      raise exception 'DIARY_NOT_LATE';
    end if;
    delete from public.diary_catches where id = new.id;
  exception when others then
    -- Не вышло (пауза между уловами, потолок в сутки, заморозка, снимок старше суток):
    -- запись остаётся в дневнике, как было.
    null;
  end;
  return null;
end;
$function$;

drop trigger if exists diary_shield_catch on public.diary_catches;
create trigger diary_shield_catch after insert on public.diary_catches
  for each row execute function public._diary_shield_catch_to_catches();

-- Прямой вызов триггерной функции не нужен никому (триггер срабатывает и без права на вызов).
revoke execute on function public._diary_shield_catch_to_catches() from public, anon, authenticated;
