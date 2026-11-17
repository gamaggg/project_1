-- Откат 01_normalize_display_name.sql: убрать триггер и функцию.
drop trigger if exists profiles_normalize_display_name on public.profiles;
drop function if exists public._normalize_display_name();

-- Вернуть прежние имена (как были на 17.11.2026), только если игрок их с тех пор не менял.
update public.profiles p
set display_name = v.old_name
from (values
  ('89856', '𝔸lexander', 'Alexander'),
  ('29108', '𝙏𝙤𝙧𝙚𝙤𝙙𝙤𝙧', 'Toreodor'),
  ('36022', '𝔐𝔞𝔠𝔥𝔢𝔱𝔢', 'Machete')
) as v(public_id, old_name, new_name)
where p.public_id = v.public_id and p.display_name = v.new_name;
