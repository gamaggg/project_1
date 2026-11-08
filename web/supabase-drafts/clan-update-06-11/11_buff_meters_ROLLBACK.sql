-- Откат 11 (09.11.2026): _clan_week_events — обратно к 10 и 30/50 метрам, вспомогательную функцию убрать.
do $rollback$
declare v_def text := pg_get_functiondef('public._clan_week_events(bigint,timestamptz)'::regprocedure);
begin
  v_def := replace(v_def, $b$case when public._clan_buff_on_at(clan.id, k.user_id, k.caught_at) then 15 else 10 end, 1$b$, $a$10, 1$a$);
  v_def := replace(v_def, $b$ then 50 else 30 end * (case when public._clan_buff_on_at(clan.id, al.user_id, al.created_at) then 3 else 2 end) / 2,$b$, $a$ then 50 else 30 end,$a$);
  if position('_clan_buff_on_at' in v_def) > 0 then raise exception '_clan_week_events rollback: leftovers of 11 remain'; end if;
  execute v_def;
end
$rollback$;
drop function if exists public._clan_buff_on_at(bigint, uuid, timestamptz);
