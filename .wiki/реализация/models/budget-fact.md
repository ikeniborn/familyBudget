---
wiki_sources:
  - "backend/app/models/fact.py"
wiki_updated: 2026-05-06
wiki_status: mature
wiki_outgoing_links:
  - "реализация/api/facts-endpoint.md"
tags:
  - family-budget
  - implementation
  - db-model
  - fact-table
  - partitioning
aliases:
  - "BudgetFact"
  - "t_f_budget_fact"
  - "Fact"
---

# BudgetFact — модель транзакций (Fact Table)

`backend/app/models/fact.py` — SQLModel-модель основной таблицы транзакций.

## Таблица: `t_f_budget_fact`

**Паттерн**: Star schema Fact Table, партицирована по месяцам на уровне PostgreSQL.

## Поля

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | BIGSERIAL PK | Auto-increment (не UUID — из-за партицирования) |
| `user_id` | FK → t_d_user.id | Создатель транзакции |
| `article_id` | FK → t_d_article.id | Статья/категория бюджета |
| `financial_center_id` | FK → t_d_financial_center.id | Счёт (необязательное) |
| `cost_center_id` | FK → t_d_cost_center.id | Место затрат (необязательное) |
| `fact_date` | DATE | Дата транзакции (ключ партиции) |
| `amount` | BIGINT | Сумма в рублях, всегда положительная |
| `description` | TEXT | Описание (необязательное) |
| `record_type` | VARCHAR(10) | `"fact"` или `"plan"` |
| `transfer_id` | INT | Связь с парным фактом при переводе |
| `recurring_plan_id` | INT | Ссылка на шаблон (без FK — партицирование) |
| `is_offline_sync` | BOOL | Создан через offline sync |
| `content_hash` | VARCHAR(32) | MD5 контента для дедупликации |
| `sync_hash` | VARCHAR(32) | MD5 для offline sync дедупликации |
| `created_at` | DATETIME | Время создания |
| `updated_at` | DATETIME | Время обновления |

## Важные особенности

### Партицирование (372+ партиции)
Таблица партицирована по `fact_date` (ежемесячно). Без `fact_date` в WHERE PostgreSQL сканирует все партиции (Planning Time ~2.6с). С `fact_date` → ~35мс.

**Two-phase query** в эндпоинтах:
```python
# 1. Получить fact_date
fact_date = await _get_fact_date(session, fact_id)
# 2. Полный запрос с fact_date для partition pruning
stmt = select(...).where(BudgetFact.id == fact_id, BudgetFact.fact_date == fact_date)
```

### Хранение суммы
- `amount` всегда положительный (`abs(amount)` при записи)
- Знак определяется через `Article.type` (income/expense/debit/credit)

### Дедупликация offline sync
- `sync_hash = MD5(content_hash|user_id|created_date)`
- При повторной синхронизации в течение 24ч — возвращается существующая запись

### Нет FK на `recurring_plan_id`
Из-за партицирования PostgreSQL не поддерживает FK на партицированных таблицах. Ссылка хранится как обычный INT.

### Нет SCD Type 2
Факты обновляются in-place (UPDATE). История хранится в `BudgetFactHistory` через явное создание записей при каждой мутации.

### Transfer support
`transfer_id` связывает два факта (expense + income) при переводе между счетами. Оба удаляются каскадно при удалении одного.

## Alias
```python
Fact = BudgetFact  # backward compatibility для старых тестов
```
