# CLAUDE.md

This file provides guidance to Claude Code when working with code in this repository.

**NEVER**: 
- Edit CLAUDE.md. Only user can add or delete this file.
- Delete volume docker. Only after approve user.
- Никогда не запускай сборку на сервере. Все изменения доставляются на сервер через cicd после обновления VERSION. Автоматически подымается версия на один шаг в рамках патча major.minor.patch (0.0.1>0.0.2)

## Project Overview

Family Budget is a family budget management system with Telegram bot and web interface. Built on FastAPI (backend), PostgreSQL (database), Docker deployment.

**Key Features:**
- 🔐 Authentication: Telegram OAuth, Email+Password, WebAuthn biometrics
- 📊 Hierarchical budget categories (Closure Table pattern)
- 💰 Transaction tracking with offline sync support
- 🤖 Telegram bot with Web Apps
- 🌐 Progressive Web App (HTMX + Tailwind CSS + DaisyUI)
- 📈 Real-time updates via WebSocket + Redis Pub/Sub
- 🔄 Change history (SCD Type 1 + History tables)

**Stack:** FastAPI 0.121.2 | PostgreSQL 16 | python-telegram-bot 21.10 | Docker Compose | Dexie.js 4.0+ (offline)

## Architecture

```
backend/app/
├── api/v1/endpoints/    # REST API endpoints
├── api/web/             # Web page routes (HTML responses)
├── models/              # SQLAlchemy models
├── schemas/             # Pydantic schemas
├── services/            # Business logic
├── db/                  # DB session, health
├── middleware/          # Auth, logging middleware
└── main.py              # FastAPI app entry point

frontend/web/
├── templates/           # Jinja2 HTML templates (HTMX)
├── static/css/          # CSS sources → .min.css (build time)
└── static/js/           # TypeScript → .bundle.js/.min.js (Rollup)

bot/
├── handlers/            # Telegram bot command handlers
├── jobs/                # Scheduled tasks
└── main.py              # Bot entry point

tests/
├── unit/                # Vitest (frontend) + pytest (backend)
├── integration/         # pytest backend integration
├── e2e/                 # Playwright browser tests
└── run-tests.sh         # Test runner helper
```

## Core Rules

**1. Multi-Perspective Analysis**

При решении любой задачи рассматривай проблему с точки зрения:
- **Системный архитектор**: Инфраструктурные решения, масштабируемость, отказоустойчивость
- **Frontend разработчик**: UX/UI эффективность, производительность клиента, доступность
- **Backend разработчик**: Оптимальная обработка данных, нагрузка на ресурсы, эффективность API
- **Security специалист**: Потенциальные уязвимости, защита данных, соответствие best practices
- **Технический писатель**: Актуальность и корректность документации, синхронизация с кодом

**2. Validation Loop**

После разработки решения:
- Проводить повторную проверку архитектурных решений
- Верифицировать соответствие требованиям из всех перспектив
- Задавать уточняющие вопросы на этапе анализа и планирования

**3. Architecture-First Workflow**

При каждой задаче доработки или правки:
1. **До начала работы**: использовать индекс `docs/llms.txt` и `docs/llms-full.txt` для быстрого поиска по архитектуре и документации Sphinx. Прочитать связанные разделы для понимания контекста
2. **После внесения изменений**: перечитать затронутые модули и проверить:
   - Не нарушена ли существующая архитектура
   - Соответствуют ли изменения паттернам проекта (Window exports, Closure Table, SCD и т.д.)
   - Нужно ли обновить документацию в `docs/` при изменении API, моделей или структуры

## Environments

| Environment | URL | Purpose |
|-------------|-----|---------|
| **Production** | https://fb.ikeniborn.ru/ | Live users |
| **Development** | https://fbd.ikeniborn.ru/ | Feature testing |

- For analysis logs connect to test server via "ssh budget-test".
- Work directory "/opt/budget"
- Git directory "~/familyBudget"

## Versioning & Deploy

- Файл `VERSION` — единственный источник истины для версии
- Pre-commit hook автоматически синхронизирует `package.json` и `package-lock.json` с `VERSION`
- CI/CD (`build-and-push.yml`) собирает Docker images и обновляет `IMAGE_VERSIONS.json`
- Деплой на сервер: `ssh budget-test` → `cd /opt/budget` → `./deploy.sh`

## Git requests
- Only create requests to test branch from dev/* branches
- Never use branch prod for source for development, copy, create for agent.

## Commands

```bash
# Frontend
npm run type-check          # TypeScript validation
npm run build:css           # Tailwind + CSS minification
npm run bundle              # Rollup JS bundles
npm run build               # type-check + CSS + bundles + verify

# Backend tests (из корня проекта)
cd tests && ./run-tests.sh backend    # Backend integration tests
cd tests && ./run-tests.sh all        # Все тесты

# Frontend tests
npm run test:coverage                  # Vitest unit tests + coverage
npm run test:e2e                       # Playwright E2E (headless)
npm run test:e2e:headed                # Playwright E2E (с браузером)

# Lint
npm run lint                           # ESLint
```

## UXUI

- Все решения по веб функциональности должны тестироваться для мобильных, планшетов, десктопов
- Веб должен поддерживать PWA и браузерную версию для Yandex Browser, Chrome, Safary 14+

## Gotchas

- **Pre-commit hook** проверяет: 1) `console.log` в `.ts` файлах (использовать `debugLog()`), 2) TypeScript type-check. Пропустить для WIP: `SKIP_TESTS=1`
- **`.min.css` и `.min.js`** файлы в `.gitignore` — генерируются при сборке, не коммитятся
- **JS bundles** подключаются с `?v=PLACEHOLDER` — CI заменяет на реальную версию для cache busting
- **Конфиги не в корне**: `tsconfig.json` в корне, но `tailwind.config.js`, `vitest.config.ts`, `playwright.config.ts` — в `config/`
- **Window exports**: публичные функции для `onclick` экспортируются через `adapters/windowExports.ts` (не inline JS)

