-- Горячий сектор (09.10.2026, просьба): если за горячую неделю на секторе
-- никто не поймал ни одной рыбы, награды в конце недели нет — ни монет, ни
-- медали, ни уведомления. Ловил хоть кто-то — награда держателю(ям) в конце
-- воскресенья, как раньше. Сектор всё равно помечается как подведённый.

do $mig$
declare
  d text := pg_get_functiondef('public.settle_hot_sectors'::regproc);
begin
  if position($o$    foreach v_uid in array coalesce(v_holders, '{}') loop
$o$ in d) = 0 then raise exception 'settle_hot_sectors: holders loop not found'; end if;
  d := replace(d, $o$    foreach v_uid in array coalesce(v_holders, '{}') loop
$o$, $n$    -- За горячую неделю здесь никто не ловил — награды нет.
    if not exists (select 1 from public.catches c
                   where c.territory_id = h.territory_id and c.caught_at >= h.starts_at and c.caught_at < h.ends_at) then
      v_holders := '{}';
    end if;

    foreach v_uid in array coalesce(v_holders, '{}') loop
$n$);
  execute d;
end
$mig$;
