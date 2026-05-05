---
wiki_sources:
  - "backend/db/README.md"
  - "backend/db/migrations/README.md"
  - "backend/db/migrations/archive/README.md"
wiki_updated: 2026-05-05
wiki_status: developing
tags:
  - Alembic
  - PostgreSQL
  - SQLModel
aliases:
  - "Alembic migrations"
  - "database migrations"
  - "миграции БД"
---

# Alembic — управление миграциями БД

Family Budget использует Alembic в качестве единственного инструмента управления схемой базы данных. Старая 2-уровневая система (`schema/*.sql` + Alembic без использования) упразднена начиная с версии 5.0.0 — все среды (dev, staging, prod) работают только через Alembic.

## Основные характеристики

### Схема БД — применяемые паттерны

| Паттерн | Назначение |
|---------|-----------|
| SCD Type 2 | Историческое отслеживание dimension-таблиц |
| Closure Table | Эффективные иерархические запросы для категорий статей |
| Star Schema | Оптимизация аналитических запросов |
| Shared Family Budget | Все пользователи видят все транзакции |

### Таблицы baseline-схемы

Базовая миграция `20251109_001_baseline_schema_v5_0_0.py` создаёт:

- Dimension-таблицы: `t_d_user`, `t_d_article`, `t_d_financial_center`, `t_d_cost_center`
- Fact-таблица: `t_f_budget_fact`
- Иерархия: `t_d_article_hierarchy` (Closure Table)
- Auth: `t_f_refresh_token`, `t_article_usage_stats`
- Прочее: `t_notification`, `t_recommended_amounts`
- Все триггеры, функции, индексы

### Расположение файлов

```
backend/db/
├── migrations/
│   ├── alembic.ini        # конфигурация Alembic
│   ├── env.py             # окружение Alembic
│   ├── versions/          # файлы миграций
│   └── archive/           # архивные миграции (НЕ применяются)
├── tests/                 # SQL-тесты триггеров
└── run_migrations.sh      # скрипт запуска миграций
```

### Часто используемые команды

```bash
# Статус миграций
alembic current
alembic history --verbose

# Применить все pending миграции
alembic upgrade head

# Откатить последнюю миграцию
alembic downgrade -1

# Создать новую миграцию (автогенерация из изменений SQLModel)
alembic revision --autogenerate -m "описание_изменения"

# Создать пустую миграцию (вручную)
alembic revision -m "add_notification_preferences"
```

### Рабочий процесс разработки

1. Внести изменения в SQLModel-модели (`backend/app/models/`)
2. Автогенерировать миграцию: `alembic revision --autogenerate -m "..."`
3. **Обязательно** проверить сгенерированный файл вручную
4. Протестировать в обе стороны: `upgrade head` → `downgrade -1` → `upgrade head`
5. Закоммитить файл миграции

### Деплой на production

```bash
# deploy.sh автоматически:
# 1. Синхронизирует код → /opt/budget
# 2. Перезапускает Docker контейнеры
# 3. Выполняет: docker compose exec backend bash /app/backend/db/run_migrations.sh
# 4. Применяет pending миграции через Alembic
./deploy.sh --profile full
```

## Best Practices

**Делать:**
- Всегда проверять автогенерированные миграции вручную
- Тестировать `upgrade` и `downgrade` на каждую миграцию
- Писать корректный `downgrade()` (не `pass`)
- Одна миграция = одно логическое изменение

**Не делать:**
- Не изменять уже применённые миграции (создавать новую для исправления)
- Не пропускать миграции — всегда `alembic upgrade head`
- Не использовать `pass` в `downgrade()` — нельзя откатить

## Политика архивирования

Директория `migrations/archive/` содержит миграции, объединённые с другими в процессе разработки. Архивные миграции **не применяются** при деплое — хранятся только для истории.

Пример: миграция `010_add_record_type_to_budget_fact.sql` была архивирована, поскольку поле `record_type` перенесено в baseline-миграцию 006.

## Связанные концепции

- [[fastapi-структура]]
- [[ci-cd-pipeline]]
