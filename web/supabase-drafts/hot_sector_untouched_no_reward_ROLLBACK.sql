-- Откат hot_sector_untouched_no_reward.sql: награда держателю и без уловов.
do $mig$
declare
  d text := pg_get_functiondef('public.settle_hot_sectors'::regproc);
begin
  d := replace(d, $o$    -- За горячую неделю здесь никто не ловил — награды нет.
    if not exists (select 1 from public.catches c
                   where c.territory_id = h.territory_id and c.caught_at >= h.starts_at and c.caught_at < h.ends_at) then
      v_holders := '{}';
    end if;

$o$, '');
  execute d;
end
$mig$;
