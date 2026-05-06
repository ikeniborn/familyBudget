---
wiki_sources:
  - "docs/architecture/features/transfers-system.md"
wiki_updated: 2026-05-06
wiki_status: stub
wiki_outgoing_links:
  - "[[scd-closure-table]]"
tags:
  - family-budget
  - architecture
  - database
  - model
aliases:
  - "t_f_budget_fact"
  - "BudgetFact"
---

# BudgetFact — модель транзакций и переводов

Таблица `t_f_budget_fact` — основное хранилище финансовых фактов (транзакций) и переводов. Используется для хранения как немедленных (fact), так и плановых (plan) записей.

## Основные характеристики

```sql
CREATE TABLE t_f_budget_fact (
    id                    SERIAL PRIMARY KEY,
    user_id               INTEGER NOT NULL,
    article_id            INTEGER NOT NULL,
    financial_center_id   INTEGER,
    cost_center_id        INTEGER,
    amount                NUMERIC(15,2) NOT NULL,
    fact_date             DATE NOT NULL,
    description           TEXT,
    record_type           VARCHAR(20) DEFAULT 'fact',  -- 'fact' | 'plan'
    transfer_id           INTEGER  -- связывает парные записи перевода
);
```

## Поле record_type

| Значение | Описание |
|----------|---------|
| `fact` | Немедленная транзакция с конкретной датой |
| `plan` | Плановая транзакция, `fact_date` = 1-е число месяца |

## Двойная запись при переводах

Каждый перевод создаёт 2 строки, связанных через `transfer_id`:

| Запись | amount | article_id | financial_center_id |
|--------|--------|-----------|-------------------|
| Withdrawal | отрицательная | from_article_id | from_financial_center_id |
| Deposit | положительная | to_article_id | to_financial_center_id |

Это обеспечивает принцип двойной записи (double-entry bookkeeping).

## Дедупликация

Поля `sync_hash` и `content_hash` с UNIQUE constraint используются для предотвращения дублей при offline-синхронизации и повторных запросах.

## Связанные концепции

- [[scd-closure-table]]
