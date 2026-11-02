-- Undo 01_rating_overtaken.sql. Notifications already sent stay in the feed.
select cron.unschedule('rating-tick');

do $$
declare
  v_old text := '''catch_species_changed'', ''sector_forecast'', ''rating_overtaken'')';
  v_new text := '''catch_species_changed'', ''sector_forecast'')';
  v_def text := pg_get_functiondef('public.queue_telegram_notification()'::regprocedure);
begin
  if (length(v_def) - length(replace(v_def, v_old, ''))) / length(v_old) <> 1 then
    raise exception 'queue_telegram_notification: expected rating_overtaken in the list once';
  end if;
  execute replace(v_def, v_old, v_new);
end
$$;

drop function public.rating_tick(text);
drop table public.rating_places;
