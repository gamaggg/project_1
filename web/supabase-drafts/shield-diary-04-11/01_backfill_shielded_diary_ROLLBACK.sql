-- Откат 01_backfill_shielded_diary.sql: четыре перенесённых улова убираются из catches вместе с
-- монетами, записями ленты и уведомлениями, пять записей дневника возвращаются как были.
-- Не откатывается: награды и бонусы, которые вставка улова могла выдать (достижения, бонус
-- за первый улов, реферал) — триггеры catches их выдают и при откате не отзывают.
do $rollback$
declare
  v_ids bigint[];
begin
  select array_agg(c.id) into v_ids from public.catches c
  where (c.user_id, c.caught_at) in (select user_id, caught_at from (values
  ('eb34bf9e-090f-4942-a7e7-85db5cd43048'::uuid, '2026-11-04 19:04:09.699+00'::timestamptz),
  ('77c8ade9-7df4-4f81-a32c-61153d9a859e'::uuid, '2026-11-04 19:14:35.162+00'::timestamptz),
  ('eb34bf9e-090f-4942-a7e7-85db5cd43048'::uuid, '2026-11-04 19:28:58.887+00'::timestamptz),
  ('77c8ade9-7df4-4f81-a32c-61153d9a859e'::uuid, '2026-11-04 19:31:35.515+00'::timestamptz)
  ) as k(user_id, caught_at));

  update public.profiles p set coins = p.coins - x.total
  from (select ct.user_id, sum(ct.amount) total from public.coin_transactions ct where ct.catch_id = any(v_ids) group by 1) x
  where p.id = x.user_id;
  delete from public.coin_transactions where catch_id = any(v_ids);
  delete from public.notifications where catch_id = any(v_ids);
  delete from public.activity_log where catch_id = any(v_ids);
  delete from public.catches where id = any(v_ids);

  insert into public.diary_catches (id, user_id, day, caught_at, species, length_cm, weight_kg, photo_url, lat, lng, territory_id, created_at) values
  (57, 'eb34bf9e-090f-4942-a7e7-85db5cd43048', '2026-11-04', '2026-11-04 19:04:09.699+00', 'skorpena', null, null, 'https://yhgdcdkfkerzuhnzjzrz.supabase.co/storage/v1/object/public/catch-photos/eb34bf9e-090f-4942-a7e7-85db5cd43048/diary/ce63f6e7-335a-4f64-8b6f-8a1d582f5d39.jpg', 41.651261, 41.646875, 'B1173', '2026-11-04 19:04:27.402384+00'),
  (58, 'eb34bf9e-090f-4942-a7e7-85db5cd43048', '2026-11-04', '2026-11-04 19:04:09.699+00', 'skorpena', null, null, 'https://yhgdcdkfkerzuhnzjzrz.supabase.co/storage/v1/object/public/catch-photos/eb34bf9e-090f-4942-a7e7-85db5cd43048/diary/6e512189-e081-401f-91f9-1436a5dc267a.jpg', 41.651261, 41.646875, 'B1173', '2026-11-04 19:04:27.402349+00'),
  (59, '77c8ade9-7df4-4f81-a32c-61153d9a859e', '2026-11-04', '2026-11-04 19:14:35.162+00', 'stavrida', null, null, 'https://yhgdcdkfkerzuhnzjzrz.supabase.co/storage/v1/object/public/catch-photos/77c8ade9-7df4-4f81-a32c-61153d9a859e/diary/fabf1e30-8a2d-436d-8a91-eee5cfa63e1e.jpg', 41.651261, 41.646875, 'B1173', '2026-11-04 19:14:42.466631+00'),
  (61, 'eb34bf9e-090f-4942-a7e7-85db5cd43048', '2026-11-04', '2026-11-04 19:28:58.887+00', 'koreyskiy_okun', null, null, 'https://yhgdcdkfkerzuhnzjzrz.supabase.co/storage/v1/object/public/catch-photos/eb34bf9e-090f-4942-a7e7-85db5cd43048/diary/928c82e6-cc4a-4349-ba90-2d6a65d3a518.jpg', 41.651261, 41.646875, 'B1173', '2026-11-04 19:29:10.750223+00'),
  (62, '77c8ade9-7df4-4f81-a32c-61153d9a859e', '2026-11-04', '2026-11-04 19:31:35.515+00', 'stavrida', null, null, 'https://yhgdcdkfkerzuhnzjzrz.supabase.co/storage/v1/object/public/catch-photos/77c8ade9-7df4-4f81-a32c-61153d9a859e/diary/54d1b6f0-fd1e-4f0d-b6cb-4347f8c9ec01.jpg', 41.651261, 41.646875, 'B1173', '2026-11-04 19:31:42.83978+00')
  on conflict (id) do nothing;
end
$rollback$;
