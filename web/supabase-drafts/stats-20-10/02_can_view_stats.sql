-- Доступ к «Статистике» по переключателю: админ с флагом can_view_stats видит экран и данные, как супер-админ.
-- Тот же путь, что у can_review_panoramas: колонка в profiles, маскированный флаг во view (виден только владельцу),
-- admin_set_admin / get_admin_permissions с новым полем, проверка в get_app_stats_range.
-- Откат: 02_can_view_stats_ROLLBACK.sql.

alter table public.profiles add column can_view_stats boolean not null default false;

-- Представление: тот же текст, что был, плюс can_view_stats в конце (CREATE OR REPLACE сохраняет права).
create or replace view public.profiles_with_stats as
 SELECT p.id,
    p.display_name,
    p.location,
    p.avatar_url,
    p.created_at,
    ( SELECT count(*) AS count
           FROM follows f
          WHERE f.followee_id = p.id) AS followers_count,
    ( SELECT count(*) AS count
           FROM follows f
          WHERE f.follower_id = p.id) AS following_count,
    p.bio,
    p.is_admin,
    p.is_blocked,
    p.public_id,
    p.is_super_admin,
        CASE
            WHEN p.id = auth.uid() THEN p.birth_date
            ELSE NULL::date
        END AS birth_date,
        CASE
            WHEN p.id = auth.uid() THEN p.gender
            ELSE NULL::text
        END AS gender,
        CASE
            WHEN p.id = auth.uid() THEN p.height_cm
            ELSE NULL::smallint
        END AS height_cm,
        CASE
            WHEN p.id = auth.uid() THEN p.weight_kg
            ELSE NULL::numeric
        END AS weight_kg,
    p.territory_color,
    p.onboarding_completed,
    ( SELECT count(*) AS count
           FROM catches c
          WHERE c.user_id = p.id) AS catches_count,
    ( SELECT count(*) AS count
           FROM territories t
          WHERE t.owner_id = p.id OR NOT COALESCE(t.is_deleted, false) AND (EXISTS ( SELECT 1
                   FROM territory_shares s
                  WHERE s.territory_id = t.id AND s.user_id = p.id))) AS territories_count,
        CASE
            WHEN p.id = auth.uid() THEN p.can_moderate_reports
            ELSE NULL::boolean
        END AS can_moderate_reports,
        CASE
            WHEN p.id = auth.uid() THEN p.can_block_users
            ELSE NULL::boolean
        END AS can_block_users,
        CASE
            WHEN p.id = auth.uid() THEN p.can_add_catch_manually
            ELSE NULL::boolean
        END AS can_add_catch_manually,
        CASE
            WHEN p.id = auth.uid() THEN p.can_view_all_users
            ELSE NULL::boolean
        END AS can_view_all_users,
    p.city,
    p.hero_bg,
    p.equipped_frame,
        CASE
            WHEN p.id = auth.uid() OR (EXISTS ( SELECT 1
               FROM profiles me
              WHERE me.id = auth.uid() AND me.is_super_admin)) THEN p.coins
            ELSE NULL::integer
        END AS coins,
    p.equipped_name_style,
    p.equipped_skin,
        CASE
            WHEN p.id = auth.uid() THEN p.can_add_catch_from_gallery
            ELSE NULL::boolean
        END AS can_add_catch_from_gallery,
    cm.clan_id,
    cl.name AS clan_name,
    cl.crest AS clan_crest,
    cm.role AS clan_role,
        CASE
            WHEN p.id = auth.uid() THEN p.can_review_panoramas
            ELSE NULL::boolean
        END AS can_review_panoramas,
        CASE
            WHEN p.id = auth.uid() THEN p.can_view_stats
            ELSE NULL::boolean
        END AS can_view_stats
   FROM profiles p
     LEFT JOIN clan_members cm ON cm.user_id = p.id AND cm.left_at IS NULL AND cm.city = COALESCE(p.city, 'batumi'::text)
     LEFT JOIN clans cl ON cl.id = cm.clan_id;

-- Выдача прав: новый параметр в конце, по умолчанию false (как у остальных).
drop function public.admin_set_admin(uuid, boolean, boolean, boolean, boolean, boolean, boolean, boolean);
create function public.admin_set_admin(
  p_user_id uuid,
  p_is_admin boolean,
  p_can_moderate_reports boolean default false,
  p_can_block_users boolean default false,
  p_can_add_catch_manually boolean default false,
  p_can_view_all_users boolean default false,
  p_can_add_catch_from_gallery boolean default false,
  p_can_review_panoramas boolean default false,
  p_can_view_stats boolean default false
)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_target_name text;
  v_perms text := '';
  v_moderate boolean := p_is_admin and p_can_moderate_reports;
  v_block boolean := p_is_admin and p_can_block_users;
  v_catch boolean := p_is_admin and p_can_add_catch_manually;
  v_users boolean := p_is_admin and p_can_view_all_users;
  v_gallery boolean := p_is_admin and p_can_add_catch_from_gallery;
  v_panoramas boolean := p_is_admin and p_can_review_panoramas;
  v_stats boolean := p_is_admin and p_can_view_stats;
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and is_super_admin) then
    raise exception 'not authorized';
  end if;
  if p_user_id = auth.uid() then raise exception 'cannot change your own admin status'; end if;
  if exists (select 1 from public.profiles where id = p_user_id and is_super_admin) then
    raise exception 'cannot change another super admin';
  end if;
  select display_name into v_target_name from public.profiles where id = p_user_id;
  if not found then raise exception 'user not found'; end if;

  update public.profiles set
    is_admin = p_is_admin,
    can_moderate_reports = v_moderate,
    can_block_users = v_block,
    can_add_catch_manually = v_catch,
    can_view_all_users = v_users,
    can_add_catch_from_gallery = v_gallery,
    can_review_panoramas = v_panoramas,
    can_view_stats = v_stats
  where id = p_user_id;

  if v_moderate then v_perms := v_perms || 'жалобы, '; end if;
  if v_block then v_perms := v_perms || 'блокировка, '; end if;
  if v_catch then v_perms := v_perms || 'улов без гео, '; end if;
  if v_users then v_perms := v_perms || 'список юзеров, '; end if;
  if v_gallery then v_perms := v_perms || 'улов из галереи, '; end if;
  if v_panoramas then v_perms := v_perms || 'панорамы, '; end if;
  if v_stats then v_perms := v_perms || 'статистика, '; end if;
  v_perms := rtrim(v_perms, ', ');

  insert into public.admin_actions (admin_id, action, target_user_id, details)
  values (
    auth.uid(),
    case when p_is_admin then 'grant_admin' else 'revoke_admin' end,
    p_user_id,
    case
      when not p_is_admin then 'Забрал права админа у: ' || v_target_name
      when v_perms = '' then 'Выдал права админа: ' || v_target_name || ' (без доп. прав)'
      else 'Выдал права админа: ' || v_target_name || ' (' || v_perms || ')'
    end
  );
end; $function$;
revoke all on function public.admin_set_admin(uuid, boolean, boolean, boolean, boolean, boolean, boolean, boolean, boolean) from public, anon;
grant execute on function public.admin_set_admin(uuid, boolean, boolean, boolean, boolean, boolean, boolean, boolean, boolean) to authenticated, service_role;

-- Настоящие (не замаскированные) права админа для окна «Права»: новое поле в конце.
drop function public.get_admin_permissions(uuid);
create function public.get_admin_permissions(p_user_id uuid)
 returns table(is_admin boolean, can_moderate_reports boolean, can_block_users boolean, can_add_catch_manually boolean, can_view_all_users boolean, can_add_catch_from_gallery boolean, can_review_panoramas boolean, can_view_stats boolean)
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and is_super_admin) then
    raise exception 'not authorized';
  end if;
  return query
    select p.is_admin, p.can_moderate_reports, p.can_block_users, p.can_add_catch_manually, p.can_view_all_users, p.can_add_catch_from_gallery, p.can_review_panoramas, p.can_view_stats
    from public.profiles p
    where p.id = p_user_id;
end; $function$;
revoke all on function public.get_admin_permissions(uuid) from public, anon;
grant execute on function public.get_admin_permissions(uuid) to authenticated, service_role;

-- Статистика: супер-админ или админ с переключателем (is_admin обязателен: забрали права админа — флаг не действует).
do $do$
declare
  v_old text := pg_get_functiondef('public.get_app_stats_range(timestamptz, timestamptz, text, text)'::regprocedure);
  v_new text;
begin
  v_new := replace(v_old,
    'where p.id = auth.uid() and p.is_super_admin)',
    'where p.id = auth.uid() and (p.is_super_admin or (p.is_admin and p.can_view_stats)))');
  if v_new = v_old then raise exception 'get_app_stats_range: проверка доступа не найдена'; end if;
  execute v_new;
end
$do$;
