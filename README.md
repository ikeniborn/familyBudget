# Family Budget

Система управления семейным бюджетом с веб-интерфейсом.

## О проекте

**FamilyBudget** — production-ready приложение для планирования и учёта семейных расходов. Предназначено для семей из 2-5 человек.

Решает проблемы:
- Сложность отслеживания расходов в реальном времени
- Отсутствие контроля над бюджетом
- Потеря времени на ручную консолидацию данных

## Возможности

### Веб-интерфейс
- Dashboard с ключевыми метриками
- Интерактивные графики (ECharts)
- План-факт анализ
- Управление справочниками (категории, финансовые центры, центры затрат)
- Импорт из Tinkoff банка
- Мониторинг системы
- Двухфакторная аутентификация (2FA)
- PWA с offline режимом

### Аналитика
- 3 типа графиков: план-факт, динамика, структура
- Waterfall и Heatmap визуализации
- Сравнение периодов
- Экспорт данных

## Статус проекта

| Метрика | Значение |
|---------|----------|
| Версия | v5.3.0 |
| API endpoints | 142 |
| Тестовых файлов | 17 |
| Web шаблонов | 21 |

## Quick Start

Подробное руководство по установке: [START.md](START.md)

```bash
# 1. Клонировать репозиторий
git clone https://github.com/yourusername/familyBudget.git ~/familyBudget
cd ~/familyBudget

# 2. Установить зависимости
sudo ./install.sh

# 3. Настроить окружение
./setup.sh

# 4. Запустить приложение
./deploy.sh --profile full
```

Требования:
- Ubuntu 20.04+ или Debian 11+
- Docker + Docker Compose

## Использование

### Веб-интерфейс

- **Dashboard** — главная страница с метриками и быстрыми действиями
- **Транзакции** — список операций с фильтрами и переводами
- **Планирование** — план-факт анализ по периодам
- **Аналитика** — графики и отчёты
- **Уведомления** — push-уведомления и напоминания
- **Администрирование**:
  - Категории (иерархические)
  - Финансовые центры (счета, кошельки)
  - Центры затрат (проекты)
  - Импорт из Tinkoff
  - Мониторинг системы
  - Управление пользователями

## Документация

| Документ | Описание |
|----------|----------|
| [START.md](START.md) | Руководство по установке для администраторов |
| [CLAUDE.md](CLAUDE.md) | Инструкции для разработчиков |
| [docs/prd/](docs/prd/) | Product Requirements Documents (16 файлов) |
| [docs/guides/](docs/guides/) | Руководства пользователя |
| [docs/technical/](docs/technical/) | Технические планы рефакторинга |
| [docs/audits/](docs/audits/) | Аудиты кода и безопасности |
| `/docs` (Swagger) | API документация (после запуска) |

### PRD документация

- [01 - Обзор проекта](docs/prd/01-executive-summary.md)
- [02 - Описание продукта](docs/prd/02-product-overview.md)
- [03 - Архитектура](docs/prd/03-system-architecture.md)
- [04 - Функциональные требования](docs/prd/04-functional-requirements.md)
- [05 - Нефункциональные требования](docs/prd/05-non-functional-requirements.md)
- [06 - База данных](docs/prd/06-database-design.md)
- [07 - API спецификация](docs/prd/07-api-specification.md)
- [08 - UI дизайн](docs/prd/08-ui-design.md)
- [09 - Безопасность](docs/prd/09-security-authentication.md)
- [10 - Деплой и операции](docs/prd/10-deployment-operations.md)
- [14 - Кэширование](docs/prd/14-caching-strategy.md)
- [15 - Code Style](docs/prd/15-code-style-guidelines.md)
- [16 - Changelog](docs/prd/16-changelog-release-management.md)

### Guides

- [Импорт из Tinkoff](docs/guides/TINKOFF_IMPORT.md)
- [Troubleshooting импорта](docs/guides/TROUBLESHOOTING_IMPORT.md)

## Технологии

| Компонент | Технология |
|-----------|------------|
| Backend | FastAPI 0.121.2, SQLModel, asyncpg, Alembic |
| Database | PostgreSQL 16 |
| Frontend | HTMX, Jinja2, Tailwind CSS 3.4, DaisyUI 4.12 |
| Charts | ECharts 5.5 |
| Auth | JWT (httpOnly cookies), 2FA (TOTP) |
| Deployment | Docker Compose, Nginx, Let's Encrypt |
| PWA | Service Worker, IndexedDB (offline mode) |

## Архитектура

```
familyBudget/
├── backend/              # FastAPI приложение
│   ├── app/
│   │   ├── api/          # REST API + Web endpoints
│   │   ├── models/       # SQLModel модели
│   │   ├── services/     # Бизнес-логика
│   │   └── middleware/   # JWT, logging, CSP
│   └── db/migrations/    # Alembic миграции
├── frontend/
│   ├── web/              # Веб-интерфейс (HTMX)
│   │   ├── templates/    # Jinja2 шаблоны (21 шт)
│   │   └── static/       # CSS, JS, icons
│   └── shared/           # Общие JS модули
├── scripts/              # Деплой и утилиты (15+ скриптов)
│   ├── backup.sh         # Бэкапы PostgreSQL
│   ├── restore.sh        # Восстановление
│   └── lib/              # Shared bash функции
├── docs/                 # Документация
│   ├── prd/              # PRD (16 файлов)
│   ├── guides/           # Руководства
│   ├── technical/        # Технические планы
│   └── audits/           # Аудиты
├── tests/                # Тесты
├── sql/                  # SQL скрипты
├── nginx/                # Nginx конфигурация
├── deploy.sh             # Деплой приложения
├── setup.sh              # Настройка окружения
├── logs.sh               # Диагностика
└── docker-compose.yml
```

## Особенности реализации

- **SCD Type 1 + History tables** — текущее состояние + полная история изменений
- **Closure Table** — эффективные иерархические запросы для категорий
- **JWT в httpOnly cookies** — безопасная аутентификация
- **2FA (TOTP)** — двухфакторная аутентификация (Google Authenticator)
- **PWA + Offline** — работа без интернета с синхронизацией
- **Автоматические бэкапы** — локально + S3
- **Rate Limiting** — защита от brute-force атак
- **CSP Headers** — защита от XSS

## Скрипты управления

| Скрипт | Описание |
|--------|----------|
| `deploy.sh` | Деплой приложения (--profile full, --build, --clean) |
| `setup.sh` | Настройка окружения и синхронизация в /opt/budget |
| `logs.sh` | Диагностика и логи (--save, --quick, --alert) |
| `install.sh` | Установка системных зависимостей |
| `scripts/backup.sh` | Бэкап PostgreSQL |
| `scripts/restore.sh` | Восстановление из бэкапа |
| `scripts/ssl_certificate_manager.sh` | Управление SSL сертификатами |

## Поддержка

- **Проблемы с установкой**: см. [START.md#troubleshooting](START.md#troubleshooting)
- **Техническая документация**: см. [docs/prd/](docs/prd/)
- **Импорт из Tinkoff**: см. [docs/guides/TINKOFF_IMPORT.md](docs/guides/TINKOFF_IMPORT.md)
- **Troubleshooting импорта**: см. [docs/guides/TROUBLESHOOTING_IMPORT.md](docs/guides/TROUBLESHOOTING_IMPORT.md)

## Лицензия

MIT License

---

**Версия документации:** 3.0.0 | **Дата обновления:** 2025-12-09
