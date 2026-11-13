-- Откат 01_siege_lock.sql: прежнее тело _clan_treasury_spend (как в clan-update-06-11/02_buff_hq.sql).
-- Перед применением 01 сверить живое тело с этим текстом (шаг 1 прогона).
set local lock_timeout = '3s';

create or replace function public._clan_treasury_spend(p_clan_id bigint, p_amount int, p_kind text, p_user uuid, p_label text)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.clan_treasury set balance = balance - p_amount where clan_id = p_clan_id and balance >= p_amount;
  if not found then raise exception 'CLAN:no_funds'; end if;
  insert into public.clan_treasury_log (clan_id, kind, amount, user_id, label) values (p_clan_id, p_kind, -p_amount, p_user, p_label);
end $$;
