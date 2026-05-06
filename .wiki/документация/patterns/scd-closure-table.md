---
wiki_sources:
  - "docs/prd/06-database-design.md"
  - "docs/architecture/backend/database/hierarchy.yaml"
  - "docs/architecture/overview.yaml"
wiki_updated: 2026-05-06
wiki_status: developing
wiki_outgoing_links: []
tags:
  - family-budget
  - architecture
  - database
  - patterns
aliases:
  - "SCD"
  - "SCD Type 1"
  - "SCD Type 2"
  - "Closure Table"
  - "медленно меняющиеся измерения"
---

# SCD и Closure Table — паттерны базы данных

Два ключевых паттерна БД в Family Budget: SCD (Slowly Changing Dimensions) для историчности данных и Closure Table для эффективных иерархических запросов к категориям бюджета.

## Основные характеристики

### SCD Type 1 (in-place updates)

Применяется для сущностей, где история не нужна. Обновление на месте, стабильный PK.

- Пользователи (`t_d_user`)
- Финансовые центры (`t_d_financial_center`)
- Места затрат (`t_d_cost_center`)

### SCD Type 2 (full history)

Применяется для сущностей, где нужна полная история изменений. Каждое изменение → новая запись с `valid_from`/`valid_to`.

- Статьи расходов (`t_d_article`) — иерархия категорий
- Транзакции (`t_f_budget_fact`) — история изменений

**Паттерн истории:** History-таблицы (`_history`) хранят все предыдущие версии. При каждом UPDATE в основную таблицу вставляется запись в `_history`.

```python
# backend/app/services/ — слой SCD Type 2 реализован в Python service layer
# Не используются DB-триггеры (для портируемости)
```

## Closure Table — иерархия категорий

**Проблема:** Дерево категорий (article hierarchy) требует эффективных запросов вида «все потомки узла» и «все предки».

**Решение:** Closure Table — отдельная таблица со всеми парами (ancestor, descendant) и глубиной:

```typescript
// Индекс в Dexie (client-side)
articleHierarchy: '[ancestor_id+descendant_id], ancestor_id, descendant_id, depth'
```

**Преимущества:**
- O(1) запросы поддерева (vs O(n) для adjacency list с рекурсией)
- O(1) запросы предков
- Эффективная работа с PostgreSQL

**API эндпоинты:**
- `GET /api/v1/articles/{id}/subtree` — все потомки
- `GET /api/v1/articles/{id}/ancestors` — все предки

## Применение в контексте Family Budget

**Star Schema:** Таблица фактов (`t_f_budget_fact`) с FK на dimension-таблицы (articles, financial_centers, cost_centers).

**Таблицы:**
| Таблица | Паттерн | Назначение |
|---------|---------|-----------|
| `t_d_user` | SCD Type 1 | Пользователи |
| `t_d_article` | SCD Type 2 | Категории расходов |
| `t_d_article_hierarchy` | Closure Table | Иерархия категорий |
| `t_f_budget_fact` | Fact table | Транзакции |
| `t_f_budget_fact_history` | History | История изменений фактов |
| `t_d_recurring_plan` | SCD Type 1 | Повторяющиеся планы |

**Именование:** Таблицы-факты с префиксом `t_f_`, dimension-таблицы — `t_f_d_` или `t_d_`.
