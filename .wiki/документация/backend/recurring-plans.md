---
wiki_sources:
  - "docs/architecture/features/recurring-plans.md"
  - "docs/architecture/overview.yaml"
wiki_updated: 2026-05-06
wiki_status: developing
wiki_outgoing_links:
  - "[[аутентификация]]"
  - "[[dexie-module]]"
tags:
  - family-budget
  - architecture
  - backend
aliases:
  - "RecurringPlan"
  - "повторяющиеся планы"
  - "recurring plans"
---

# Recurring Plans — повторяющиеся транзакции

Система автоматического создания повторяющихся транзакций (платежи, доходы) на регулярной основе. Поддерживает три типа периодичности. Доступна с v6.2.0.

## Основные характеристики

**Типы периодичности:**

| Тип | frequency_value | Пример |
|-----|----------------|--------|
| `monthly` | 1–28 (день месяца) | 15 → 15-е каждого месяца |
| `quarterly` | 1–28 (день в янв/апр/июл/окт) | 10 → 10-е каждого квартала |
| `yearly` | 101–1231 (MMDD формат) | 615 → 15 июня каждого года |

**MMDD кодирование (yearly):** `frequency_value = month * 100 + day`. Например, 15 июня = 615, 31 декабря = 1231. February 29 не поддерживается.

## Схема БД (`t_d_recurring_plan`)

```sql
frequency_type  VARCHAR(20) -- 'monthly' | 'quarterly' | 'yearly'
frequency_value INTEGER     -- Кодированный день/дата
start_date      DATE
end_date        DATE        -- Nullable
occurrences_count    INTEGER -- Nullable (null = бессрочно)
occurrences_generated INTEGER DEFAULT 0
amount          DECIMAL(15,2)
record_type     VARCHAR(10)  -- 'plan' | 'fact'
is_active       BOOLEAN
next_generation_date DATE
last_generated_date  DATE
```

## REST API эндпоинты

```
GET    /api/v1/recurring-plans          — Список с пагинацией
POST   /api/v1/recurring-plans          — Создать
PUT    /api/v1/recurring-plans/{id}     — Обновить
DELETE /api/v1/recurring-plans/{id}     — Удалить
POST   /api/v1/recurring-plans/bulk-delete — Массовое удаление (с rollback)
```

**Лимит bulk-delete:** максимум 100 операций за запрос. Атомарный rollback при ошибке.

**Безопасность:** Generic error messages (без технических деталей для клиента), полное логирование ошибок на backend (`exc_info=True`).

## Синхронизация с Dexie (v11.4.6+)

Plans синхронизируются с клиентским Dexie при логине как reference data. Период синхронизации: 1–6 месяцев (настраивается в Dexie Diagnostic Modal).

**API запрос с фильтрацией по дате:**
```
GET /api/v1/recurring-plans?from_date=YYYY-MM-01&to_date=YYYY-MM-31&limit=100
```

Plans загружаются по **полным месяцам** (с 1-го числа по последнее).

## Известные исправления

**v11.4.12 — HTTP 422 (Unprocessable Content):**
- Причина: `referenceSync.ts` отправлял `limit=1000`, превышающий backend-лимит
- Фикс: `limit=100` на frontend; backend-лимит поднят до `le=1000` для консистентности

**NULL handling:** `next_generation_date IS NULL` — планы без даты следующей генерации включаются в sync-диапазон.

## WebSocket события

При batch-удалении планов отправляется одно сводное событие:
```
recurring_plans_batch_deleted: {plan_ids: int[], deleted_count: int}
```
