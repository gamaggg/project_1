-- Имена игроков: «красивые» буквы Юникода → обычные (17.11.2026).
-- Ники вида «𝙏𝙤𝙧𝙚𝙤𝙙𝙤𝙧», «𝔸lexander» набраны отдельными символами
-- (математические буквы и т. п.): они выглядят чужим шрифтом, а первая буква
-- на аватарке без фото резалась пополам и рисовалась квадратиком.
-- NFKC приводит такие буквы к обычным (𝙏 → T, 𝔸 → A, широкие ＡＢＣ → ABC),
-- кириллицу, грузинский и эмодзи не трогает.
-- Триггер ловит все пути: регистрацию (handle_new_user из Telegram и почты),
-- смену имени в профиле и любые правки админом.

create or replace function public._normalize_display_name()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.display_name is not null then
    -- NFKC иногда удлиняет строку (㎏ → kg): держим проверку «не длиннее 40».
    new.display_name := left(normalize(new.display_name, NFKC), 40);
  end if;
  return new;
end;
$$;

revoke all on function public._normalize_display_name() from public, anon, authenticated;

drop trigger if exists profiles_normalize_display_name on public.profiles;
create trigger profiles_normalize_display_name
  before insert or update of display_name on public.profiles
  for each row execute function public._normalize_display_name();

-- Уже сохранённые имена (на 17.11.2026 таких три: 89856, 29108, 36022).
update public.profiles
set display_name = display_name  -- триггер сам приведёт имя
where display_name is distinct from left(normalize(display_name, NFKC), 40);
