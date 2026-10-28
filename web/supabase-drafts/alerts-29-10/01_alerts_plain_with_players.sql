-- Тревоги из приложения: понятным языком и с указанием, кого задело.
-- (1) _alert_area / _alert_meaning: человеческие названия для geolocation, camera, webview_killed, auth_lost, JWT, погоды,
--     отказов игрока (геолокация code 1, камера NotAllowedError): «Ломается: определение места игрока», «Что случилось: игрок запретил…».
-- (2) _alert_players / _alert_who_text: до трёх игроков с ошибкой за окно (имя, публичный ID, город, привязан ли Telegram, сколько раз).
-- (3) _system_alert(text, text, jsonb): то же, что _system_alert(text, text), плюс данные в payload (players), чтобы бот приложил
--     кнопки «Написать: имя» (tg://user?id=…). Двухаргументная версия остаётся как была. Закрыта от anon/authenticated (внутренняя).
-- (4) system_health_tick: ошибки приложения идут через новые функции. Остальные ветки (cron, Telegram, контракт RPC) без изменений.
-- Откат: 01_alerts_plain_with_players_ROLLBACK.sql.

create or replace function public._alert_area(p_context text)
returns text
language sql
immutable
as $function$
  select case
    when p_context = 'confirm_catch' then 'сохранение улова'
    when p_context = 'photo_upload' then 'загрузка фото улова'
    when p_context = 'diary_from_shield' then 'сохранение улова в дневник (сектор под щитом)'
    when p_context = 'js' then 'приложение у игрока (ошибка в коде)'
    when p_context = 'storage' then 'хранилище фото'
    when p_context = 'geolocation' then 'определение места игрока (геолокация)'
    when p_context = 'camera' then 'камера в приложении'
    when p_context = 'webview_killed' then 'приложение внезапно закрывается или перезагружается у игрока'
    when p_context = 'auth_lost' then 'вход в аккаунт (сессия пропала)'
    when p_context like 'db:%' then coalesce((select v.label from (values
        ('confirm_catch', 'сохранение улова'), ('spin_slots', 'слоты'), ('get_slot_state', 'слоты'),
        ('activate_buff', 'покупка бафа'), ('buy_shop_item', 'покупка в магазине'), ('equip_shop_item', 'вещи из магазина'),
        ('use_free_shield', 'установка щита'), ('buy_extra_challenge', 'покупка челленджа'), ('swap_challenge', 'замена челленджа'),
        ('sync_my_challenges', 'челленджи недели'), ('log_challenge_event', 'челленджи недели'),
        ('claim_daily_reward', 'ежедневная награда'), ('get_daily_reward_state', 'ежедневная награда'),
        ('collect_treasury', 'Казна'), ('get_treasury', 'Казна'), ('claim_first_steps', '«Первые шаги»'), ('get_first_steps', '«Первые шаги»'),
        ('get_clan_race', 'Битва кланов'), ('get_clan_chest', 'сундук клана'), ('get_clan', 'экран клана'),
        ('list_clans', 'список кланов'), ('create_clan', 'создание клана'), ('join_clan', 'вступление в клан'),
        ('leave_clan', 'выход из клана'), ('update_clan', 'настройки клана'), ('get_clan_chat', 'чат клана'),
        ('post_clan_message', 'чат клана'), ('get_catch_comments', 'комментарии'), ('post_comment', 'комментарии'),
        ('get_city_feed', 'лента активности'), ('get_weekly_leaderboard', 'рейтинг недели'),
        ('get_city_week_recap', '«Неделя в городе»'), ('get_sector_insights', 'экран сектора'),
        ('sync_my_achievements', 'достижения'), ('mark_notifications_read', 'уведомления'),
        ('create_support_ticket', 'поддержка'), ('add_support_message', 'поддержка'), ('claim_referral', 'приглашения друзей'),
        ('set_telegram_notifications', 'настройка уведомлений в Telegram'),
        ('territories_with_stats', 'карта секторов'), ('profiles_with_stats', 'профили'), ('catches', 'уловы'),
        ('diary_catches', 'дневник'), ('diary_days', 'дневник'), ('notifications', 'уведомления'),
        ('catch_likes', 'лайки'), ('follows', 'подписки'), ('profiles', 'профиль'), ('user_inventory', 'вещи из магазина'),
        ('user_ui_state', 'отметки «уже видел»'), ('active_buffs', 'бафы'), ('shop_items', 'магазин'), ('species', 'список рыб')
      ) v(name, label) where v.name = substr(p_context, 4)), 'запрос к базе «' || substr(p_context, 4) || '»')
    when p_context like 'api:%' then coalesce((select v.label from (values
        ('telegram/send-notifications', 'отправка уведомлений в Telegram'), ('telegram/send-broadcasts', 'рассылка объявлений в Telegram'),
        ('telegram/send-followups', 'подсказки в Telegram после /start'), ('telegram/send-onboarding', 'приветственные сообщения в Telegram'),
        ('telegram/fishing', '«Ещё на рыбалке?» в Telegram'), ('telegram/forecast-alert', 'рассылка «Завтра хороший клёв»'),
        ('telegram/webhook', 'бот Telegram (команды и ответы поддержки)'), ('telegram/link-token', 'подключение Telegram в профиле'),
        ('auth/telegram', 'вход через Telegram'), ('auth/telegram/link', 'привязка Telegram к аккаунту'),
        ('auth/complete-email-link', 'смена почты'), ('recognize-fish', 'распознавание рыбы по фото'),
        ('catch-conditions', 'погода во время улова'), ('support/notify', 'пересылка обращений в поддержку')
      ) v(name, label) where v.name = substr(p_context, 5)), 'сервер: ' || substr(p_context, 5))
    when p_context like 'cron:%' then 'фоновая задача: ' || case
        when p_context ~ '^cron:pick-hot' then 'выбор горячих секторов'
        when p_context ~ '^cron:announce-hot' then 'объявление горячих секторов'
        when p_context = 'cron:settle-hot-sectors' then 'итоги горячих секторов'
        when p_context ~ '^cron:clan-week-settle' then 'итоги недели кланов (сундуки, Битва кланов)'
        when p_context = 'cron:clan-race-tick' then 'Битва кланов'
        when p_context ~ '^cron:grant-weekly-rank-awards' then 'награды недели'
        when p_context ~ '^cron:grant-catch-of-month' then '«Улов месяца»'
        when p_context ~ '^cron:refresh-sector-legends' then 'легенды секторов'
        when p_context = 'cron:remind-daily-rewards' then 'напоминание о ежедневной награде'
        when p_context ~ '^cron:challenge-deadline' then 'напоминание о челленджах'
        when p_context ~ '^cron:forecast-alert' then '«Завтра хороший клёв»'
        when p_context ~ '^cron:telegram' then 'отправка в Telegram'
        else substr(p_context, 6)
      end
    when p_context = 'telegram_backlog' or p_context = 'telegram_failed' then 'отправка сообщений в Telegram'
    else p_context
  end
$function$;

create or replace function public._alert_meaning(p_message text)
returns text
language sql
immutable
as $function$
  select case
    -- Отказы и сбои телефона игрока (не наша поломка, но полезно знать)
    when p_message ~ '^code 1: ' then 'игрок запретил приложению определять место (в настройках телефона или Telegram). Это не поломка: в приложении ему покажется подсказка, как включить'
    when p_message ~ '^code 2: ' then 'телефон не смог определить место (нет сигнала GPS или выключены службы геолокации)'
    when p_message ~ '^code 3: ' then 'определение места заняло слишком долго (слабый сигнал)'
    when p_message ~ '^NotAllowedError' then 'игрок запретил приложению пользоваться камерой (в настройках телефона). Это не поломка'
    when p_message ~ '^NotFoundError' then 'на телефоне не нашлась камера'
    when p_message ~ '^NotReadableError' then 'камера занята другим приложением или не включается'
    when p_message ~ '^страница сброшена' then 'приложение внезапно перезагрузилось у игрока (чаще всего телефону не хватило памяти)'
    when p_message ~ '^сессия пропала' then 'игрока выкинуло из аккаунта: сессия пропала после входа'
    -- Ответы нашей базы
    when p_message ~ '^23514' then 'база отклонила запись — не прошла проверку ' || coalesce(
        case substring(p_message from 'constraint "([^"]+)"')
          when 'diary_catches_photo_own' then '(фото должно лежать в папке дневника)'
          else '«' || substring(p_message from 'constraint "([^"]+)"') || '»'
        end, '')
    when p_message ~ '^23502' then 'база отклонила запись — не заполнено обязательное поле'
    when p_message ~ '^23503' then 'запись ссылается на то, чего в базе нет'
    when p_message ~ '^(42501|PGRST301)' or p_message ~* 'row-level security|permission denied' then 'нет прав — правила доступа базы не пускают'
    when p_message ~ '^(42883|PGRST202)' or p_message ~* 'could not find the function|function .* does not exist' then 'приложение вызывает функцию базы, которой нет'
    when p_message ~ '^(42P01|PGRST205)' or p_message ~* 'could not find the table|relation .* does not exist' then 'в базе нет нужной таблицы'
    when p_message ~ '^(42703|PGRST204)' or p_message ~* 'column .* does not exist|could not find the .* column' then 'в базе нет нужного поля'
    when p_message ~* 'Gateway Timeout' then 'внешний сервис слишком долго не отвечал'
    when p_message ~ '^57014' or p_message ~* 'timeout|timed out|canceling statement' then 'база отвечает слишком долго'
    -- Наш сервер и внешние сервисы
    when p_message ~* 'JWT issued at future' then 'часы сервера и базы расходятся, проверка входа отклонена'
    when p_message ~* 'weather unavailable|open-meteo' then 'сервис погоды Open-Meteo не ответил'
    when p_message ~* 'could not create account' then 'не получилось создать аккаунт при входе через Telegram'
    when p_message ~ '^HTTP 5' then 'сервер ответил ошибкой'
    when p_message ~ '^HTTP 4' then 'запрос отклонён'
    when p_message ~* '^(TypeError|ReferenceError|RangeError|SyntaxError|InvalidStateError)' then 'ошибка в коде приложения'
    else 'непредвиденная ошибка'
  end
$function$;

-- Кого задело: до трёх игроков с ошибкой этого вида за окно (по умолчанию 10 минут, как в system_health_tick).
create or replace function public._alert_players(p_context text, p_minutes int default 10)
returns jsonb
language sql
stable
security definer
set search_path to 'public'
as $function$
  select coalesce(jsonb_agg(jsonb_build_object(
      'name', t.name, 'public_id', t.public_id, 'city', t.city, 'tg_id', t.tg_id, 'n', t.n
    ) order by t.last_at desc), '[]'::jsonb)
  from (
    select coalesce(nullif(p.display_name, ''), 'без имени') as name, p.public_id, p.city, p.telegram_id as tg_id,
           count(*) as n, max(ce.created_at) as last_at
    from public.client_errors ce
    join public.profiles p on p.id = ce.user_id
    where ce.context = p_context and not ce.network
      and ce.created_at > now() - make_interval(mins => p_minutes)
    group by p.id, p.display_name, p.public_id, p.city, p.telegram_id
    order by max(ce.created_at) desc
    limit 3
  ) t
$function$;

-- Те же игроки строками для текста тревоги.
create or replace function public._alert_who_text(p_players jsonb, p_total bigint)
returns text
language sql
immutable
as $function$
  select 'Кто: ' || string_agg(
      p->>'name' || ' · ID ' || coalesce(p->>'public_id', '—') || ' · ' ||
      case p->>'city'
        when 'moscow' then 'Москва и МО' when 'batumi' then 'Батуми' when 'spb' then 'Санкт-Петербург'
        when 'sochi' then 'Сочи' when 'tbilisi' then 'Тбилиси' else 'город не выбран'
      end ||
      case when p->>'tg_id' is not null then ' · Telegram привязан' else '' end ||
      ' · ' || (p->>'n') || ' раз',
      E'\n      ')
    || case when p_total > jsonb_array_length(p_players)
         then E'\n      …и ещё ' || (p_total - jsonb_array_length(p_players)) else '' end
  from jsonb_array_elements(p_players) p
$function$;

-- Тревога с данными: те же правила, что у двухаргументной (раз в час на ключ, супер-админам), плюс payload.
create or replace function public._system_alert(p_key text, p_text text, p_payload jsonb)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if exists (select 1 from public.notifications n where n.kind = 'system_alert' and n.payload->>'key' = p_key
             and n.created_at > now() - interval '1 hour') then
    return;
  end if;
  insert into public.notifications (user_id, kind, payload)
  select p.id, 'system_alert', jsonb_build_object('key', p_key, 'text', left(p_text, 900)) || coalesce(p_payload, '{}'::jsonb)
  from public.profiles p where p.is_super_admin;
end;
$function$;

revoke all on function public._system_alert(text, text, jsonb) from public, anon, authenticated;
grant execute on function public._system_alert(text, text, jsonb) to service_role;
revoke all on function public._alert_players(text, int) from public, anon, authenticated;
grant execute on function public._alert_players(text, int) to service_role;

create or replace function public.system_health_tick()
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_problems text;
  e record;
  v_n bigint;
  v_sample text;
  v_players jsonb;
begin
  select string_agg(ch.rpc || '(' || array_to_string(ch.keys, ', ') || ') — ' || ch.problem, '; ')
  into v_problems
  from public.admin_rpc_contract_check(
    (select coalesce(jsonb_agg(jsonb_build_object('rpc', w.rpc, 'keys', to_jsonb(w.keys))), '[]'::jsonb) from public.rpc_contract_watch w)
  ) ch;
  if v_problems is not null then
    perform public._system_alert('rpc_contract',
      E'Ломается: сайт целиком — приложение вызывает функции базы, которых нет\n\nТехнически: ' || v_problems);
  end if;

  -- Errors reported by the app (players) and by the server routes (api:…).
  for e in
    select ce.context, count(*) as n, count(distinct ce.user_id) as users,
      (array_agg(ce.message order by ce.created_at desc))[1] as sample
    from public.client_errors ce
    where ce.created_at > now() - interval '10 minutes' and not ce.network
    group by ce.context
    having count(*) >= case when ce.context = 'webview_killed' then 3 when ce.context like 'api:%' then 3 when ce.context in ('geolocation', 'camera') then 5 else 1 end
  loop
    v_players := public._alert_players(e.context);
    perform public._system_alert('client:' || e.context,
      format(E'Ломается: %s\nЧто случилось: %s\n%s%s\n\nТехнически: %s',
        public._alert_area(e.context),
        public._alert_meaning(coalesce(e.sample, '')),
        case when e.users > 0
          then 'Задело: ' || public._ru_count(e.users, 'игрок', 'игрока', 'игроков') || ', ' || public._ru_count(e.n, 'раз', 'раза', 'раз') || ' за 10 минут'
          else 'Сколько: ' || public._ru_count(e.n, 'раз', 'раза', 'раз') || ' за 10 минут'
        end,
        case when jsonb_array_length(v_players) > 0 then E'\n' || public._alert_who_text(v_players, e.users) else '' end,
        left(coalesce(e.sample, ''), 200)),
      jsonb_build_object('players', v_players));
  end loop;

  -- Background jobs that failed (pg_cron).
  for e in
    select j.jobname, count(*) as n, (array_agg(d.return_message order by d.start_time desc))[1] as sample
    from cron.job_run_details d
    join cron.job j on j.jobid = d.jobid
    where d.status = 'failed' and d.start_time > now() - interval '10 minutes'
    group by j.jobname
  loop
    perform public._system_alert('cron:' || e.jobname,
      format(E'Ломается: %s\nЧто случилось: %s\nСколько: %s за 10 минут\n\nТехнически: %s',
        public._alert_area('cron:' || e.jobname),
        public._alert_meaning(coalesce(e.sample, '')),
        public._ru_count(e.n, 'сбой', 'сбоя', 'сбоев'),
        left(coalesce(e.sample, ''), 200)));
  end loop;

  -- Telegram: messages due for 15+ minutes and still not out.
  select count(*) into v_n from public.telegram_outbox o
  where o.sent_at is null and o.deliver_after < now() - interval '15 minutes';
  if v_n > 0 then
    select left(o.last_error, 200) into v_sample from public.telegram_outbox o
    where o.sent_at is null and o.last_error is not null order by o.id desc limit 1;
    perform public._system_alert('telegram_backlog',
      format(E'Ломается: отправка сообщений в Telegram\nЧто случилось: %s ждут отправки дольше 15 минут%s',
        public._ru_count(v_n, 'сообщение', 'сообщения', 'сообщений'),
        coalesce(E'\n\nТехнически: ' || v_sample, '')));
  end if;

  -- Telegram: deliveries given up on in the last hour for a reason other
  -- than the person having blocked the bot or left Telegram.
  select count(*), (array_agg(left(o.last_error, 200) order by o.id desc))[1] into v_n, v_sample
  from public.telegram_outbox o
  where o.attempts >= 3 and o.created_at > now() - interval '1 hour'
    and o.last_error is not null and o.last_error !~* 'blocked|deactivated|chat not found|user not found';
  if v_n > 0 then
    perform public._system_alert('telegram_failed',
      format(E'Ломается: отправка сообщений в Telegram\nЧто случилось: %s не удалось доставить за час\n\nТехнически: %s',
        public._ru_count(v_n, 'сообщение', 'сообщения', 'сообщений'), coalesce(v_sample, '')));
  end if;
end;
$function$;
