-- Когда игрок принял условия и политику (аудит 26.10.2026): раньше галочка стояла, но в базе её следа не было,
-- и доказать согласие конкретного человека было нельзя.
-- Две колонки в profiles и триггер: когда onboarding_completed впервые становится true (шаг с галочкой нельзя
-- пройти без неё), ставятся дата и версия текста. У тех, кто прошёл регистрацию раньше, остаётся NULL:
-- «принял до того, как мы стали записывать» (задним числом не проставляем).
-- Клиентам колонки не видны и не меняются (права на колонки profiles выданы поимённо), читает их только владелец базы.
-- Правило миграций: ALTER под живыми представлениями, сначала блокировка представления, потом таблицы.
-- Откат: 05_terms_accepted_ROLLBACK.sql.
set local lock_timeout = '10s';
lock table public.profiles_with_stats in access exclusive mode;
alter table public.profiles
  add column if not exists terms_accepted_at timestamptz,
  add column if not exists terms_version text;

create or replace function public._stamp_terms_accepted()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  if new.onboarding_completed and not coalesce(old.onboarding_completed, false) and new.terms_accepted_at is null then
    new.terms_accepted_at := now();
    new.terms_version := '2026-10-26';
  end if;
  return new;
end
$fn$;
revoke execute on function public._stamp_terms_accepted() from public, anon, authenticated;

drop trigger if exists profiles_stamp_terms on public.profiles;
create trigger profiles_stamp_terms
  before update of onboarding_completed on public.profiles
  for each row execute function public._stamp_terms_accepted();
