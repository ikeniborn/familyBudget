---
name: API Development
description: Автоматизация создания REST API endpoints для проекта Family Budget
version: 3.0.0
author: Family Budget Team
tags: [api, fastapi, rest, crud, scd-type-2, shared-budget]
dependencies: [db-management]
architecture_refs:
  - $ref: ../../docs/architecture/database/dimensions.yaml
  - $ref: ../../docs/architecture/database/facts.yaml
  - $ref: ../../docs/architecture/endpoints/articles.yaml
  - $ref: ../../docs/architecture/endpoints/facts.yaml
  - $ref: ../../docs/architecture/functionality/budget-management.yaml
  - $ref: ../../docs/architecture/guides/change-checklist.yaml#/checklists/add_endpoint
---

# API Development Skill

Автоматизация создания REST API endpoints с поддержкой SCD Type 2, Shared Family Budget и JWT аутентификации.

## When to Use

- Создать новый REST API endpoint (CRUD)
- Добавить Pydantic схемы для валидации
- Интегрировать с Shared Family Budget моделью
- Генерировать базовые тесты для endpoint

**Автоматически активируется при:**
- "Создай API endpoint для модели X"
- "Добавь CRUD операции для Y"
- "Сделай REST API для управления Z"

## Architecture Context

**References:**
- Database: [$ref](../../docs/architecture/database/dimensions.yaml), [$ref](../../docs/architecture/database/facts.yaml)
- Endpoints: [$ref](../../docs/architecture/endpoints/articles.yaml)
- Guides: [$ref](../../docs/architecture/guides/change-checklist.yaml#/checklists/add_endpoint)

**Key Patterns:**

### Shared Family Budget (CRITICAL!)
**Fact tables**: NO user_id filtering - все видят всё
**Dimension tables**: Admin-only CREATE/UPDATE/DELETE, все читают

Reference: `_shared/validation-logic.md#3-shared-budget-model-consistency`

### SCD Type 2 для Dimensions
Использовать `SCD2Service.create_new_version()` для обновлений

Reference: `_shared/validation-logic.md#5-scd-type-2-update-pattern`

## Commands

### Command: create-endpoint

**Usage:**
```
Создай новый REST API endpoint для модели <ModelName> с операциями <operations>.
Тип таблицы: <dimension|fact>.
```

**What It Does:**
1. Создает endpoint файл в `backend/app/api/v1/endpoints/{model_name}.py`
2. Создает Pydantic схемы в `backend/app/schemas/{model_name}.py`
3. Регистрирует router в `backend/app/api/v1/router.py`
4. Создает базовые unit/integration тесты

**Template Reference:**
- Dimension table: `templates/endpoint-dimension.py`
- Fact table: `templates/endpoint-fact.py`
- Schemas: `templates/schema.py`

**Example Reference:**
- Real Article endpoint: `examples/article-endpoint.md`
- Real BudgetFact endpoint: `examples/fact-endpoint.md`

**Generated Files:**
```
backend/app/api/v1/endpoints/{model_name}.py  # Endpoint
backend/app/schemas/{model_name}.py           # Schemas
tests/unit/test_{model_name}.py               # Unit tests
tests/integration/test_{model_name}_api.py    # Integration tests
```

### Command: create-schemas

**Usage:**
```
Создай Pydantic схемы для модели <ModelName>.
```

**What It Does:**
Создает схемы Create/Update/Response для модели

**Template Reference:**
- `templates/schema.py` - Complete schema template

## Validation Checklist

- [ ] Fact tables: NO user_id filtering (Shared Budget)
- [ ] Dimension tables: Admin-only CREATE/UPDATE/DELETE
- [ ] All async methods have `await`
- [ ] HTTPException used correctly (401/403/404/422)
- [ ] SCD Type 2 для dimension updates (`SCD2Service.create_new_version()`)
- [ ] Dependencies used: `CurrentUser`, `get_session`
- [ ] Router registered in `backend/app/api/v1/router.py`
- [ ] Schemas created (Create/Update/Response)
- [ ] Tests created (unit + integration)
- [ ] Architecture docs updated (`docs/architecture/endpoints/*.yaml`)

## Common Mistakes

**Filtering fact tables by user_id:**
- **Symptom**: Users can't see each other's transactions
- **Fix**: Remove `.where(BudgetFact.user_id == current_user.id)`
- **Reference**: `_shared/validation-logic.md#3`

**Direct UPDATE on dimension table:**
- **Symptom**: SCD Type 2 versioning broken, no history
- **Fix**: Use `SCD2Service.create_new_version()`
- **Reference**: `_shared/validation-logic.md#5`

**Missing await on async methods:**
- **Symptom**: RuntimeWarning, database not updated
- **Fix**: Add `await` before ALL AsyncSession methods
- **Reference**: `_shared/validation-logic.md#1`

## Related Skills

- **db-management**: Create models and migrations first
- **authentication-security**: Add JWT protection if needed
- **testing**: Create comprehensive test coverage
- **advanced-patterns**: Implement SCD Type 2, Shared Budget patterns

## Quick Links

- Change Checklist: [$ref](../../docs/architecture/guides/change-checklist.yaml#/checklists/add_endpoint)
- Endpoint Examples: [$ref](../../docs/architecture/endpoints/_index.yaml)
- API Documentation: `docs/api/API_DOCUMENTATION.md`
