-- Откат 16: вернуть умножение монет за медаль на баф и старый бонус медали рейтинга недели (150/100/60).
create or replace function public.fanout_award_notification()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_coins int;
begin
  if new.kind = 'hot_sector' then
    return new;
  end if;
  v_coins := case
    when new.kind = 'weekly_rank' and new.title = '1 место' then 150
    when new.kind = 'weekly_rank' and new.title = '2 место' then 100
    when new.kind = 'weekly_rank' and new.title = '3 место' then 60
    when new.kind = 'guardian' then 80
    when new.kind = 'catch_of_month' then 100
    when new.kind = 'lightning' then 70
    when new.kind = 'season_legend' then 150
    when new.kind = 'night_watch' then 60
    when new.kind = 'duelist' then 90
    when new.kind = 'clan_race_winner' then 0
    else 50
  end;
  v_coins := v_coins * public.coin_multiplier(new.user_id);
  if v_coins > 0 then
    update public.profiles set coins = coins + v_coins where id = new.user_id;
  end if;
  insert into public.notifications (user_id, kind, payload)
  values (new.user_id, 'award_granted', jsonb_build_object('title', new.title, 'subtitle', new.subtitle, 'coins', v_coins))
  on conflict do nothing;
  return new;
exception when others then
  return new;
end;
$function$;
