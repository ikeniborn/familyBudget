---
wiki_sources:
  - "scripts/lib/README.md"
wiki_updated: 2026-05-06
wiki_status: mature
tags:
  - bash
  - deploy
  - docker
aliases:
  - "deploy.sh библиотека"
  - "scripts/lib"
  - "deploy modules"
---

# Библиотека деплоя (scripts/lib)

Модульная библиотека деплоя: 13 bash-модулей, вырезанных из монолитного `deploy.sh` (3 125 строк → 386 строк оркестратор + ~3 025 строк в модулях). Цель — разделение ответственности, переиспользование функций и изолированное тестирование каждого модуля.

## Основные характеристики

### Порядок загрузки (важен)

```bash
source scripts/lib/config.sh      # Всегда первым — нет зависимостей
source scripts/lib/utils.sh       # Зависит от config.sh
# Все остальные зависят от config + utils
# docker.sh должен быть до network.sh
source scripts/lib/docker.sh
source scripts/lib/network.sh
```

### Модули по фазам

| Фаза | Модуль | Назначение | LOC |
|------|--------|-----------|-----|
| 1 | `config.sh` | Глобальная конфигурация и state-переменные | 118 |
| 1 | `utils.sh` | Логирование, проверки команд, обёртка docker compose | 124 |
| 1 | `validation.sh` | Валидация предусловий (Docker, .env, директории) | 207 |
| 1 | `status.sh` | Отчёт о статусе сервисов | 146 |
| 2 | `postgres.sh` | Health-check PostgreSQL, safety backup | ~370 |
| 2 | `services.sh` | Жизненный цикл Docker-сервисов (start/stop/wait) | 292 |
| 2 | `migrations.sh` | Alembic-миграции через контейнер | 124 |
| 2 | `firewall.sh` | UFW: открытие портов 80/443 | 57 |
| 2 | `backup_integration.sh` | Настройка cron для бэкапа | 44 |
| 3 | `sync.sh` | Синхронизация кода (mirror/update/clean/skip) | 551 |
| 3 | `docker.sh` | Smart cleanup v2, определение стратегии рестарта | 719 |
| 3 | `network.sh` | Проверка и освобождение портов 80/443 | 249 |
| 3 | `ssl.sh` | Управление SSL через host certbot | 285 |

### Smart Cleanup v2 (docker.sh)

Автоматически определяет нужно ли перезапускать PostgreSQL на основе изменённых файлов:

```
Изменённые файлы → категоризация (frontend/backend/db/docker/bot)
├─ DB или Docker изменения  → RESTART PostgreSQL
├─ Только backend/bot/frontend → KEEP PostgreSQL RUNNING
└─ Нет категоризации → спросить пользователя
```

| Тип очистки | PostgreSQL | Потеря данных | Применение |
|-------------|------------|---------------|-----------|
| Smart v2 | Авто-detect | Нет | Рекомендуется |
| Legacy | Всегда рестарт | Нет | Устаревший |
| Full | DELETE | **Да** | Только свежая установка |

### Синхронизация кода (sync.sh)

| Режим | Описание | Удаляет файлы |
|-------|----------|---------------|
| `mirror` | rsync --delete, точная копия | Да |
| `update` | только обновление, extra-файлы остаются | Нет |
| `clean` | полная очистка + копирование | Да |
| `skip` | без синхронизации | — |

### Ключевые конфигурационные переменные (config.sh)

- `DETACH_MODE`, `RUN_MIGRATIONS`, `CLEAN_DEPLOY`, `COMPOSE_PROFILE`, `SYNC_MODE`
- `MAX_WAIT_TIME`, `CHECK_INTERVAL` — таймауты ожидания сервисов
- `POSTGRES_WAS_STOPPED` — state для принятия решения о миграциях

## Связанные концепции

- [[ci-cd-pipeline]]
- [[alembic-миграции]]
- [[бэкап-система]]
