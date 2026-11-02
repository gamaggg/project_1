-- «Рыбак недели» in the week recap (get_city_week_recap → 'angler'):
-- most catches, then — new — most sector captures in the week, then the
-- earlier first catch of the week. Before: catches, then the first catch,
-- so in Moscow 26.10–01.11 Ваня (11 catches, 3 captures) beat Mimikron
-- (11 catches, 6 captures) only by starting the week earlier.
--
-- One line of the function changes; the rest of its body is taken from the
-- live definition, so nothing else (defaults, SECURITY DEFINER, grants —
-- CREATE OR REPLACE keeps them) can drift.
do $$
declare
  v_old text := 'order by u.n desc, u.first_at asc limit 1';
  v_new text := 'order by u.n desc, (select count(*) from claims cl where cl.user_id = u.user_id) desc, u.first_at asc limit 1';
  v_def text := pg_get_functiondef('public.get_city_week_recap(text, integer, uuid)'::regprocedure);
begin
  if (length(v_def) - length(replace(v_def, v_old, ''))) / length(v_old) <> 1 then
    raise exception 'get_city_week_recap: expected the old angler order exactly once';
  end if;
  execute replace(v_def, v_old, v_new);
end
$$;
