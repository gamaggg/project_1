-- Откат 04 (24.11.2026): убрать значок NEW и снять новинки с продажи. Строки shop_items не удаляются, если вещь
-- уже кто-то купил (на неё ссылается user_inventory): тогда она просто перестаёт продаваться.
-- Чтение shop_items и buy_shop_item — как были до 04 (всем всё, без скрытых вещей).
drop policy if exists "shop items are public" on public.shop_items;
create policy "shop items are public" on public.shop_items for select using (true);

create or replace function public.buy_shop_item(p_item_id text)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_uid uuid := auth.uid();
  v_price int;
  v_name text;
  v_purchasable boolean;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  select price, name, purchasable into v_price, v_name, v_purchasable from public.shop_items where id = p_item_id;
  if v_price is null then
    raise exception 'unknown item';
  end if;
  if not v_purchasable then
    raise exception 'not for sale';
  end if;

  if exists (select 1 from public.user_inventory where user_id = v_uid and item_id = p_item_id) then
    raise exception 'already owned';
  end if;

  update public.profiles set coins = coins - v_price
  where id = v_uid and coins >= v_price;
  if not found then
    raise exception 'not enough coins';
  end if;

  insert into public.user_inventory (user_id, item_id) values (v_uid, p_item_id);
  insert into public.coin_transactions (user_id, amount, reason, label) values (v_uid, -v_price, 'buy_item', v_name);
end;
$function$;
drop function if exists public._me_super_admin();
drop function if exists public.shop_new_items();
drop table if exists public.shop_novelty_seen;
drop table if exists public.shop_novelties;
update public.shop_items set purchasable = false
 where id in ('frame_line','frame_coral','frame_scales','frame_storm','snow','fog','floats','sunset',
              'name_sticker','name_neon_sign','name_wave','name_bubbles','skin_ice','skin_lilies','skin_bubbles','skin_whirlpool');
delete from public.shop_items s
 where s.id in ('frame_line','frame_coral','frame_scales','frame_storm','snow','fog','floats','sunset',
                'name_sticker','name_neon_sign','name_wave','name_bubbles','skin_ice','skin_lilies','skin_bubbles','skin_whirlpool')
   and not exists (select 1 from public.user_inventory i where i.item_id = s.id)
   and not exists (select 1 from public.secret_box_opens o where o.item_id = s.id);
