-- Откат 02_backfill_shielded_diary_2.sql: три перенесённых улова убираются из catches вместе с
-- монетами, записями ленты и уведомлениями, три записи дневника возвращаются как были.
-- Награды и бонусы, которые вставка улова могла выдать сама, не отзываются.
do $rollback$
declare
  v_ids bigint[];
begin
  select array_agg(c.id) into v_ids from public.catches c
  where (c.user_id, c.caught_at) in (select user_id, caught_at from (values
    ('f7ffa327-7193-4081-81eb-0409c7463ab2'::uuid, '2026-11-04 19:00:54.576+00'::timestamptz),
    ('f7ffa327-7193-4081-81eb-0409c7463ab2'::uuid, '2026-11-04 19:15:48.523+00'::timestamptz),
    ('eb34bf9e-090f-4942-a7e7-85db5cd43048'::uuid, '2026-11-04 19:53:07.001+00'::timestamptz)
  ) as k(user_id, caught_at));

  update public.profiles p set coins = p.coins - x.total
  from (select ct.user_id, sum(ct.amount) total from public.coin_transactions ct where ct.catch_id = any(v_ids) group by 1) x
  where p.id = x.user_id;
  delete from public.coin_transactions where catch_id = any(v_ids);
  delete from public.notifications where catch_id = any(v_ids);
  delete from public.activity_log where catch_id = any(v_ids);
  delete from public.catches where id = any(v_ids);

  insert into public.diary_catches (id, user_id, day, caught_at, species, length_cm, weight_kg, photo_url, lat, lng, territory_id, created_at) values
  (56, 'f7ffa327-7193-4081-81eb-0409c7463ab2', '2026-11-04', '2026-11-04 19:00:54.576+00', 'morskoy_karas', null, null, 'https://yhgdcdkfkerzuhnzjzrz.supabase.co/storage/v1/object/public/catch-photos/f7ffa327-7193-4081-81eb-0409c7463ab2/diary/e544dfd5-2a48-4f61-baed-87e2d14aa664.jpg', 41.651261, 41.646875, 'B1173', '2026-11-04 19:01:38.024738+00'),
  (60, 'f7ffa327-7193-4081-81eb-0409c7463ab2', '2026-11-04', '2026-11-04 19:15:48.523+00', 'morskoy_karas', null, null, 'https://yhgdcdkfkerzuhnzjzrz.supabase.co/storage/v1/object/public/catch-photos/f7ffa327-7193-4081-81eb-0409c7463ab2/diary/abfff02a-9c6e-4e4d-b417-5f9c71d987f3.jpg', 41.651261, 41.646875, 'B1173', '2026-11-04 19:16:04.398546+00'),
  (63, 'eb34bf9e-090f-4942-a7e7-85db5cd43048', '2026-11-04', '2026-11-04 19:53:07.001+00', 'koreyskiy_okun', null, null, 'https://yhgdcdkfkerzuhnzjzrz.supabase.co/storage/v1/object/public/catch-photos/eb34bf9e-090f-4942-a7e7-85db5cd43048/diary/fb3bc4cb-869e-4f72-aeef-0a4933ad5ef7.jpg', 41.651261, 41.646875, 'B1173', '2026-11-04 19:53:11.980928+00')
  on conflict (id) do nothing;
end
$rollback$;
