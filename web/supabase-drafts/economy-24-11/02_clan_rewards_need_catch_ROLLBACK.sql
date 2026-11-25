-- Откат 02 (24.11.2026): сундук и битва снова платят без условия улова. Обратные замены по тем же якорям.
do $rollback$
declare
  v_def text := pg_get_functiondef('public._settle_clan_week_at(text,timestamptz)'::regprocedure);
begin
  v_def := replace(v_def, $b$  v_share int;
  -- 24.11.2026 (Э1): поймал ли участник рыбу за неделю; его монеты битвы.
  v_caught boolean;
  v_member_race int;
begin$b$, $a$  v_share int;
begin$a$);
  v_def := replace(v_def, $b$      v_caught := exists (select 1 from public.catches c where c.user_id = m.user_id and c.caught_at >= v_ws and c.caught_at < v_ws + interval '7 days');
      v_member_race := case when v_caught then v_race_coins else 0 end;
$b$, '');
  v_def := replace(v_def, $b$      if v_chest_coins > 0 and m.pts > 0 and v_caught then$b$, $a$      if v_chest_coins > 0 and m.pts > 0 then$a$);
  v_def := replace(v_def, $b$        if v_member_race > 0 then
          update public.profiles set coins = coins + v_member_race * v_mult where id = m.user_id;
          insert into public.coin_transactions (user_id, amount, reason, label)
          values (m.user_id, v_member_race * v_mult, 'clan_race', 'Битва кланов: ' || r.place || '-е место');
          v_race_pool := v_race_pool + v_member_race;
        end if;
        perform public._clan_notify(m.user_id, 'clan_race_result', null, r.id,
          jsonb_build_object('place', r.place, 'finished', r.finished_at is not null, 'coins', v_member_race * v_mult, 'trophies', v_trophies, 'no_catch', not v_caught));$b$,
    $a$        if v_race_coins > 0 then
          update public.profiles set coins = coins + v_race_coins * v_mult where id = m.user_id;
          insert into public.coin_transactions (user_id, amount, reason, label)
          values (m.user_id, v_race_coins * v_mult, 'clan_race', 'Битва кланов: ' || r.place || '-е место');
          v_race_pool := v_race_pool + v_race_coins;
        end if;
        perform public._clan_notify(m.user_id, 'clan_race_result', null, r.id,
          jsonb_build_object('place', r.place, 'finished', r.finished_at is not null, 'coins', v_race_coins * v_mult, 'trophies', v_trophies));$a$);
  if position('v_caught' in v_def) > 0 or position('v_member_race' in v_def) > 0 then
    raise exception '_settle_clan_week_at rollback: leftovers of 02 remain';
  end if;
  execute v_def;
end $rollback$;
