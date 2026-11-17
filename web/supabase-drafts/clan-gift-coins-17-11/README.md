# Подарочные монеты нельзя внести в общак (17.11.2026)

- `01_gift_coins.sql` — `_clan_gift_locked(uuid)`, `clan_treasury_donatable()`, отказ `CLAN:gift_coins` в `clan_treasury_donate`.
- `01_gift_coins_ROLLBACK.sql` — прежний `clan_treasury_donate` (тело из живой базы 17.11.2026) и удаление двух новых функций.
- `01_gift_coins_DRYRUN.sql` — то же в `DO`-блоке с проверками на трёх живых игроках, в конце `raise exception` (ничего не остаётся).

Пробный прогон 17.11.2026: `A.locked=150 A.can=0 A10=CLAN:gift_coins A500=not enough coins | B.can=10 B20=CLAN:gift_coins B10=OK B.after=0 B10again=CLAN:gift_coins | C.can=5892 C100=OK | anon_can_donatable=false auth_can_donatable=true auth_can_locked=false auth_can_donate=true`. После отката новых функций нет, `clan_treasury_donate` прежний.

**Применено 17.11.2026 в 15:37 UTC** (версия `20261117153736`).

Порядок: применить миграцию → выложить приложение (до миграции приложение ничего не проверяет, после — проверяет и сервер, и окно взноса).
Отсечка взносов «до правила» — `2026-11-17 15:30 UTC`; взносы между отсечкой и применением тоже не считаются тратами подарка (их несколько, на правило не влияет).
