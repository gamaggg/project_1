-- Отчисление с улова в общак клана: минимум 1 монета (решение владельца 09.11.2026).
-- Раньше: floor(награда * ставка / 100); при награде 15 и ставке 5% выходило 0, и отчисление не приходило ни разу.
-- Теперь: не меньше 1 монеты. Если отчисление съело бы всю награду (награда 1), не берём ничего.
-- Только тело функции _clan_tax_on_catch; триггер clan_tax_on_catch на coin_transactions не трогаем.
-- Откат: 01_tax_min_one_ROLLBACK.sql (возвращает прежнее тело).
create or replace function public._clan_tax_on_catch()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare v_m public.clan_members; v_rate smallint; v_tax int; v_taken int;
begin
  if NEW.reason <> 'catch_reward' or NEW.amount <= 0 then return NEW; end if;
  select * into v_m from public._my_clan_membership(NEW.user_id);
  if v_m.id is null or not public._clan_econ_on(v_m.clan_id) then return NEW; end if;
  select tax_rate into v_rate from public.clan_treasury where clan_id = v_m.clan_id;
  if coalesce(v_rate, 0) = 0 then return NEW; end if;
  v_tax := greatest(1, floor(NEW.amount * v_rate / 100.0)::int);
  if v_tax >= NEW.amount then return NEW; end if;
  v_taken := public._clan_treasury_add(v_m.clan_id, v_tax, 'tax', NEW.user_id, coalesce(NEW.label, ''));
  if v_taken > 0 then
    update public.profiles set coins = coins - v_taken where id = NEW.user_id;
    insert into public.coin_transactions (user_id, amount, reason, label) values (NEW.user_id, -v_taken, 'clan_tax', 'Отчисление в общак клана ' || v_rate || '%');
  end if;
  return NEW;
end $function$;
