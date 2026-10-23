-- Обратно: «Три сектора» → «Три территории», «Отбил сектор» → «Отбил территорию».
do $$
declare
  v_def text := pg_get_functiondef('public._sync_achievements_for_user'::regproc);
begin
  execute replace(replace(v_def, '''Три сектора''', '''Три территории'''), '''Отбил сектор''', '''Отбил территорию''');
end $$;
