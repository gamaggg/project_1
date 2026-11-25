-- Щит не даёт забрать сектор, но броню чужой улов снимает (24.11.2026). ЧЕРНОВИК, применять только после «применяй».
--
-- Было: пока на чужом секторе стоит щит (из слотов или Прилив), живой улов отказ SHIELDED, улов с моментом
--       снимка (офлайн, «Добавить в дневник») — «опоздавший», броня (territories.defense) не трогается.
-- Стало: при броне > 0 чужой улов под щитом — обычная атака: броня −1, уведомление владельцу, сектор не переходит.
--        Когда брони нет (0), всё как раньше: SHIELDED / «опоздавший», сектор под щитом не забрать.
--        В уведомление sector_attacked под щитом добавляется shield_until — бот пишет «сектор заберут после щита».
--
-- confirm_catch правится по якорям (каждый ровно один раз, иначе ошибка и ничего не меняется).
-- CREATE OR REPLACE из pg_get_functiondef сохраняет DEFAULT у параметров и права (сигнатура та же).
do $migration$
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
end $migration$;
