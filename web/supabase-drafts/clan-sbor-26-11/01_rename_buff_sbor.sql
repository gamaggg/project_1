-- 26.11.2026: клановый «Выход» переименован в «Сбор» (решение владельца). В базе меняются только тексты, которые видит игрок:
--   1) подпись бонуса в истории монет (_clan_buff_bonus) и уже записанные такие строки;
--   2) описания заданий «Иду!» и «Двойной улов».
-- Логика функции не меняется (тело то же, другая только строка подписи). Функция без параметров: DEFAULT терять нечего,
-- CREATE OR REPLACE сохраняет права (только postgres и service_role) и триггер clan_buff_bonus.
-- Подписи в журнале общака (clan_buff_launch, clan_buff_tick) игрок не видит (приложение пишет свои слова по виду записи): не трогаем.

CREATE OR REPLACE FUNCTION public._clan_buff_bonus()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_m public.clan_members; v_b public.clan_buffs; v_bonus int; v_min int;
begin
  if NEW.reason <> 'catch_reward' or NEW.amount <= 0 or NEW.catch_id is null then return NEW; end if;
  select * into v_m from public._my_clan_membership(NEW.user_id);
  if v_m.id is null then return NEW; end if;
  select b.* into v_b from public.clan_buffs b
    where b.clan_id = v_m.clan_id and now() between b.starts_at and b.ends_at
      and exists (select 1 from public.clan_buff_rsvp r where r.buff_id = b.id and r.user_id = NEW.user_id) limit 1;
  if v_b.id is null then return NEW; end if;
  select buff_min_rsvp into v_min from public.clan_economy where id = 1;
  if (select count(*) from public.clan_buff_rsvp r where r.buff_id = v_b.id) < v_min then return NEW; end if;
  select s.coin_value into v_bonus from public.catches c join public.species s on s.key = c.species where c.id = NEW.catch_id;
  if coalesce(v_bonus, 0) < 1 then return NEW; end if;
  update public.profiles set coins = coins + v_bonus where id = NEW.user_id;
  insert into public.coin_transactions (user_id, amount, reason, label) values (NEW.user_id, v_bonus, 'clan_buff', 'Баф клана «Сбор»');
  return NEW;
end $function$;

update public.coin_transactions set label = 'Баф клана «Сбор»' where reason = 'clan_buff' and label = 'Баф клана «Выход»';

update public.challenges set description = 'Отметь «иду» на сбор клана' where id = 'idu' and description = 'Отметь «иду» на выход клана';
update public.challenges set description = 'Поймай рыбу во время сбора клана (×2)' where id = 'dvoynoy_ulov' and description = 'Поймай рыбу во время выхода клана (×2)';
