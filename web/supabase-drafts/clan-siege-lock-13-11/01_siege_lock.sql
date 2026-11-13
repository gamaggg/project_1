-- ЧЕРНОВИК. Применять только после «применяй» владельца, в тихие часы (20:00–03:00 UTC).
-- Откат: 01_siege_lock_ROLLBACK.sql. Прогон без следов: 01_siege_lock_DRYRUN.sql.
--
-- Пока штаб клана в осаде, общак закрыт на выход (просьба владельца 13.11.2026):
--   магазин, постройки и ускорения, «Выход», перенос штаба — отказ CLAN:siege_lock.
--   Вклады, рента, отчисления и награды по-прежнему приходят.
--   Добычу при падении штаба (kind = 'looted', clan_hq_tick) списать можно: это и есть конец осады.
-- Все траты из общака идут через _clan_treasury_spend, поэтому правка в одном месте.
-- Сигнатура и тело без изменений, кроме одной проверки; DEFAULT у функции нет (create or replace, не drop).

set local lock_timeout = '3s';

create or replace function public._clan_treasury_spend(p_clan_id bigint, p_amount int, p_kind text, p_user uuid, p_label text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_kind <> 'looted' and exists (select 1 from public.clan_sieges s where s.clan_id = p_clan_id) then
    raise exception 'CLAN:siege_lock';
  end if;
  update public.clan_treasury set balance = balance - p_amount where clan_id = p_clan_id and balance >= p_amount;
  if not found then raise exception 'CLAN:no_funds'; end if;
  insert into public.clan_treasury_log (clan_id, kind, amount, user_id, label) values (p_clan_id, p_kind, -p_amount, p_user, p_label);
end $$;
