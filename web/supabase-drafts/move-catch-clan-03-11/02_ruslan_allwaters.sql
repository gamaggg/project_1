-- Снять у Руслана (77c8ade9-…) награду «Обошёл всё побережье» и вернуть 100 монет (03.11.2026, по решению владельца).
-- Награду дал улов морского бычка на «пруду» Б-1030; после переноса улова на Б-1031 (море) прудового улова нет.
-- Награды сами не снимаются, поэтому вручную: строка в user_achievements, 100 монет назад, уведомление «Достижение открыто».
-- 25 монет «захват Б-1030» не трогаем. Откат: 02_ruslan_allwaters_ROLLBACK.sql
do $fix$
declare v_uid constant uuid := '77c8ade9-7df4-4f81-a32c-61153d9a859e'; n int; v_coins int;
begin
  delete from public.user_achievements where user_id = v_uid and achievement_key = 'allwaters';
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'expected one allwaters row, got %', n; end if;
  update public.profiles set coins = coins - 100 where id = v_uid returning coins into v_coins;
  if v_coins < 0 then raise exception 'coins would go negative'; end if;
  insert into public.coin_transactions (user_id, amount, reason, label)
  values (v_uid, -100, 'achievement_reward', 'Награда снята: Обошёл всё побережье');
  delete from public.notifications where user_id = v_uid and kind = 'award_granted' and payload->>'title' = 'Обошёл всё побережье';
end
$fix$;
