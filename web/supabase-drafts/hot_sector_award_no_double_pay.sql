-- Медаль «Хозяин горячего сектора» (09.10.2026): settle_hot_sectors сам
-- платит 100 монет и шлёт уведомление «Ты удержал горячий сектор». А триггер
-- медалей (fanout_award_notification) для незнакомого вида добавлял ещё
-- 50 монет (×2 с удвоением) и второе уведомление «Новая награда» — итого
-- 150–200 монет и два сообщения в Telegram вместо обещанных +100.
-- Для hot_sector триггер теперь ничего не делает.
-- И в описании медали больше нет монет (просьба 09.10): «Удержал горячий
-- сектор B1173 до конца недели.»

do $mig$
declare
  d text := pg_get_functiondef('public.fanout_award_notification'::regproc);
begin
  if position($o$  v_coins := case
$o$ in d) = 0 then raise exception 'fanout_award_notification: case not found'; end if;
  d := replace(d, $o$  v_coins := case
$o$, $n$  -- Горячий сектор: монеты и уведомление даёт settle_hot_sectors.
  if new.kind = 'hot_sector' then
    return new;
  end if;
  v_coins := case
$n$);
  execute d;
end
$mig$;

do $mig$
declare
  d text := pg_get_functiondef('public.settle_hot_sectors'::regproc);
begin
  if position($o$'Удержал горячий сектор ' || h.territory_id || ' до конца недели — +100 монет.'$o$ in d) = 0 then
    raise exception 'settle_hot_sectors: description not found';
  end if;
  d := replace(d, $o$'Удержал горячий сектор ' || h.territory_id || ' до конца недели — +100 монет.'$o$,
                  $n$'Удержал горячий сектор ' || h.territory_id || ' до конца недели.'$n$);
  execute d;
end
$mig$;
