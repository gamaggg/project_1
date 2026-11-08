-- 10 · Снятие личной Казны и «Двойных монет» (решение владельца 06.11 и 08.11.2026). ЧЕРНОВИК, применять только после
-- «применяй». Не зависит от 01–09.
--
-- Скрытый запуск: пока новое видит только суперадмин, игроки играют по-старому, поэтому эта миграция ТОЛЬКО создаёт
-- функцию retire_personal_treasury() и ничего не закрывает. Её вызывают один раз отдельной командой в день, когда общак
-- включают всем (после «применяй» на этот шаг):
--   1. всё, что сейчас можно собрать в Казне каждого игрока (_treasury_state.available: накопленное за последние сутки,
--      не больше 30 в день — те же правила, что у кнопки «Собрать»), начисляется ему одной записью
--      («Казна секторов: последний сбор») — игрок ничего не теряет;
--   2. каждому, кому начислено, уведомление admin_gift с пояснением (видно в «Активности» и в Telegram);
--   3. collect_treasury закрывается (ошибка TREASURY:closed), get_treasury отдаёт closed = true и 0;
--   4. «Двойные монеты» больше не покупаются (activate_buff('double_coins') — ошибка BUFF:retired); уже купленные
--      дорабатывают свой срок (coin_multiplier не трогаем, как и confirm_catch).
-- Заранее (за день-два) владелец предупреждает игроков постом: «Управление» → «Написать пост» (появится в «Активности»).

create or replace function public.retire_personal_treasury()
returns jsonb language plpgsql security definer set search_path = public as $$
declare r record; v record; v_players int := 0; v_coins int := 0; v_def text;
begin
  if auth.uid() is not null and not exists (select 1 from public.profiles where id = auth.uid() and is_super_admin) then
    raise exception 'not allowed';
  end if;
  if position('TREASURY:closed' in pg_get_functiondef('public.collect_treasury()'::regprocedure)) > 0 then
    raise exception 'TREASURY:already_closed';
  end if;

  -- 1–2. Последний сбор за всех, у кого есть что собрать.
  for r in select distinct h.user_id from (select t.owner_id as user_id from public.territories t where t.owner_id is not null and not t.is_deleted
                                            union select s.user_id from public.territory_shares s) h loop
    select * into v from public._treasury_state(r.user_id);
    continue when coalesce(v.available, 0) <= 0;
    insert into public.treasury_collections (user_id, coins) values (r.user_id, v.available);
    update public.profiles set coins = coins + v.available where id = r.user_id;
    insert into public.coin_transactions (user_id, amount, reason, label) values (r.user_id, v.available, 'treasury', 'Казна секторов: последний сбор');
    insert into public.notifications (user_id, kind, payload)
    values (r.user_id, 'admin_gift', jsonb_build_object('coins', v.available, 'spins', 0,
            'note', 'Личная Казна закрыта: теперь сектора приносят монеты в общак клана. Всё накопленное — тебе на счёт.'));
    v_players := v_players + 1;
    v_coins := v_coins + v.available;
  end loop;

  -- 3. Казна закрыта.
  execute $f$
    create or replace function public.collect_treasury()
     returns jsonb language plpgsql security definer set search_path to 'public' as $body$
    begin
      raise exception 'TREASURY:closed';
    end;
    $body$;
  $f$;
  execute $f$
    create or replace function public.get_treasury()
     returns jsonb language sql stable security definer set search_path to 'public' as $body$
      select jsonb_build_object('available', 0, 'collected_today', 0, 'daily_cap', 0, 'per_day', 0, 'sectors', 0, 'closed', true);
    $body$;
  $f$;

  -- 4. «Двойные монеты» больше не продаются: вставка в начало activate_buff.
  v_def := pg_get_functiondef('public.activate_buff(text)'::regprocedure);
  if (length(v_def) - length(replace(v_def, $a$  if v_uid is null then raise exception 'not authenticated'; end if;$a$, ''))) / length($a$  if v_uid is null then raise exception 'not authenticated'; end if;$a$) <> 1 then
    raise exception 'activate_buff: anchor not found exactly once';
  end if;
  v_def := replace(v_def, $a$  if v_uid is null then raise exception 'not authenticated'; end if;$a$,
                   $b$  if v_uid is null then raise exception 'not authenticated'; end if;
  -- Личные «Двойные монеты» сняты вместе с Казной (клановый «Выход» вместо них).
  if p_buff_id = 'double_coins' then raise exception 'BUFF:retired'; end if;$b$);
  execute v_def;

  return jsonb_build_object('players', v_players, 'coins', v_coins);
end $$;
revoke all on function public.retire_personal_treasury() from public, anon, authenticated;
