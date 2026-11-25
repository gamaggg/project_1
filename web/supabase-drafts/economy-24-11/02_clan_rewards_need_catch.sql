-- Э1 (24.11.2026). ЧЕРНОВИК, применять только после «применяй».
-- Монеты сундука недели и битвы кланов — только тем, кто за эту неделю поймал хотя бы одну рыбу. Очки и метры клана,
-- трофеи, опыт, медаль победителя и уведомление о битве — как раньше (в уведомлении coins = 0 и no_catch = true).
-- Без улова сундук не платит и уведомления о сундуке нет. Считается при подведении недели (понедельник 00:10 по городу),
-- то есть впервые — за неделю 23–29.11.
-- _settle_clan_week_at правится по якорям (каждый ровно один раз, иначе ошибка и ничего не меняется).
do $migration$
declare
  v_def text := pg_get_functiondef('public._settle_clan_week_at(text,timestamptz)'::regprocedure);
  a_decl constant text := $a$  v_share int;
begin$a$;
  a_mult constant text := $a$      v_mult := public.coin_multiplier(m.user_id);
$a$;
  a_chest constant text := $a$      if v_chest_coins > 0 and m.pts > 0 then$a$;
  a_race constant text := $a$        if v_race_coins > 0 then
          update public.profiles set coins = coins + v_race_coins * v_mult where id = m.user_id;
          insert into public.coin_transactions (user_id, amount, reason, label)
          values (m.user_id, v_race_coins * v_mult, 'clan_race', 'Битва кланов: ' || r.place || '-е место');
          v_race_pool := v_race_pool + v_race_coins;
        end if;
        perform public._clan_notify(m.user_id, 'clan_race_result', null, r.id,
          jsonb_build_object('place', r.place, 'finished', r.finished_at is not null, 'coins', v_race_coins * v_mult, 'trophies', v_trophies));$a$;
  a text;
begin
  foreach a in array array[a_decl, a_mult, a_chest, a_race] loop
    if (length(v_def) - length(replace(v_def, a, ''))) / length(a) <> 1 then
      raise exception '_settle_clan_week_at: anchor not found exactly once: %', left(a, 60);
    end if;
  end loop;

  v_def := replace(v_def, a_decl, $b$  v_share int;
  -- 24.11.2026 (Э1): поймал ли участник рыбу за неделю; его монеты битвы.
  v_caught boolean;
  v_member_race int;
begin$b$);

  v_def := replace(v_def, a_mult, a_mult || $b$      v_caught := exists (select 1 from public.catches c where c.user_id = m.user_id and c.caught_at >= v_ws and c.caught_at < v_ws + interval '7 days');
      v_member_race := case when v_caught then v_race_coins else 0 end;
$b$);

  v_def := replace(v_def, a_chest, $b$      if v_chest_coins > 0 and m.pts > 0 and v_caught then$b$);

  v_def := replace(v_def, a_race, $b$        if v_member_race > 0 then
          update public.profiles set coins = coins + v_member_race * v_mult where id = m.user_id;
          insert into public.coin_transactions (user_id, amount, reason, label)
          values (m.user_id, v_member_race * v_mult, 'clan_race', 'Битва кланов: ' || r.place || '-е место');
          v_race_pool := v_race_pool + v_member_race;
        end if;
        perform public._clan_notify(m.user_id, 'clan_race_result', null, r.id,
          jsonb_build_object('place', r.place, 'finished', r.finished_at is not null, 'coins', v_member_race * v_mult, 'trophies', v_trophies, 'no_catch', not v_caught));$b$);

  execute v_def;
end $migration$;
