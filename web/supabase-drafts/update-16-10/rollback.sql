-- Rollback for owner_territory_color + edit_my_catch.
-- The new view column / co_holders key are additive and harmless: leave them.
drop function if exists public.edit_my_catch(bigint, integer, numeric, text, text);

-- 04_profile_language
drop function if exists public.set_my_language(text);
-- the profiles.language column is additive: leave it (drop column language to remove)

-- 05_more_challenges: undo the two patches, drop the helpers, remove the new challenges
-- (the ones some player already drew this week are kept: user_challenges points at them).
do $rb$
declare
  v_def text;
begin
  v_def := pg_get_functiondef('public.compute_challenge_progress'::regproc);
  v_def := replace(v_def, E'  else\n    v_result := public._challenge_progress_new(p_user_id, p_metric, p_params, p_week_start, p_week_end, p_city_prefix, p_timezone);\n  end if;', E'  end if;');
  execute v_def;
  v_def := pg_get_functiondef('public.sync_my_challenges'::regproc);
  v_def := replace(v_def, ' and public._challenge_eligible(v_uid, ch.metric)', '');
  execute v_def;
  v_def := replace(pg_get_functiondef('public.swap_challenge'::regproc), ' and public._challenge_eligible(v_uid, ch.metric)', '');
  execute v_def;
  v_def := replace(pg_get_functiondef('public.buy_extra_challenge'::regproc), 'public._challenge_eligible(v_uid, ch.metric) and ', '');
  execute v_def;
end
$rb$;
drop function if exists public._challenge_progress_new(uuid, text, jsonb, timestamptz, timestamptz, text, text);
drop function if exists public._challenge_eligible(uuid, text);
delete from public.challenges c
where c.id in ('boltun','azart','kaznachey','ezhednevnik','geograf','populyarnyy','razgovor','komandnyy_duh','pyaterka','tyazhelovec','krupnyak','goryachaya','flag','dusha_kompanii','svoi_lyudi','metkiy_glaz','golos_klana','desyatka','bez_vyhodnyh','professor','ekspansiya')
  and not exists (select 1 from public.user_challenges uc where uc.challenge_id = c.id);
