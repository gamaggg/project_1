-- Награды-медали и приз рейтинга недели (25.11.2026). ЧЕРНОВИК, применять только после «применяй». После 10.
-- Владелец: «Баф не должен влиять на приз в рейтинге и награды» и «Замени призы рейтинга на актуальный».
-- 1) Баф «Двойные монеты» не умножает монеты за медаль (умножение в fanout_award_notification убрано).
-- 2) За рейтинг недели (медаль weekly_rank) старого бонуса 150/100/60 больше нет: остаётся только актуальный приз из
--    grant_weekly_rank_awards (300 монет + ключ, 200, 100), который выдаётся тем, у кого есть хотя бы 1 сектор недели.
--    В уведомлении и в боте теперь стоит именно он («+300 монет и ключ»), а не бонус медали.
-- Остальные медали и их монеты (80 хранитель, 100 улов месяца, 70 молния, 150 легенда сезона, 60 ночной страж, 90 дуэлянт) —
-- как были, но без бафа. Уловы, захваты, челленджи, достижения и награды клана — без изменений.
create or replace function public.fanout_award_notification()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_coins int;
  v_shown int;
  v_key boolean := false;
begin
  -- Горячий сектор: монеты и уведомление даёт settle_hot_sectors.
  if new.kind = 'hot_sector' then
    return new;
  end if;
  if new.kind = 'weekly_rank' then
    -- Монеты и ключ рейтинга недели выдала grant_weekly_rank_awards за секунду до этой медали; здесь только показать их.
    v_coins := 0;
    select t.amount into v_shown from public.coin_transactions t
     where t.user_id = new.user_id and t.reason = 'weekly_rank_prize' and t.label = 'Рейтинг недели: ' || new.title
       and t.created_at > now() - interval '10 minutes'
     order by t.created_at desc limit 1;
    v_shown := coalesce(v_shown, 0);
    v_key := new.title = '1 место' and v_shown > 0;
  else
    v_coins := case
      when new.kind = 'guardian' then 80
      when new.kind = 'catch_of_month' then 100
      when new.kind = 'lightning' then 70
      when new.kind = 'season_legend' then 150
      when new.kind = 'night_watch' then 60
      when new.kind = 'duelist' then 90
      when new.kind = 'clan_race_winner' then 0
      else 50
    end;
    v_shown := v_coins;
  end if;
  if v_coins > 0 then
    update public.profiles set coins = coins + v_coins where id = new.user_id;
  end if;
  insert into public.notifications (user_id, kind, payload)
  values (new.user_id, 'award_granted',
    jsonb_build_object('title', new.title, 'subtitle', new.subtitle, 'coins', v_shown) || case when v_key then jsonb_build_object('key', true) else '{}'::jsonb end)
  on conflict do nothing;
  return new;
exception when others then
  return new;
end;
$function$;
