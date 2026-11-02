-- Back to: most catches, then the earlier first catch of the week.
do $$
declare
  v_old text := 'order by u.n desc, (select count(*) from claims cl where cl.user_id = u.user_id) desc, u.first_at asc limit 1';
  v_new text := 'order by u.n desc, u.first_at asc limit 1';
  v_def text := pg_get_functiondef('public.get_city_week_recap(text, integer, uuid)'::regprocedure);
begin
  if (length(v_def) - length(replace(v_def, v_old, ''))) / length(v_old) <> 1 then
    raise exception 'get_city_week_recap: expected the new angler order exactly once';
  end if;
  execute replace(v_def, v_old, v_new);
end
$$;
