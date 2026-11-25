-- Откат 01 (24.11.2026): confirm_catch обратно — под щитом чужой улов броню не трогает. Обратные замены по тем же якорям.
do $rollback$
declare
  v_def text := pg_get_functiondef('public.confirm_catch(text,text,text,integer,numeric,text,text,timestamptz)'::regprocedure);
begin
  v_def := replace(v_def, $b$and not v_clan_mate and v_shield_until is not null and v_shield_until > now() and v_def_now = 0);$b$,
                          $a$and not v_clan_mate and v_shield_until is not null and v_shield_until > now());$a$);
  v_def := replace(v_def, $b$     and v_shield_until is not null and v_shield_until > now() and v_def_now = 0 then
    -- 24.11.2026: щит не даёт забрать сектор, но броню (defense) чужой улов под щитом снимает как обычно.
    -- Отказ — только когда брони уже нет.$b$,
                          $a$     and v_shield_until is not null and v_shield_until > now() then$a$);
  v_def := replace(v_def, $b$jsonb_build_object('defense', v_def_after)
        || case when v_shield_until > now() then jsonb_build_object('shield_until', v_shield_until) else '{}'::jsonb end);$b$,
                          $a$jsonb_build_object('defense', v_def_after));$a$);
  if position('v_def_now = 0' in v_def) > 0 or position('shield_until'', v_shield_until' in v_def) > 0 then
    raise exception 'confirm_catch rollback: leftovers of 01 remain';
  end if;
  execute v_def;
end $rollback$;
