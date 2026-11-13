-- Откат 07_photos_on_r2.sql: confirm_catch, abuse_scan и правило дневника — как были; журнал загрузок в R2 и
-- photo_upload_allowed убираются. Откатывать только пока приложение не грузит в R2 (переключатель выключен):
-- иначе фото с нового адреса снова начнут отклоняться.
set local lock_timeout = '3s';

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
  if (length(d) - length(replace(d, new_check, ''))) / length(new_check) <> 1 then
    raise exception 'confirm_catch: не та версия, что ставила 07 — откат не применён';
  end if;
  execute replace(d, new_check, old_check);

  d := pg_get_functiondef('public.abuse_scan()'::regprocedure);
  if (length(d) - length(replace(d, new_scan, ''))) / length(new_scan) <> 1 then
    raise exception 'abuse_scan: не та версия, что ставила 07 — откат не применён';
  end if;
  execute replace(d, new_scan, old_scan);
end
$m$;

alter table public.diary_catches drop constraint diary_catches_photo_own;
alter table public.diary_catches add constraint diary_catches_photo_own check (
  photo_url ~~ (('https://yhgdcdkfkerzuhnzjzrz.supabase.co/storage/v1/object/public/catch-photos/'::text || (user_id)::text) || '/diary/%'::text)
);

drop function public.photo_upload_allowed(uuid);
drop table public.photo_uploads;
