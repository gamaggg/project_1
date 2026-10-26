-- Откат 01_function_access.sql: возвращает прежние права (PUBLIC + anon + authenticated) тем же функциям.
do $do$
declare
  r record;
  v_names text[] := array[
    'grant_all_weekly_awards','grant_catch_of_month_awards','grant_duelist_awards','grant_guardian_awards',
    'grant_lightning_awards','grant_night_watch_awards','grant_season_legend_awards','grant_weekly_rank_awards',
    'notify_challenge_deadline_approaching','notify_weekly_results','compute_challenge_progress','coin_multiplier',
    'buy_shield','spin_wheel','fanout_activity_notification','fanout_award_notification','fanout_new_follower',
    'notify_catch_like','queue_telegram_notification',
    'activate_buff','admin_get_user_coin_transactions','admin_get_user_inventory','admin_grant_coins',
    'admin_post_announcement','admin_refund_buff','admin_refund_shop_item','buy_extra_challenge','buy_shop_item',
    'confirm_catch','create_telegram_link_token','equip_shop_item','get_clan_race','get_my_challenge_week_state',
    'get_sector_insights','get_weekly_leaderboard','log_challenge_event','mark_notifications_read',
    'my_telegram_notification_state','set_telegram_notifications','swap_challenge','sync_my_achievements',
    'sync_my_challenges'
  ];
begin
  for r in
    select p.oid::regprocedure as sig
    from pg_proc p
    where p.pronamespace = 'public'::regnamespace and p.prokind = 'f' and p.proname = any(v_names)
  loop
    execute format('grant execute on function %s to public, anon, authenticated', r.sig);
  end loop;
end
$do$;
