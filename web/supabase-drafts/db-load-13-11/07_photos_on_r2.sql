-- Перенос фото в Cloudflare R2 (13.11.2026, docs/50 Эксплуатация/Перенос фото в Cloudflare R2.md): база принимает
-- фото с нового адреса и считает загрузки туда. Сам переезд (файлы, адреса в базе, переключатель в приложении) —
-- отдельно, после. Применять можно заранее: со старым адресом всё работает как раньше.
--
-- 1) photo_uploads — журнал загрузок в R2 (пишет только сервер, /api/photos/upload и /api/photos/copy-to-diary):
--    в R2 нет storage.objects, а по нему считались лимит загрузок и проверка на накрутки.
-- 2) photo_upload_allowed(игрок) — тот же лимит, что _may_upload_photo для корзины catch-photos: не замороженный,
--    меньше 40 фото за час и 120 за сутки (Supabase + R2 вместе), админам без лимита. Только для service_role.
-- 3) confirm_catch: фото улова — из своей папки в Supabase ИЛИ https://photos.catchrange.com/catch-photos/<игрок>/.
--    Меняется одна строка проверки (PHOTO_URL_INVALID); функция пересоздаётся из своего же pg_get_functiondef,
--    поэтому значения по умолчанию и права остаются. Если строка не найдена ровно один раз — отказ.
-- 4) abuse_scan: «30+ фото за час» считает и загрузки в R2. Та же замена с проверкой.
-- 5) diary_catches_photo_own: фото дневника — из <игрок>/diary/ в Supabase или в R2.
-- Откат: 07_photos_on_r2_ROLLBACK.sql. Прогон: тест пути улова (web/tests/sql/catch-path.sql, шаг 11 — адрес R2).

set local lock_timeout = '3s';

create table public.photo_uploads (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('catch', 'diary', 'avatar', 'announcement')),
  key text not null,
  bytes integer not null,
  created_at timestamptz not null default now()
);
create index photo_uploads_user_time_idx on public.photo_uploads (user_id, created_at);
alter table public.photo_uploads enable row level security;
revoke all on public.photo_uploads from public, anon, authenticated;
grant all on public.photo_uploads to service_role;

create function public.photo_upload_allowed(p_user uuid) returns boolean
language sql stable security definer set search_path = public
as $f$
  select coalesce((
    select p.is_admin or p.is_super_admin or (
      (p.frozen_until is null or p.frozen_until <= now())
      and (select count(*) from storage.objects o where o.owner = p.id and o.bucket_id = 'catch-photos' and o.created_at > now() - interval '1 hour')
        + (select count(*) from public.photo_uploads u where u.user_id = p.id and u.created_at > now() - interval '1 hour') < 40
      and (select count(*) from storage.objects o where o.owner = p.id and o.bucket_id = 'catch-photos' and o.created_at > now() - interval '24 hours')
        + (select count(*) from public.photo_uploads u where u.user_id = p.id and u.created_at > now() - interval '24 hours') < 120)
    from public.profiles p where p.id = p_user), false);
$f$;
revoke all on function public.photo_upload_allowed(uuid) from public, anon, authenticated;
grant execute on function public.photo_upload_allowed(uuid) to service_role;

do $m$
declare
  d text;
  old_check constant text := $o$p_photo_url not like 'https://yhgdcdkfkerzuhnzjzrz.supabase.co/storage/v1/object/public/catch-photos/' || v_uid::text || '/%' then raise exception 'PHOTO_URL_INVALID'$o$;
  new_check constant text := $n$(p_photo_url not like 'https://yhgdcdkfkerzuhnzjzrz.supabase.co/storage/v1/object/public/catch-photos/' || v_uid::text || '/%' and p_photo_url not like 'https://photos.catchrange.com/catch-photos/' || v_uid::text || '/%') then raise exception 'PHOTO_URL_INVALID'$n$;
  old_scan constant text := $o$    from storage.objects o
    join public.profiles p on p.id = o.owner
    where o.bucket_id = 'catch-photos' and o.created_at > now() - interval '1 hour'$o$;
  new_scan constant text := $n$    from (
      select owner, created_at from storage.objects where bucket_id = 'catch-photos'
      union all
      select user_id, created_at from public.photo_uploads where kind in ('catch', 'diary')
    ) o
    join public.profiles p on p.id = o.owner
    where o.created_at > now() - interval '1 hour'$n$;
begin
  d := pg_get_functiondef('public.confirm_catch(text,text,text,integer,numeric,text,text,timestamp with time zone)'::regprocedure);
  if (length(d) - length(replace(d, old_check, ''))) / length(old_check) <> 1 then
    raise exception 'confirm_catch: проверка адреса фото не та, что ожидалась — миграция не применена';
  end if;
  execute replace(d, old_check, new_check);

  d := pg_get_functiondef('public.abuse_scan()'::regprocedure);
  if (length(d) - length(replace(d, old_scan, ''))) / length(old_scan) <> 1 then
    raise exception 'abuse_scan: подсчёт загрузок не тот, что ожидался — миграция не применена';
  end if;
  execute replace(d, old_scan, new_scan);
end
$m$;

alter table public.diary_catches drop constraint diary_catches_photo_own;
alter table public.diary_catches add constraint diary_catches_photo_own check (
  photo_url like ('https://yhgdcdkfkerzuhnzjzrz.supabase.co/storage/v1/object/public/catch-photos/' || user_id::text || '/diary/%')
  or photo_url like ('https://photos.catchrange.com/catch-photos/' || user_id::text || '/diary/%')
);
