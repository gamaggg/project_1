# Рамка «Чемпионская» за 10 уровень клана (23.11.2026)

- `01_champion_frame.sql` — `clan_shop_equip`: `frame_champion` можно надеть клану 10 уровня (`_clan_level(xp) >= 10`), без покупки. Остальное как было. Купить и поставить целью нельзя: в `_clan_shop_item` её нет (`CLAN:bad_item`, `CLAN:bad_goal`).
- `01_champion_frame_ROLLBACK.sql` — снять рамку с кланов и вернуть прежнюю функцию.
- `dry_run_01.sql` — прогон, откатывается исключением.

Прогон 23.11.2026 на живой базе (откатан), клан 36 Fish-hook, 6 уровень:
`1:CLAN:not_owned 2:CLAN:bad_item 3:CLAN:bad_goal 4:надел=frame_champion 5:CLAN:not_owned 6:надел=frame_silver 7:CLAN:not_owned 8:снял=null 9:CLAN:not_manager | grants=authenticated:EXECUTE,postgres:EXECUTE,service_role:EXECUTE`
(1 — на 6 уровне нельзя; 2–3 — купить и поставить целью нельзя; 4 — на 10 уровне надел; 5 — как лодку нельзя; 6 — купленная серебряная как раньше; 7 — некупленная легендарная нельзя; 8 — снять; 9 — участник не может.) После прогона: xp 1075, рамка серебряная, функция прежняя.

Статус: **применено 23.11.2026** (миграция `20261123105608 clan_champion_frame_23_11`). После применения: функция новая, права те же (authenticated, postgres, service_role — EXECUTE), у кланов ничего не изменилось. Кланов 10 уровня пока нет (максимум 1 075 опыта из 3 200).
