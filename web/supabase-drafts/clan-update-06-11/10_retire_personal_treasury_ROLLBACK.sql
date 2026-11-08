-- Откат 10 (08.11.2026).
-- Если retire_personal_treasury() ещё НЕ вызывали: достаточно удалить функцию.
drop function if exists public.retire_personal_treasury();
-- Если её уже вызвали: начисленные монеты остаются у игроков (это их накопленное), а Казну и «Двойные монеты» вернуть так:
--   collect_treasury, get_treasury — применить заново их тела, снятые перед применением (pg_get_functiondef сохранить в
--   web/supabase-drafts/clan-update-06-11/10_saved_before_retire.sql в день вызова; см. README);
--   activate_buff — убрать строку «if p_buff_id = 'double_coins' then raise exception 'BUFF:retired'; end if;» и комментарий над ней.
