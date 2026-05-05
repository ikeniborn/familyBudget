# Wiki Log

<!-- Append-only лог. Новые записи добавляются в конец. -->

---

## 2026-05-05 — init архитектура

**Операция:** init
**Домен:** архитектура
**Источники обработаны:** 46 файлов из `docs/architecture/`

**Создано страниц: 21**

### архитектура/паттерны (8 страниц)
- + `registry-first.md` (developing) — из docker.md, ci-cd-build-deploy.md, versioning.md
- + `multi-stage-build.md` (developing) — из docker.md
- + `incremental-build.md` (developing) — из build-system.md
- + `offline-first.md` (developing) — из dexie-integration.md, pwa.md
- + `retry-pattern.md` (developing) — из patterns/retry-pattern.md, dexie-integration.md
- + `cache-busting.md` (developing) — из optimization/cache-busting.md, versioning.md, build-system.md
- + `семантическое-версионирование.md` (developing) — из versioning.md, build-system.md
- + `leader-follower.md` (stub) — из websocket.md

### архитектура/компоненты (3 страницы)
- + `fab-navigation.md` (stub) — из responsive-design.md, speed-dial-unified.md
- + `modal-система.md` (developing) — из modal-architecture.md, transfers-system.md
- + `base-template.md` (stub) — из base-template-structure.md, README.md

### архитектура/сервисы (2 страницы)
- + `transfer-service.md` (stub) — из transfers-system.md
- + `recurring-plans-service.md` (developing) — из recurring-plans.md

### архитектура/инфраструктура (2 страницы)
- + `ci-cd-pipeline.md` (developing) — из ci-cd-build-deploy.md, versioning.md, build-system.md
- + `vite-build-system.md` (developing) — из build-system.md

### архитектура/безопасность (2 страницы)
- + `аутентификация.md` (mature) — из authentication.md
- + `logging-security.md` (developing) — из logging-best-practices.md, authentication.md

### архитектура/интеграции (3 страницы)
- + `websocket-realtime.md` (developing) — из websocket.md
- + `pwa-service-worker.md` (stub) — из build-system.md, dexie-integration.md
- + `p2p-sync.md` (stub) — из p2p-sync.md

**Пропущено:** Файлы с менее чем 2 упоминаниями для некоторых entity_types; pwa.md (превысил лимит токенов — обработан по доступным данным из других файлов).

**Следующий шаг:** /llm-wiki lint архитектура

---

## 2026-05-06T00:00:00

**Операция:** init
**Домен:** скрипты
**Источники обработаны:** 2 Markdown README + ключевые bash/python скрипты из `scripts/`

**Затронуто страниц: 6**

- СОЗДАНА: `.wiki/скрипты/деплой/deploy-lib-модули.md` (mature) — из scripts/lib/README.md
- СОЗДАНА: `.wiki/скрипты/бэкап/бэкап-система.md` (mature) — из backup.sh, restore.sh, check_backup_health.sh, s3_backup.py
- СОЗДАНА: `.wiki/скрипты/ssl/ssl-управление.md` (developing) — из ssl_certificate_manager.sh, check_certificates.sh, clean_old_certificates.sh
- СОЗДАНА: `.wiki/скрипты/ci/ci-скрипты.md` (developing) — из scripts/ci/*.sh
- СОЗДАНА: `.wiki/скрипты/утилиты/утилиты-сервис.md` (developing) — из generate_vapid_keys.sh, create_admin_user.py, scripts/validation/README.md
- СОЗДАНА: `.wiki/скрипты/инфраструктура-ос/автоматизация-бэкапа.md` (developing) — из scripts/systemd/*, scripts/cron/*, scripts/logrotate/*

**Примечание:** Добавлен домен «скрипты» в domain-map.json. entity_types определены в bootstrap-анализе (6 типов: деплой, бэкап, ssl, ci, утилита, инфраструктура-ос). Источники — bash/python файлы, не markdown; 2 README обработаны полностью, остальные через header-комментарии скриптов.

**Следующий шаг:** /llm-wiki lint скрипты

---

## 2026-05-05T00:00:00

**Операция:** init
**Домен:** бэкенд
**Источники обработаны:** 5 файлов из `backend/`

**Затронуто страниц: 3**

- СОЗДАНА: `.wiki/бэкенд/приложение/fastapi-структура.md` (developing) — из backend/README.md
- СОЗДАНА: `.wiki/бэкенд/миграции/alembic-миграции.md` (developing) — из backend/db/README.md, backend/db/migrations/README.md, backend/db/migrations/archive/README.md
- СОЗДАНА: `.wiki/бэкенд/тестирование/e2e-тесты.md` (developing) — из backend/tests/e2e/README.md

**Пропущено:** 0 файлов пропущено. backend/db/migrations/README.md и archive/README.md объединены со страницей alembic-миграции.md.

**Примечание:** Добавлен домен «бэкенд» в domain-map.json. 5 markdown-файлов в backend/ (исключая .venv/venv/site-packages).

---
