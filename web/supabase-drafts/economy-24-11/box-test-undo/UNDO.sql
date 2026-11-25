-- Отмена теста секретного бокса владельцем (25.11.2026), по его «почисти». Аккаунт суперадмина (единственный).
-- Снимок до теста — SNAPSHOT.md: 1 063 монеты, 7 вещей, надет скин skin_lightning, история монет до id 16466.
-- Убирается только то, что дал бокс, и тестовые 10 000 (id 16598); прочие монеты не трогаются.
do $undo$
declare
  v_uid uuid := (select id from public.profiles where is_super_admin order by created_at limit 1);
  v_back int;
begin
  -- монеты: всё, что бокс списал и выдал после снимка, плюс тестовое начисление — назад
  select coalesce(sum(amount), 0) into v_back from public.coin_transactions
   where user_id = v_uid and (id = 16598 or (id > 16466 and reason in ('secret_box', 'secret_box_refund', 'secret_box_coins')));
  update public.profiles set coins = coins - v_back where id = v_uid;
  -- надетая вещь из бокса — снять, вернуть надетое до теста
  update public.profiles set equipped_skin = 'skin_lightning'
   where id = v_uid and equipped_skin in (select item_id from public.secret_box_opens where user_id = v_uid and item_id is not null and refund = 0);
  update public.profiles set equipped_frame = 'frame_royal'
   where id = v_uid and equipped_frame in (select item_id from public.secret_box_opens where user_id = v_uid and item_id is not null and refund = 0);
  update public.profiles set hero_bg = 'deepwater'
   where id = v_uid and hero_bg in (select item_id from public.secret_box_opens where user_id = v_uid and item_id is not null and refund = 0);
  update public.profiles set equipped_name_style = 'name_gold_shine'
   where id = v_uid and equipped_name_style in (select item_id from public.secret_box_opens where user_id = v_uid and item_id is not null and refund = 0);
  -- выпавшие новые вещи — из инвентаря
  delete from public.user_inventory i
   where i.user_id = v_uid and i.item_id in (select item_id from public.secret_box_opens where user_id = v_uid and item_id is not null and refund = 0);
  -- строки истории и журнал бокса
  delete from public.coin_transactions
   where user_id = v_uid and (id = 16598 or (id > 16466 and reason in ('secret_box', 'secret_box_refund', 'secret_box_coins')));
  delete from public.secret_box_opens where user_id = v_uid;
end $undo$;
