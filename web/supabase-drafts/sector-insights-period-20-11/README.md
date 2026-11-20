# «Что клюёт здесь»: переключатель «Всё время» / «30 дней» (20.11.2026)

- `01_insights_period.sql` — `get_sector_insights(p_territory_id text, p_days integer DEFAULT 90)` вместо `get_sector_insights(text)`: `p_days = 0` — за всё время (scope `all`), `30` — строго за 30 дней (scope `days`, может быть пусто), `90` по умолчанию — прежнее правило (90 дней при 3+ уловах, иначе всё время; scope `sector` / `sector_all`). В ответе новое поле `days`. Легенда и `my_count` не менялись. Права как в живой базе: `authenticated`, `service_role` (гостям и `PUBLIC` — нет).
- `01_insights_period_ROLLBACK.sql` — прежняя `get_sector_insights(text)` (тело из живой базы 20.11.2026), те же права.
- `01_insights_period_DRYRUN.sql` — то же в `DO`-блоке с проверками на B1173, в конце `raise exception` (ничего не остаётся).

Пробный прогон 20.11.2026: `old_call_same=true scope_before=sector total_before=410 | all: scope=all total=410 top=stavrida:202 | 30: scope=days total=260 top=skorpena:99 legend_same=true | anon=false auth=true default=p_territory_id text, p_days integer DEFAULT 90 overloads=1`. После отката в базе прежняя `get_sector_insights(text)` с прежними правами.

**Применено 20.11.2026 в 05:25 UTC** по «применяй» (версия `20261120052557`): `get_sector_insights(text, integer DEFAULT 90)`, права `authenticated`, `service_role`; старый вызов — `sector:410`, `p_days=0` — `all:410`, `p_days=30` — `days:260`; `npm run db:contract` — всё на месте.

Порядок: применить миграцию (в тихие часы 20:00–03:00 UTC) → `npm run db:contract` → выложить приложение. Если приложение выйдет раньше миграции, база отвечает на `p_days` «функция не найдена» (PGRST202, проверено), и приложение повторяет старый вызов: блок прежний, без переключателя.
