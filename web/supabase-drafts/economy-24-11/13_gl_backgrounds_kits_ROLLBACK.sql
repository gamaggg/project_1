-- Откат 13 (25.11.2026): убрать живые фоны, их рамки, имена и комплекты. Если кто-то уже купил, выданные вещи остаются
-- у игроков (их строки в shop_items не удаляются), заказы и пресеты сохраняются: удаляется только то, у чего нет владельцев.
-- Внимание: прежние версии функций возвращаются из 11 и из живой базы (admin_refund_shop_item).

-- Защита: если за живые фоны уже платили, откат отказывается (заказы нужны для учёта Звёзд): убрать вручную.
do $guard$
begin
  if exists (select 1 from public.stars_orders o where o.product_id like '%\_gl\_%' and o.status = 'paid') then
    raise exception 'ROLLBACK 13 refused: paid orders for the live backgrounds exist';
  end if;
end
$guard$;

-- Профили, у которых стоит фон с пресетом «id~пресет», до отката возвращаются к обычному id (старая проверка пресетов не знает).
update public.profiles set hero_bg = split_part(hero_bg, '~', 1) where hero_bg like '%~%';
-- Фоны, которых не было в старой проверке, не вернуть: у кого они стоят, получают 'default'.
update public.profiles set hero_bg = 'default'
 where hero_bg not in ('default','ocean','forest','dusk','crimson','mono','teal','rose','waves','waves-ocean','waves-purple','waves-pink','aurora','aurora-orange','aurora-pink','aurora-blue','aurora-light','aurora-light-orange','aurora-light-pink','aurora-light-blue','circles','halftone','deepwater','moonpath','school','golddust');
alter table public.profiles drop constraint if exists profiles_hero_bg_check;
alter table public.profiles add constraint profiles_hero_bg_check
  check (hero_bg = any (array['default','ocean','forest','dusk','crimson','mono','teal','rose','waves','waves-ocean','waves-purple','waves-pink','aurora','aurora-orange','aurora-pink','aurora-blue','aurora-light','aurora-light-orange','aurora-light-pink','aurora-light-blue','circles','halftone','deepwater','moonpath','school','golddust']));

-- Функции Звёзд: версии из 11.
drop function if exists public.stars_order_create(text, text);
create or replace function public.stars_order_create(p_product text)
 returns jsonb language plpgsql security definer set search_path to 'public'
as $function$
declare
  v_uid uuid := auth.uid(); v_p public.stars_products; v_item_name text; v_id uuid;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  if not exists (select 1 from public.profiles where id = v_uid and not coalesce(is_blocked, false)) then raise exception 'account blocked'; end if;
  if not public._stars_open_for(v_uid) then raise exception 'STARS:closed'; end if;
  select * into v_p from public.stars_products where id = p_product and active;
  if not found then raise exception 'STARS:unknown'; end if;
  if v_p.item_id is not null then
    if exists (select 1 from public.user_inventory where user_id = v_uid and item_id = v_p.item_id) then raise exception 'STARS:owned'; end if;
    select name into v_item_name from public.shop_items where id = v_p.item_id;
  end if;
  delete from public.stars_orders where user_id = v_uid and status = 'pending' and created_at < now() - interval '1 day';
  if (select count(*) from public.stars_orders where user_id = v_uid and status = 'pending' and created_at > now() - interval '1 hour') >= 30 then raise exception 'STARS:too_many'; end if;
  insert into public.stars_orders (user_id, product_id, stars) values (v_uid, v_p.id, v_p.stars) returning id into v_id;
  return jsonb_build_object('order_id', v_id, 'product_id', v_p.id, 'kind', v_p.kind, 'amount', v_p.amount, 'item_id', v_p.item_id, 'item_name', v_item_name, 'stars', v_p.stars);
end;
$function$;
revoke all on function public.stars_order_create(text) from public, anon;
grant execute on function public.stars_order_create(text) to authenticated;

create or replace function public.get_stars_products()
 returns jsonb language plpgsql stable security definer set search_path to 'public'
as $function$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  if not public._stars_open_for(v_uid) then return '[]'::jsonb; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'kind', p.kind, 'amount', p.amount, 'item_id', p.item_id, 'stars', p.stars,
      'owned', p.item_id is not null and exists (select 1 from public.user_inventory i where i.user_id = v_uid and i.item_id = p.item_id))
      order by p.sort_order) from public.stars_products p where p.active and p.kind <> 'kit' and (p.item_id is null or p.item_id not like '%\_gl\_%')), '[]'::jsonb);
end;
$function$;
revoke all on function public.get_stars_products() from public, anon;
grant execute on function public.get_stars_products() to authenticated;

create or replace function public.stars_precheck(p_order uuid, p_amount int)
 returns text language plpgsql stable security definer set search_path to 'public'
as $function$
declare v_o public.stars_orders; v_p public.stars_products;
begin
  select * into v_o from public.stars_orders where id = p_order;
  if not found or v_o.status <> 'pending' then return 'order'; end if;
  if v_o.stars <> p_amount then return 'amount'; end if;
  select * into v_p from public.stars_products where id = v_o.product_id;
  if not found or not v_p.active then return 'product'; end if;
  if exists (select 1 from public.profiles where id = v_o.user_id and coalesce(is_blocked, false)) then return 'blocked'; end if;
  if v_p.item_id is not null and exists (select 1 from public.user_inventory where user_id = v_o.user_id and item_id = v_p.item_id) then return 'owned'; end if;
  return 'ok';
end;
$function$;
revoke all on function public.stars_precheck(uuid, int) from public, anon, authenticated;
grant execute on function public.stars_precheck(uuid, int) to service_role;

create or replace function public.stars_fulfill(p_order uuid, p_amount int, p_charge_id text, p_provider_charge_id text, p_payer bigint)
 returns jsonb language plpgsql security definer set search_path to 'public'
as $function$
declare v_o public.stars_orders; v_p public.stars_products;
begin
  select * into v_o from public.stars_orders where id = p_order for update;
  if not found then raise exception 'STARS:order'; end if;
  select * into v_p from public.stars_products where id = v_o.product_id;
  if v_o.status = 'paid' then
    return jsonb_build_object('already', true, 'user_id', v_o.user_id, 'kind', v_p.kind, 'amount', v_p.amount, 'item_id', v_p.item_id);
  end if;
  if exists (select 1 from public.stars_orders where telegram_charge_id = p_charge_id) then raise exception 'STARS:charge_reused'; end if;
  if v_o.stars <> p_amount then raise exception 'STARS:amount'; end if;
  if v_p.kind = 'coins' then
    update public.profiles set coins = coins + v_p.amount where id = v_o.user_id;
    insert into public.coin_transactions (user_id, amount, reason, label) values (v_o.user_id, v_p.amount, 'stars_purchase', 'Покупка за Звёзды: ' || v_p.amount || ' монет');
  elsif v_p.kind = 'keys' then
    insert into public.secret_box_free as f (user_id, opens) values (v_o.user_id, v_p.amount) on conflict (user_id) do update set opens = f.opens + v_p.amount;
  else
    insert into public.user_inventory (user_id, item_id) values (v_o.user_id, v_p.item_id) on conflict do nothing;
  end if;
  update public.stars_orders set status = 'paid', paid_at = now(), telegram_charge_id = p_charge_id, provider_charge_id = p_provider_charge_id, payer_telegram_id = p_payer where id = v_o.id;
  return jsonb_build_object('already', false, 'user_id', v_o.user_id, 'kind', v_p.kind, 'amount', v_p.amount, 'item_id', v_p.item_id);
end;
$function$;
revoke all on function public.stars_fulfill(uuid, int, text, text, bigint) from public, anon, authenticated;
grant execute on function public.stars_fulfill(uuid, int, text, text, bigint) to service_role;

-- Возврат вещи: как до 13.
create or replace function public.admin_refund_shop_item(p_user_id uuid, p_item_id text)
 returns void language plpgsql security definer set search_path to 'public'
as $function$
declare v_price int; v_name text; v_purchasable boolean;
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and is_super_admin) then raise exception 'not authorized'; end if;
  select price, name, purchasable into v_price, v_name, v_purchasable from public.shop_items where id = p_item_id;
  if not found then raise exception 'unknown item'; end if;
  if not exists (select 1 from public.user_inventory where user_id = p_user_id and item_id = p_item_id) then raise exception 'not owned'; end if;
  if not v_purchasable then v_price := 0; end if;
  delete from public.user_inventory where user_id = p_user_id and item_id = p_item_id;
  update public.profiles set
    equipped_frame = case when equipped_frame = p_item_id then null else equipped_frame end,
    hero_bg = case when hero_bg = p_item_id then 'default' else hero_bg end,
    equipped_name_style = case when equipped_name_style = p_item_id then null else equipped_name_style end,
    equipped_skin = case when equipped_skin = p_item_id then null else equipped_skin end,
    coins = coins + v_price
  where id = p_user_id;
  insert into public.admin_actions (admin_id, action, target_user_id, details)
  values (auth.uid(), 'refund_item', p_user_id, case when v_purchasable then 'Вернул покупку «' || v_name || '», +' || v_price || ' монет' else 'Забрал «' || v_name || '»' end);
  if v_price > 0 then
    insert into public.coin_transactions (user_id, amount, reason, label) values (p_user_id, v_price, 'admin_refund', v_name);
  end if;
end;
$function$;

drop function if exists public.set_hero_bg_preset(text, text, boolean);
drop function if exists public.get_my_gl_presets();
drop function if exists public._stars_owned_count(uuid, text);

-- Товары и вещи без владельцев уходят; купленные остаются.
delete from public.stars_orders where product_id like '%\_gl\_%' and status = 'pending';
delete from public.stars_products p where p.id like '%\_gl\_%' and not exists (select 1 from public.stars_orders o where o.product_id = p.id);
alter table public.stars_orders drop column if exists preset;
alter table public.stars_products drop column if exists item_ids;
alter table public.stars_products drop column if exists title;
alter table public.stars_products drop column if exists released;
alter table public.stars_products drop constraint if exists stars_products_kind_check;
alter table public.stars_products add constraint stars_products_kind_check check (kind in ('coins', 'keys', 'item'));
drop table if exists public.user_gl_presets;
delete from public.shop_novelties where id like 'bg\_gl\_%' or id like 'frame\_gl\_%' or id like 'name\_gl\_%';
delete from public.shop_items s
 where (s.id like 'bg\_gl\_%' or s.id like 'frame\_gl\_%' or s.id like 'name\_gl\_%')
   and not exists (select 1 from public.user_inventory i where i.item_id = s.id);
