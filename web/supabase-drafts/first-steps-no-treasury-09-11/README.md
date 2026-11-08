# «Первые шаги» без «Забери Казну» (09.11.2026)

Личная Казна закрыта 09.11.2026 (`retire_personal_treasury`), собрать её больше нельзя, а `claim_first_steps` платит
100 монет только когда выполнены все шаги из `_first_steps_state.steps`. Решение владельца: шаг убрать.

- `01_first_steps_no_treasury.sql` — `_first_steps_state` без ключа `treasury` (create or replace, сигнатура и права те же).
- `01_first_steps_no_treasury_ROLLBACK.sql` — прежнее тело (снято с живой базы).

Приложение (`FirstSteps.tsx`, `FirstStepKey`, тексты ru/en/ka, FAQ ru/en/ka) уже без этого шага и лишний ключ не читает,
поэтому его выкладывают раньше миграции.

## Пробный прогон 09.11.2026 (живая база, откатанная транзакция)

| | до | после |
|---|---|---|
| шаги | clan, catch, daily, fortify, treasury, challenge | clan, catch, daily, fortify, challenge |
| могут ещё забрать награду (не забрали) | 354 | 354 |
| выполнили все шаги | 0 | 2 |
| права на функцию | postgres, service_role | postgres, service_role |

Два игрока застряли только на «Забери Казну» — после применения смогут забрать 100 монет. Уже забрали награду 13 игроков, их не касается.
