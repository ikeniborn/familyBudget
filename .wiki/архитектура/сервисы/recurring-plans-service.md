---
wiki_sources: ["docs/architecture/features/recurring-plans.md"]
wiki_updated: 2026-05-05
wiki_status: developing
tags: ["FastAPI", "PostgreSQL"]
aliases: ["Recurring Plans", "Повторяющиеся планы", "MMDD encoding"]
---

# Recurring Plans Service

Сервис автоматического создания повторяющихся транзакций (платежей, доходов). Поддерживает три типа периодичности: ежемесячно, ежеквартально, ежегодно.

## Основные характеристики

### Типы периодичности

| Тип | frequency_value | Пример |
|-----|----------------|--------|
| monthly | 1–28 (день месяца) | `15` → 15-го каждого месяца |
| quarterly | 1–28 (день месяца) | `10` → 10-го января/апреля/июля/октября |
| yearly | 101–1231 (MMDD) | `615` → 15 июня каждого года |

### MMDD кодирование (yearly)

`frequency_value = month × 100 + day`

Примеры: `115` → 15 января, `1231` → 31 декабря. February 29 не поддерживается.

### Схема БД

Ключевые поля таблицы `t_d_recurring_plan`:
- `frequency_type`, `frequency_value` — конфигурация периодичности
- `next_generation_date` — дата следующей генерации
- `occurrences_count` / `occurrences_generated` — лимит повторений
- `is_active` — активность плана

### Валидация (v11.4.6)

Добавлена Pydantic-модель `RecurringPlanListParams` с:
- Проверкой формата даты (паттерн `^\d{4}-\d{2}-\d{2}$`)
- `@field_validator`: `from_date <= to_date`
- `_parse_date_safe()` — возвращает HTTP 422 (не 500) при невалидных датах

### Sync Period (v11.5.0)

Планы синхронизируются по **полным месяцам** (с 1-го по последнее число). Настраивается в Dexie Diagnostic Modal: 1–6 месяцев. По умолчанию — 3 месяца.

## Связанные концепции

- [[offline-first]]
- [[transfer-service]]
