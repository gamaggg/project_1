-- Значок NEW горит 3 дня (25.11.2026). ЧЕРНОВИК, применять только после «применяй». После 04.
--
-- Владелец: «все NEW пропадают через 3 дня после того, как пользователь первый раз увидел». Было 7 дней от первого
-- захода после появления новинки. Отсчёт тот же (shop_novelty_seen.first_seen_at), у каждого игрока свой.
-- Новинки старше 90 дней по-прежнему не отмечаются.

create or replace function public.shop_new_items()
 returns text[]
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    return array[]::text[];
  end if;
  insert into public.shop_novelty_seen (user_id, novelty_id)
  select v_uid, n.id from public.shop_novelties n
   where n.added_at > now() - interval '90 days'
  on conflict do nothing;
  return array(
    select s.novelty_id from public.shop_novelty_seen s
     join public.shop_novelties n on n.id = s.novelty_id
     where s.user_id = v_uid and s.first_seen_at > now() - interval '3 days' and n.added_at > now() - interval '90 days'
     order by s.novelty_id
  );
end;
$function$;
revoke all on function public.shop_new_items() from public, anon;
grant execute on function public.shop_new_items() to authenticated;
