
-- Пробный прогон 01 в откатываемой транзакции: правка + проверки, в конце raise — ничего не сохраняется.
do $dry$
begin
  -- 1. Сама правка (тот же текст, что в 01).
  declare
  v_def text := pg_get_functiondef('public.confirm_catch(text,text,text,integer,numeric,text,text,timestamptz)'::regprocedure);
  a_late constant text := $a$and not v_clan_mate and v_shield_until is not null and v_shield_until > now());$a$;
  a_raise constant text := $a$     and v_shield_until is not null and v_shield_until > now() then$a$;
  a_notif constant text := $a$values (v_prev_owner, 'sector_attacked', v_uid, p_territory_id, jsonb_build_object('defense', v_def_after));$a$;
  a text;
begin
  foreach a in array array[a_late, a_raise, a_notif] loop
    if (length(v_def) - length(replace(v_def, a, ''))) / length(a) <> 1 then
      raise exception 'confirm_catch: anchor not found exactly once: %', left(a, 60);
    end if;
  end loop;

  v_def := replace(v_def, a_late, $b$and not v_clan_mate and v_shield_until is not null and v_shield_until > now() and v_def_now = 0);$b$);

  v_def := replace(v_def, a_raise, $b$     and v_shield_until is not null and v_shield_until > now() and v_def_now = 0 then
    -- 24.11.2026: щит не даёт забрать сектор, но броню (defense) чужой улов под щитом снимает как обычно.
    -- Отказ — только когда брони уже нет.$b$);

  v_def := replace(v_def, a_notif, $b$values (v_prev_owner, 'sector_attacked', v_uid, p_territory_id, jsonb_build_object('defense', v_def_after)
        || case when v_shield_until > now() then jsonb_build_object('shield_until', v_shield_until) else '{}'::jsonb end);$b$);

  execute v_def;
  end;

  -- 2. Проверки.
  declare
    out text := '';
    v_sec text; v_owner uuid; v_out uuid; v_r record; v_t record; v_url text;
    v_err text;
  begin
    select p.id into v_out from public.profiles p
     where not exists (select 1 from public.clan_members cm where cm.user_id = p.id and cm.left_at is null)
       and not coalesce(p.is_blocked, false) and not coalesce(p.is_admin, false) and not coalesce(p.is_super_admin, false)
       and (p.frozen_until is null or p.frozen_until < now())
     order by p.id limit 1;
    select t.id, t.owner_id into v_sec, v_owner from public.territories t
     where not t.is_deleted and t.owner_id is not null and t.owner_id <> v_out
       and not exists (select 1 from public.clan_hq h where h.territory_id = t.id)
       and not exists (select 1 from public.hot_sectors hs where hs.territory_id = t.id and now() < hs.ends_at)
     order by t.id limit 1;
    out := 'sector=' || v_sec;
    update public.catches set caught_at = caught_at - interval '2 days' where user_id = v_out and caught_at > now() - interval '2 days';
    update public.territories set shield_until = now() + interval '5 hours', defense = 2, defense_at = now() where id = v_sec;
    perform set_config('request.jwt.claims', json_build_object('sub', v_out, 'role', 'authenticated')::text, true);
    v_url := 'https://yhgdcdkfkerzuhnzjzrz.supabase.co/storage/v1/object/public/catch-photos/' || v_out::text || '/dry-run.jpg';

    -- a) щит + броня 2: атака
    select * into v_r from public.confirm_catch(v_sec, 'stavrida', v_url);
    select owner_id, defense, shield_until into v_t from public.territories where id = v_sec;
    out := out || E'\na shield+2: attacked=' || v_r.attacked || ' late=' || v_r.late || ' defense=' || v_r.defense
         || ' owner kept=' || (v_t.owner_id = v_owner) || ' shield kept=' || (v_t.shield_until > now())
         || ' notif payload=' || coalesce((select payload::text from public.notifications where user_id = v_owner and kind = 'sector_attacked' and territory_id = v_sec order by id desc limit 1), 'none');

    -- b) щит + броня 1: атака до 0
    update public.catches set caught_at = caught_at - interval '10 minutes' where user_id = v_out and caught_at > now() - interval '1 hour';
    select * into v_r from public.confirm_catch(v_sec, 'stavrida', v_url);
    select owner_id, defense, shield_until into v_t from public.territories where id = v_sec;
    out := out || E'\nb shield+1: attacked=' || v_r.attacked || ' defense=' || v_r.defense || ' owner kept=' || (v_t.owner_id = v_owner);

    -- c) щит + броня 0: отказ SHIELDED
    update public.catches set caught_at = caught_at - interval '10 minutes' where user_id = v_out and caught_at > now() - interval '1 hour';
    begin
      select * into v_r from public.confirm_catch(v_sec, 'stavrida', v_url);
      out := out || E'\nc shield+0: NO ERROR (bad)';
    exception when others then out := out || E'\nc shield+0: ' || sqlerrm; end;

    -- d) щит + броня 0, «Добавить в дневник» (момент снимка): опоздавший, сектор не трогаем
    select * into v_r from public.confirm_catch(v_sec, 'stavrida', v_url, null, null, null, null, now() - interval '1 minute');
    select owner_id, defense into v_t from public.territories where id = v_sec;
    out := out || E'\nd diary at 0: late=' || v_r.late || ' attacked=' || v_r.attacked || ' defense=' || v_t.defense || ' owner kept=' || (v_t.owner_id = v_owner);

    -- e) щит + броня 2, улов с моментом снимка (офлайн): атака
    update public.territories set defense = 2, defense_at = now() where id = v_sec;
    update public.catches set caught_at = caught_at - interval '10 minutes' where user_id = v_out and caught_at > now() - interval '1 hour';
    update public.catches set caught_at = caught_at - interval '10 minutes' where territory_id = v_sec and caught_at > now() - interval '1 hour';
    select * into v_r from public.confirm_catch(v_sec, 'stavrida', v_url, null, null, null, null, now() - interval '1 minute');
    select defense into v_t from public.territories where id = v_sec;
    out := out || E'\ne offline shield+2: late=' || v_r.late || ' attacked=' || v_r.attacked || ' defense=' || v_t.defense;

    -- f) без щита, броня 0: захват как раньше
    update public.territories set shield_until = null, defense = 0, defense_at = now() where id = v_sec;
    update public.catches set caught_at = caught_at - interval '10 minutes' where user_id = v_out and caught_at > now() - interval '1 hour';
    update public.catches set caught_at = caught_at - interval '10 minutes' where territory_id = v_sec and caught_at > now() - interval '1 hour';
    select * into v_r from public.confirm_catch(v_sec, 'stavrida', v_url);
    select owner_id, defense into v_t from public.territories where id = v_sec;
    out := out || E'\nf no shield, 0: attacked=' || v_r.attacked || ' captured=' || (v_t.owner_id = v_out) || ' defense=' || v_t.defense;

    -- g) владелец ловит на своём секторе под своим щитом: +1
    update public.territories set owner_id = v_owner, shield_until = now() + interval '5 hours', defense = 1, defense_at = now() where id = v_sec;
    update public.catches set caught_at = caught_at - interval '1 day' where user_id = v_owner and caught_at > now() - interval '1 day';
    perform set_config('request.jwt.claims', json_build_object('sub', v_owner, 'role', 'authenticated')::text, true);
    begin
      select * into v_r from public.confirm_catch(v_sec, 'stavrida', 'https://yhgdcdkfkerzuhnzjzrz.supabase.co/storage/v1/object/public/catch-photos/' || v_owner::text || '/dry-run.jpg');
      select defense, shield_until into v_t from public.territories where id = v_sec;
      out := out || E'\ng owner under own shield: defense=' || v_t.defense || ' shield kept=' || (v_t.shield_until > now());
    exception when others then out := out || E'\ng owner ERR ' || sqlerrm; end;

    -- h) DEFAULT у параметров на месте
    out := out || E'\nh defaults: ' || pg_get_function_arguments('public.confirm_catch(text,text,text,integer,numeric,text,text,timestamptz)'::regprocedure);
    raise exception 'DRYRUN RESULT: %', out;
  end;
end $dry$;
