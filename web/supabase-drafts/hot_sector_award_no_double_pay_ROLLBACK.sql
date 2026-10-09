-- Откат hot_sector_award_no_double_pay.sql.
do $mig$
declare
  d text := pg_get_functiondef('public.fanout_award_notification'::regproc);
begin
  d := replace(d, $o$  -- Горячий сектор: монеты и уведомление даёт settle_hot_sectors.
  if new.kind = 'hot_sector' then
    return new;
  end if;
$o$, '');
  execute d;
end
$mig$;

do $mig$
declare
  d text := pg_get_functiondef('public.settle_hot_sectors'::regproc);
begin
  d := replace(d, $o$'Удержал горячий сектор ' || h.territory_id || ' до конца недели.'$o$,
                  $n$'Удержал горячий сектор ' || h.territory_id || ' до конца недели — +100 монет.'$n$);
  execute d;
end
$mig$;
