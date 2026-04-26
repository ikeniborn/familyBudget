# Сценарий 16 — Dexie (сквозной)

**Playwright-необходимость:** Только Playwright (нужен реальный IndexedDB браузера + real network sync).

## Оценка избыточности

Значительную часть можно перенести вниз:

| Проверка | Инструмент |
|---|---|
| Upsert/Delete в Dexie при API-ответе | `vitest` + fake-indexeddb |
| Схема Dexie, миграции версий | `vitest` |
| Идемпотентность `POST /sync` | `pytest` |
| Конфликт-резолвинг (last-write-wins / merge) | `vitest` + `pytest` |

На Playwright MCP оставить **smoke-проверку end-to-end** по всем 8 таблицам + визуальный контроль панели Dexie Diagnostics.

## Baseline счётчиков (до начала сессии)

Зафиксировать в Dexie Diagnostics стартовые значения по всем сущностям. Эталонный снимок на момент составления плана:

| Сущность | Count | Окно |
|---|---:|---|
| Articles | 23 | — |
| Financial Centers | 7 | — |
| Cost Centers | 8 | — |
| Facts | 38 | 90 days |
| Plans | 192 | −3 / +3 months |
| └ Recurring Plans | 25 | — |
| Stores | 13 | — |
| Product Groups | 23 | — |
| Shopping Lists | 3 | — |
| └ Shopping Items | 16 | — |

Реальные значения снимаются при старте прогона (могут отличаться) и сохраняются как `N₀` для каждой таблицы. Все дельты ниже считаются от `N₀`.

## Playwright MCP — порядок (одна сессия, не 8 отдельных)

1. Прекондиции (common). Снять baseline `N₀` для всех 10 счётчиков (8 верхнеуровневых + recurring_plans + shopping_items). Открыть Dexie Diagnostics, зафиксировать значения.
2. Открыть `/admin/articles`:
   - 2.1 Create → Dexie `articles = N₀+1`, UI-счётчик списка +1, Diagnostics +1.
   - 2.2 Delete → `articles = N₀`, UI-счётчик и Diagnostics возвращаются к baseline.
     - **Внимание:** physical delete требует **двух** последовательных confirm («ФИЗИЧЕСКОЕ УДАЛЕНИЕ» → «ФИНАЛЬНОЕ ПОДТВЕРЖДЕНИЕ») — это by design, защита от случайного каскадного удаления. E2E-сценарии должны кликать «Подтвердить» дважды.
3. `/admin/financial-centers`: create/delete → `financial_centers` (+1 / −1 от `N₀`).
4. `/admin/cost-centers`: create/delete → `cost_centers` (+1 / −1 от `N₀`).
5. `/facts` и `/`:
   - create факта → `facts = N₀+1` на обеих страницах и в Diagnostics.
   - delete (online) → `facts = N₀` (hard-delete: row физически удалён из Dexie). Если delete делается offline — row помечается `sync_status='deleted'` в очереди, после первой online-синхронизации удаляется окончательно.
6. `/plan` и `/`:
   - create обычного плана → `plans = N₀+1`, `recurring_plans` без изменений.
   - create регулярного плана → `plans = N₀+M` (генерируется серия экземпляров за окно −3/+3 мес.), `recurring_plans = N₀+1`. Зафиксировать фактический `M`.
   - delete регулярного плана → `recurring_plans = N₀`, все связанные `plans` экземпляры удалены (cascade), счётчик `plans` возвращается к baseline.
   - delete обычного плана → `plans = N₀`.
7. `/admin/stores`: create/delete → `stores`.
8. `/admin/product-groups`: create/delete → `product_groups`.
9. `/lists` + `/lists/<id>`:
   - create списка → `shopping_lists = N₀+1`, `shopping_items` без изменений.
   - create item внутри списка → `shopping_items = N₀+1`.
   - delete item → `shopping_items = N₀`.
   - delete списка → `shopping_lists = N₀`; все его items удалены, `shopping_items` возвращается к baseline.
10. **Сводная проверка счётчиков (обязательно после каждой мутации):**
    - значение Dexie-таблицы = значение в Dexie Diagnostics modal = UI-счётчик на странице сущности = ответ backend (`/api/v1/<resource>?count=true` или длина списка).
    - расхождение между любыми двумя источниками = баг, фиксировать в отчёте.
    - после удаления связанных сущностей (recurring → plans, list → items) проверить cascade на стороне Dexie без reload.
11. **Общее:**
    - после каждой мутации `sync_status` переходит `pending → synced`.
    - нет «осиротевших» записей (tombstone tracking).
    - reload страницы — Dexie консистентна с backend'ом, все счётчики сохраняют значение до reload.
    - в конце сессии (после teardown) все 10 счётчиков равны исходным `N₀`.
    - Модаль Dexie Diagnostics (кнопка «Локальная БД · нажмите для диагностики» в шапке) отражает данные, которые равны данным в БД в онлайн-режиме. Отдельной страницы `/dexie-diagnostics` нет.

## Data model quirks (учитывать при верификации)

- **Сумма в копейках.** `budgetFacts.amount` и `recurringPlans.amount` хранятся как `×100` (UI `11.00` → Dexie `1100`).
- **`description → comment`.** Поле формы «Описание» маппится на `budgetFacts.comment`; `description` остаётся `null`.
- **Tombstone vs archive.**
  - `budgetFacts`: в **online**-режиме delete = hard-delete (row пропадает из Dexie). `sync_status='deleted'` встречается только в **offline-очереди** `pendingOperations` до синхронизации.
  - `articles / financialCenters / costCenters / stores / productGroups`: имеют **archive** (PUT `/archive` → `is_active=false`, row сохраняется) **и** **hard-delete** (DELETE → physical remove + cascade на связанные facts). UI обычно использует archive, кнопка «Удалить» — hard-delete.
  - `shoppingLists`: в **online**-режиме DELETE → backend удаляет запись (cascade на items). В **offline**-очереди ставится tombstone (`sync_status='deleted'`) до подтверждения сервером.
- **Прямой API в обход UI.** `POST /api/v1/facts` из DevTools не попадает в Dexie автора — требуется reload или `/sync pull`. См. `docs/architecture/websocket-sync.md`.

## Teardown
Удалить все созданные за сессию записи (и в Dexie должны пропасть синхронно).

## Ожидаемый результат
Единый отчёт `report_16_dexie_<date>.md` с двумя таблицами:
1. **Baseline:** 10 сущностей × `N₀` (зафиксированный на старте).
2. **Прогон:** 10 сущностей × {create Δ, delete Δ, sync_status, Dexie count, Diagnostics count, UI count, backend count, cascade OK?, возврат к `N₀` после teardown}.

Любое расхождение между источниками count = отдельная строка в разделе «Несоответствия» с шагом, на котором обнаружено.

## Shelf
- `tests/integration/p2p-datalayer-integration.test.js`
- Добавить unit-тесты для каждой таблицы в `tests/unit/dashboard/` если нет.
