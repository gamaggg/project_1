-- Откат 02_ruslan_allwaters.sql: вернуть награду и 100 монет Руслану.
insert into public.user_achievements (user_id, achievement_key, unlocked_at)
values ('77c8ade9-7df4-4f81-a32c-61153d9a859e', 'allwaters', '2026-11-03 21:05:36.579939+00');
update public.profiles set coins = coins + 100 where id = '77c8ade9-7df4-4f81-a32c-61153d9a859e';
insert into public.coin_transactions (user_id, amount, reason, label)
values ('77c8ade9-7df4-4f81-a32c-61153d9a859e', 100, 'achievement_reward', 'Обошёл всё побережье');
insert into public.notifications (user_id, kind, payload)
values ('77c8ade9-7df4-4f81-a32c-61153d9a859e', 'award_granted', jsonb_build_object('title', 'Обошёл всё побережье', 'subtitle', 'Достижение открыто', 'coins', 100));
