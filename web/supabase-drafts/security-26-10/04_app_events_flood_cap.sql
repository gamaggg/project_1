-- log_app_events открыта и гостям (воронка новичка), а общий лимит был 5000 записей в минуту (аудит 26.10.2026):
-- идентификатор устройства задаёт сам клиент, поэтому лимит на устройство обходится случайными uuid, и атака
-- 5000/мин дала бы ~7 млн строк в сутки (~2 ГБ при 304 байтах на строку) и заполнила бесплатные 500 МБ базы за часы.
-- Реальные цифры: пик 47 в минуту и 589 в час, 1887 в сутки. Теперь общий лимит: 300 в минуту и 6000 в час
-- (запас в 6 и 10 раз на рост); атака упрётся в ~144 тыс. строк в сутки (~44 МБ).
-- Откат: 04_app_events_flood_cap_ROLLBACK.sql.
do $do$
declare
  v_old text := pg_get_functiondef('public.log_app_events(uuid,uuid,jsonb)'::regprocedure);
  v_new text;
begin
  v_new := replace(v_old,
    'where created_at > now() - interval ''1 minute'') > 5000 then',
    'where created_at > now() - interval ''1 minute'') > 300 or (select count(*) from public.app_events where created_at > now() - interval ''1 hour'') > 6000 then');
  if v_new = v_old then raise exception 'log_app_events: нужный участок не найден'; end if;
  execute v_new;
end
$do$;
