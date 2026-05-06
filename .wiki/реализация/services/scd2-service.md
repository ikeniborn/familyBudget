---
wiki_sources:
  - "backend/app/services/scd2_service.py"
wiki_updated: 2026-05-06
wiki_status: developing
tags:
  - family-budget
  - implementation
  - source-code
aliases:
  - "SCD2 Service"
  - "Versioning Service"
---

# SCD2 Service — медленно изменяемые измерения (Slowly Changing Dimension Type 2)

Переиспользуемые функции для управления SCD Type 2 версионированием моделей Article и User. Паттерн: каждое обновление создаёт НОВУЮ версию; старая закрывается (`is_current=False, valid_to=now`).

## Основные характеристики

**Константа:** `FAR_FUTURE_DATETIME = datetime(9999, 12, 31, 23:59:59, tzinfo=UTC)` — timezone-aware для предотвращения asyncpg year overflow.

**Функции:**

- `create_new_version(session, old_instance, updates, changed_fields=None, changed_by_user_id=None)` → новая версия
  - Закрывает старую версию: `is_current=False, valid_to=now`
  - Создаёт новую: `is_current=True, valid_from=now, valid_to=FAR_FUTURE`
  - Сохраняет оригинальный `created_at`
  - Атомарная транзакция
  - Генерик T — принимает Article | User

- `get_current_version(session, model_class, business_key_field, business_key_value)` → current | None

- `get_version_at_date(session, model_class, business_key_field, business_key_value, at_date)` → версия на дату

- `get_history(session, model_class, business_key_field, business_key_value)` → все версии по `valid_from`

## Применение в проекте

Используется для Article (статьи доходов/расходов) и User (история профиля через UserHistory). BudgetFact — это не SCD2, это fact table (партицированная по месяцу).

## Связанные концепции

- [[реализация/models/budget-fact.md]]
- [[реализация/models/user.md]]
