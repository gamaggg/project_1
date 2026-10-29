-- Откат 01_admin_edit_catch_notify.sql: возвращает обе функции к виду на 29.10.2026.
-- Уже созданные уведомления 'catch_species_changed' и строки журнала монет остаются (данные не трогаем).

create or replace function public.admin_edit_catch(p_catch_id bigint, p_species text, p_length_cm integer, p_weight_kg numeric)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_catch public.catches;
  v_owner_name text;
  v_old_name text;
  v_new_name text;
  v_changes text[] := '{}';
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and is_super_admin) then
    raise exception 'not authorized';
  end if;

  select * into v_catch from public.catches where id = p_catch_id for update;
  if not found then raise exception 'EDIT:catch_not_found'; end if;
  select s.name into v_new_name from public.species s where s.key = p_species;
  if not found then raise exception 'EDIT:unknown_species'; end if;
  -- Same limits as the catch form (ConfirmScreen): 1–300 cm, 10–9999 g.
  if p_length_cm is not null and (p_length_cm < 1 or p_length_cm > 300) then raise exception 'EDIT:bad_length'; end if;
  if p_weight_kg is not null and (p_weight_kg < 0.01 or p_weight_kg > 9.999) then raise exception 'EDIT:bad_weight'; end if;

  select s.name into v_old_name from public.species s where s.key = v_catch.species;
  if p_species is distinct from v_catch.species then
    v_changes := v_changes || format('вид %s → %s', coalesce(v_old_name, v_catch.species), v_new_name);
  end if;
  if p_length_cm is distinct from v_catch.length_cm then
    v_changes := v_changes || format('размер %s → %s', coalesce(v_catch.length_cm || ' см', '—'), coalesce(p_length_cm || ' см', '—'));
  end if;
  if p_weight_kg is distinct from v_catch.weight_kg then
    v_changes := v_changes || format('вес %s → %s', coalesce(round(v_catch.weight_kg * 1000) || ' г', '—'), coalesce(round(p_weight_kg * 1000) || ' г', '—'));
  end if;
  if cardinality(v_changes) = 0 then raise exception 'EDIT:no_changes'; end if;

  update public.catches set species = p_species, length_cm = p_length_cm, weight_kg = p_weight_kg where id = p_catch_id;

  select p.display_name into v_owner_name from public.profiles p where p.id = v_catch.user_id;
  insert into public.admin_actions (admin_id, action, target_user_id, territory_id, details)
  values (auth.uid(), 'edit_catch', v_catch.user_id, v_catch.territory_id,
    'Изменил улов пользователя ' || coalesce(v_owner_name, '—') || ' на ' || v_catch.territory_id || ': ' || array_to_string(v_changes, ', '));

  -- A new species or a bigger fish can unlock an achievement; its reward
  -- shouldn't wait for this angler's next catch. Never blocks the edit.
  begin
    perform public._sync_achievements_for_user(v_catch.user_id);
  exception when others then
    raise warning 'admin_edit_catch: achievements sync failed: %', sqlerrm;
  end;

  return jsonb_build_object('changes', to_jsonb(v_changes));
end;
$function$;

create or replace function public.queue_telegram_notification()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  if new.kind not in ('sector_lost', 'new_follower', 'catch_liked', 'moderation', 'award_granted', 'weekly_result', 'follow_catch',
                      'challenge_completed', 'challenges_week_done', 'challenge_deadline_soon', 'catch_comment', 'comment_reply',
                      'clan_invite', 'clan_join_request', 'clan_join_accepted', 'clan_kicked', 'clan_disbanded',
                      'clan_chest_reward', 'clan_race_result', 'clan_race_overtaken', 'clan_race_finished',
                      'clan_chat_mention', 'referral_joined', 'referral_reward', 'system_alert',
                      'hot_sector_week', 'hot_sector_won', 'legend_gained', 'legend_lost', 'bite_forecast', 'daily_reward_reminder',
                      'sector_attacked', 'support_reply', 'admin_gift', 'geo_bonus', 'catch_edited', 'clan_war_started', 'clan_war_reminder') then
    return new;
  end if;

  if new.kind = 'follow_catch' and exists (
    select 1 from public.notifications n
    where n.user_id = new.user_id
      and n.created_at > now() - interval '3 hours'
      and n.id <> new.id
      and n.kind = 'follow_catch'
      and n.actor_id is not distinct from new.actor_id
  ) then
    return new;
  end if;

  insert into public.telegram_outbox (notification_id, chat_id, deliver_after)
  select new.id, p.telegram_id,
    -- Тревога не ждёт утра — остальные уведомления ночью копятся до 08:00.
    case when new.kind = 'system_alert' then now() else public.notification_deliver_after(p.city) end
  from public.profiles p
  where p.id = new.user_id
    -- Alerts reach the admins even with game notifications switched off.
    and (p.tg_notifications_enabled or new.kind in ('system_alert', 'catch_edited'))
    and p.telegram_id is not null
    and p.tg_unreachable_at is null;

  return new;
exception when others then
  return new;
end;
$function$;
