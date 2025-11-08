# Database Schema (Base DDL)

Базовая схема БД Family Budget v5.0.0.

## Файлы

| Файл | Содержимое |
|------|------------|
| 001_core_dimensions.sql | Users, Articles, FinancialCenters, CostCenters |
| 002_core_facts.sql | BudgetFacts + performance indexes |
| 003_core_hierarchy.sql | ArticleHierarchy (Closure Table) |
| 004_core_triggers.sql | Database triggers (Hierarchy + SCD2) |
| 005_auth_tokens.sql | RefreshTokens (JWT) |
| 006_notifications.sql | Budget threshold notifications |
| 007_recommendations.sql | Smart amount suggestions |

## ⚠️ КРИТИЧНО: Правила изменения

### Development Mode (ДО релиза v5.0.0)

✅ **РАЗРЕШЕНО:**
- Редактировать существующие файлы
- Добавлять новые файлы `008_*.sql`
- Изменять структуру таблиц

❌ **ЗАПРЕЩЕНО:**
- Использовать Alembic миграции

**Процесс изменения:**
```bash
# 1. Отредактировать файл
nano backend/db/schema/001_core_dimensions.sql

# 2. Пересоздать БД (ПОТЕРЯ ДАННЫХ!)
docker compose down -v && docker compose up -d

# 3. Проверить
curl http://localhost:8000/health
```

### Production Mode (ПОСЛЕ релиза v5.0.0)

❌ **ЗАПРЕЩЕНО:**
- Редактировать файлы в schema/

✅ **РАЗРЕШЕНО:**
- Только Alembic миграции (`backend/db/migrations/`)

См. полные правила в `CLAUDE.md`.
