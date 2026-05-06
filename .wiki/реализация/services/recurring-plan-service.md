---
wiki_sources:
  - "backend/app/services/recurring_plan_service.py"
wiki_updated: 2026-05-06
wiki_status: developing
tags:
  - family-budget
  - implementation
  - source-code
aliases:
  - "Recurring Plan Service"
  - "Сервис повторяющихся транзакций"
---

# Recurring Plan Service — сервис повторяющихся планов

Бизнес-логика для CRUD операций с RecurringPlan и автоматической генерации BudgetFact записей на основе частоты. Горизонт генерации по умолчанию — 90 дней вперёд (`DEFAULT_GENERATION_HORIZON_DAYS`).

## Основные характеристики

**Импортируемые модели:** `RecurringPlan`, `BudgetFact`, `ScheduledReminder`, `Article`, `FinancialCenter`, `CostCenter`

**Константы:**
- `DEFAULT_GENERATION_HORIZON_DAYS = 90` — сколько дней вперёд генерировать факты
- `MAX_ITERATIONS = 1000` — защита от infinite loop при генерации

**Функции:**
- `_parse_date_safe(date_str, field_name)` → date; поднимает HTTPException 422 при неверном формате YYYY-MM-DD

**Генерация фактов:**
- Из RecurringPlan создаёт BudgetFact записи с частотой (daily/weekly/monthly/yearly)
- Использует `now_local()`, `now_utc()` из `utils/timezone.py`
- Логика частоты через `and_`, `or_`, `case` из SQLAlchemy

## Связанные концепции

- [[реализация/api/facts-endpoint.md]]
- [[реализация/models/budget-fact.md]]
