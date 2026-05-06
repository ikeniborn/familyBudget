# Wiki Log

<!-- Append-only лог. Новые записи добавляются в конец. -->

## 2026-05-06T00:00:00

**Операция:** init
**Домен:** документация
**Источник:** docs/ (bootstrap-анализ 130+ файлов)

**Затронуто страниц:** 10

- СОЗДАНА: `.wiki/документация/frontend/dexie-module.md` (mature) — на основе docs/architecture/core/dexie-integration.md
- СОЗДАНА: `.wiki/документация/frontend/websocket-клиент.md` (mature) — на основе docs/architecture/core/websocket.md
- СОЗДАНА: `.wiki/документация/frontend/build-system.md` (mature) — на основе docs/architecture/core/build-system.md
- СОЗДАНА: `.wiki/документация/frontend/dashboard-module.md` (developing) — на основе docs/architecture/overview.yaml
- СОЗДАНА: `.wiki/документация/backend/аутентификация.md` (mature) — на основе docs/architecture/core/authentication.md
- СОЗДАНА: `.wiki/документация/backend/recurring-plans.md` (developing) — на основе docs/architecture/features/recurring-plans.md
- СОЗДАНА: `.wiki/документация/patterns/scd-closure-table.md` (developing) — SCD Type 1/2, Closure Table паттерны
- СОЗДАНА: `.wiki/документация/patterns/window-exports.md` (developing) — Window exports для IIFE бандлов
- СОЗДАНА: `.wiki/документация/patterns/offline-first.md` (developing) — Offline-first с Dexie + WebSocket sync
- СОЗДАНА: `.wiki/документация/operations/ci-cd-deploy.md` (developing) — CI/CD Registry-first архитектура

**Примечание:** Bootstrap-анализ сгенерировал 6 entity_types на основе 130+ файлов в docs/. Прочитаны ключевые файлы: dexie-integration.md, websocket.md, authentication.md, build-system.md, overview.yaml, recurring-plans.md, prd/01-executive-summary.md. Domain-map.json создан и сохранён.

---

## 2026-05-06T12:00:00

**Операция:** ingest
**Источник:** docs/architecture/features/transfers-system.md
**Домен:** документация

**Затронуто страниц:** 5

- СОЗДАНА: `.wiki/документация/frontend/transfers-module.md` (stub)
- СОЗДАНА: `.wiki/документация/api/transfers-api.md` (stub)
- СОЗДАНА: `.wiki/документация/database/budget-fact.md` (stub)
- ОБНОВЛЕНА: `.wiki/документация/frontend/websocket-клиент.md` — добавлен раздел «Обработка события transfer_created»; добавлен источник
- ПРОПУЩЕНА: backend-service (broadcast_budget_event) — менее 2 самостоятельных упоминаний; сведения перенесены в transfers-api.md

---

## 2026-05-06T14:00:00

**Операция:** lint
**Домен:** документация
**Проверено страниц:** 13

**Результат:** 0 errors, 2 warnings, 8 info

**Warnings:**
- [CT-003] `dexie-module.md`: WikiLink `[[websocket-архитектура]]` ведёт на несуществующий файл (правильное имя: `[[websocket-клиент]]`)
- [CT-003] `аутентификация.md`: WikiLink `[[jwt-tokens]]` ведёт на несуществующий файл (страница не создана)

**Info (CT-004 orphans — нет входящих ссылок):**
- `transfers-module.md`
- `transfers-api.md`
- `recurring-plans.md`
- `dashboard-module.md`
- `ci-cd-deploy.md`

**Info (CV-001 — файлы без ingest, выборка значимых из 138 источников):**
- docs/architecture/core/docker.md
- docs/architecture/core/pwa.md
- docs/prd/07-api-specification.md
- docs/architecture/backend/database/facts.yaml
- docs/architecture/backend/endpoints/ (50+ endpoint-файлов)

---

## 2026-05-06T16:00:00

**Операция:** lint
**Домен:** реализация
**Проверено страниц:** 8

**Результат:** 1 error, 1 warning, 4 info

**Errors:**
- [ST-006] `.wiki/.config/domain-map.json` — синтаксическая ошибка JSON: домен `реализация` находился вне массива `domains` (лишняя `]` на строке 85). **Исправлено автоматически.**

**Warnings:**
- [ST-004] `.wiki/реализация/.config/index.md` — неожиданный вложенный `.config/` в папке домена. **Удалено автоматически.**

**Info (CT-004 orphans — нет входящих ссылок):**
- `sync-endpoint.md` — не упоминается другими страницами
- `jwt-middleware.md` — не упоминается другими страницами
- `start-handler.md` — не упоминается другими страницами

**Info (CV-002 — низкое покрытие):**
- ~500 значимых файлов источников, 8 wiki-страниц (покрытие < 2%). Рекомендуется `/llm-wiki init реализация`.

---

## 2026-05-06T18:00:00

**Операция:** init
**Источник:** backend/app/, frontend/web/static/js/, frontend/shared/, bot/, scripts/, nginx/
**Домен:** реализация

**Затронуто страниц:** 13 новых создано

- СОЗДАНА: `.wiki/реализация/api/auth-endpoint.md` (mature)
- СОЗДАНА: `.wiki/реализация/api/transfers-endpoint.md` (developing)
- СОЗДАНА: `.wiki/реализация/services/auth-service.md` (developing)
- СОЗДАНА: `.wiki/реализация/services/cache-service.md` (developing)
- СОЗДАНА: `.wiki/реализация/services/scd2-service.md` (developing)
- СОЗДАНА: `.wiki/реализация/services/recurring-plan-service.md` (developing)
- СОЗДАНА: `.wiki/реализация/models/user.md` (mature)
- СОЗДАНА: `.wiki/реализация/middleware/csp-middleware.md` (developing)
- СОЗДАНА: `.wiki/реализация/middleware/logging-middleware.md` (stub)
- СОЗДАНА: `.wiki/реализация/frontend/budget-ws-client.md` (developing)
- СОЗДАНА: `.wiki/реализация/frontend/dexie-manager.md` (developing)
- СОЗДАНА: `.wiki/реализация/frontend/dashboard-module.md` (developing)
- СОЗДАНА: `.wiki/реализация/bot/summary-handler.md` (developing)

**Примечание:** Batch init — охвачены ключевые файлы всех 6 entity_types домена «реализация». Уже существующие 8 страниц сохранены без изменений. Всего в домене теперь 21 страница.

---
