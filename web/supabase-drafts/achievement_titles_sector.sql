-- «Территория» → «Сектор»: два названия достижений, которые сервер пишет в ленту.
-- Клиент (ActivityIcons.tsx) уже узнаёт и старые, и новые названия, так что порядок применения не важен.
-- Тело функции берётся из самой БД и правится replace — DEFAULTы и остальное не трогаются.
do $$
declare
  v_def text := pg_get_functiondef('public._sync_achievements_for_user'::regproc);
begin
  if position('''Три территории''' in v_def) = 0 or position('''Отбил территорию''' in v_def) = 0 then
    raise exception 'titles not found — function changed since the draft was written';
  end if;
  execute replace(replace(v_def, '''Три территории''', '''Три сектора'''), '''Отбил территорию''', '''Отбил сектор''');
end $$;
