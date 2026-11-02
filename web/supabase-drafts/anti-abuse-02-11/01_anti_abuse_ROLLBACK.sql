-- Undo 01_anti_abuse.sql. Alerts already sent stay in the feed.
select cron.unschedule('abuse-scan');

do $$
declare
  v_def text := pg_get_functiondef('public.confirm_catch(text, text, text, integer, numeric, text, text, timestamptz)'::regprocedure);
  v_from int := strpos(v_def, E'  -- Заморозка и потолок уловов в сутки (защита от скриптов, 02.11).\n');
  v_to int;
  v_check text := E'  if not coalesce(v_is_privileged, false) then\n    perform public._abuse_check_catch(v_uid, v_catch.caught_at, v_catch.territory_id);\n  end if;\n';
begin
  if v_from = 0 then raise exception 'confirm_catch: freeze block not found'; end if;
  v_to := strpos(substr(v_def, v_from), E'    end if;\n  end if;\n') + length(E'    end if;\n  end if;\n');
  v_def := substr(v_def, 1, v_from - 1) || substr(v_def, v_from + v_to - 1);
  if strpos(v_def, v_check) = 0 then raise exception 'confirm_catch: abuse check not found'; end if;
  execute replace(v_def, v_check, '');
end
$$;

do $$
declare
  v_def text := pg_get_functiondef('public.post_comment(bigint, text, bigint)'::regprocedure);
  v_block text := E'  if exists (select 1 from public.profiles p where p.id = v_uid and p.frozen_until > now()) then\n    return jsonb_build_object(''ok'', false, ''reason'', ''frozen'');\n  end if;\n';
begin
  if strpos(v_def, v_block) = 0 then raise exception 'post_comment: frozen check not found'; end if;
  execute replace(v_def, v_block, '');
end
$$;

do $$
declare
  v_def text := pg_get_functiondef('public.report_comment(bigint, text)'::regprocedure);
  v_line text := E'  if not public._may_report() then raise exception ''RATE_LIMIT:report''; end if;\n';
begin
  if strpos(v_def, v_line) = 0 then raise exception 'report_comment: limit not found'; end if;
  execute replace(v_def, v_line, '');
end
$$;

drop policy "users upload their own catch photos" on storage.objects;
create policy "users upload their own catch photos" on storage.objects for insert to authenticated
  with check (bucket_id = 'catch-photos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy "users report catches" on public.catch_reports;
create policy "users report catches" on public.catch_reports for insert to authenticated
  with check (auth.uid() = reporter_id);

drop function public.admin_unfreeze(uuid);
drop function public.admin_get_freeze(uuid);
drop function public._may_report();
drop function public._may_upload_photo();
drop function public.abuse_scan();
drop function public._abuse_check_catch(uuid, timestamptz, text);
drop function public._freeze_user(uuid, text, text);
drop function public._km(double precision, double precision, double precision, double precision);

alter table public.profiles drop column frozen_until, drop column frozen_reason;
