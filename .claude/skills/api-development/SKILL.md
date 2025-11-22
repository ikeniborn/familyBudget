---
name: API Development
description: Автоматизация создания REST API endpoints для проекта Family Budget
version: 2.0.0
author: Family Budget Team
tags: [api, fastapi, rest, crud, scd-type-2, shared-budget]
dependencies: [db-management]
---

# API Development Skill

Автоматизация создания REST API endpoints для проекта Family Budget с поддержкой SCD Type 2, Shared Family Budget модели и JWT аутентификации.

## Когда использовать этот скил

Используй этот скил когда нужно:
- Создать новый REST API endpoint (CRUD)
- Добавить Pydantic схемы для валидации
- Создать SQLModel модель с SCD Type 2
- Интегрировать с Shared Family Budget моделью
- Генерировать базовые тесты для endpoint

Скил автоматически вызывается при запросах типа:
- "Создай API endpoint для модели X"
- "Добавь CRUD операции для Y"
- "Сделай REST API для управления Z"

## Контекст проекта

Проект использует:
- **FastAPI 0.115+** для REST API
- **SQLModel 0.0.14** для моделей базы данных
- **Pydantic v2** для валидации запросов/ответов
- **Async SQLAlchemy** для асинхронных операций с БД
- **SCD Type 2** для dimension таблиц (историческое отслеживание изменений)
- **Shared Family Budget** модель - ВСЕ пользователи видят ВСЕ транзакции (2-5 человек)

## Архитектурные требования

### Shared Family Budget Model (КРИТИЧНО!)

**ВАЖНО:** Проект реализует **Shared Family Budget** для 2-5 пользователей семьи.

**Правила для Fact таблиц (t_f_registry):**
- ❌ **НЕ фильтровать по user_id** - все видят все транзакции
- ❌ **НЕ проверять ownership** - любой может редактировать/удалять
- ✅ **user_id только для audit trail** - кто создал/изменил запись
- ✅ **Полная прозрачность** - все расходы/доходы видны всем

**Правила для Dimension таблиц (справочники):**
- ✅ **CREATE/UPDATE/DELETE только админы** - централизованное управление
- ✅ **READ все пользователи** - используют общие справочники
- ✅ **user_id для audit trail** - кто создал справочник
- ❌ **НЕ фильтровать по user_id при GET** - все видят все справочники

```python
# ✅ ПРАВИЛЬНО - Fact таблицы (БЕЗ user_id filter)
@router.get("/facts")
async def list_facts(session: AsyncSession):
    statement = select(BudgetFact)  # NO user_id filter!
    facts = await session.exec(statement).all()
    return facts

# ✅ ПРАВИЛЬНО - Dimension таблицы (БЕЗ user_id filter для READ)
@router.get("/articles")
async def list_articles(session: AsyncSession):
    statement = select(Article).where(Article.is_current == True)
    # NO user_id filter - все видят все статьи
    articles = await session.exec(statement).all()
    return articles

# ✅ ПРАВИЛЬНО - Dimension CREATE (только admin)
@router.post("/articles")
async def create_article(data: ArticleCreate, current_user: CurrentUser):
    if not current_user.is_admin:
        raise HTTPException(403, "Only admins can create articles")
    article = Article(**data.model_dump(), user_id=current_user.id)
    # ... create logic

# ❌ НЕПРАВИЛЬНО - НЕ ДЕЛАЙ ТАК!
@router.get("/facts")
async def list_facts(current_user: CurrentUser, session: AsyncSession):
    statement = select(BudgetFact).where(
        BudgetFact.user_id == current_user.id  # WRONG! Нарушает Shared Budget
    )
    return await session.exec(statement).all()
```

### Обязательные паттерны:

1. **Shared Family Budget** - НЕ фильтровать fact таблицы по user_id:
   ```python
   # Fact tables - NO user_id filter
   stmt = select(BudgetFact)  # All users see all facts

   # Dimension tables - NO user_id filter for READ
   stmt = select(Article).where(Article.is_current == True)
   ```

2. **SCD Type 2 Updates** - использовать `SCD2Service.create_new_version()`:
   ```python
   from backend.app.services.scd2_service import create_new_version, has_changes

   changed, fields = has_changes(old_instance, updates)
   if changed:
       new_instance = await create_new_version(
           session=session,
           old_instance=old_instance,
           updates=updates,
           changed_fields=fields
       )
   ```

3. **Dependencies** - использовать стандартные зависимости:
   ```python
   from backend.app.core.dependencies import (
       CurrentUser,  # JWT auth, extracted from cookie/header
       get_session,  # Async database session
   )
   ```

4. **Exception Handling** - использовать FastAPI HTTPException:
   ```python
   from fastapi import HTTPException, status

   # Not found
   raise HTTPException(status.HTTP_404_NOT_FOUND, "Resource not found")

   # Forbidden (admin only)
   raise HTTPException(status.HTTP_403_FORBIDDEN, "Admin access required")

   # Unauthorized
   raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Authentication required")
   ```

5. **Admin-only operations** для dimension таблиц:
   ```python
   @router.post("/articles")
   async def create_article(data: ArticleCreate, current_user: CurrentUser):
       if not current_user.is_admin:
           raise HTTPException(403, "Only admins can create articles")
       # ... create logic
   ```

## Команда: create-endpoint

Создать новый CRUD endpoint с соблюдением архитектуры проекта.

### Использование

Для создания нового endpoint используйте описание:
```
Создай новый REST API endpoint для модели <ModelName> с операциями <operations>.
Используй SCD Type 2 для обновлений (если dimension), учти Shared Family Budget модель.
```

### Параметры (указываются в запросе)

- **ModelName**: Название модели (PascalCase, например: Article, BudgetFact)
- **operations**: Список операций (например: create, read, update, delete, list)
- **table_type**: Тип таблицы (dimension|fact)
- **admin_only**: Ограничить CREATE/UPDATE/DELETE только для админов (для dimension таблиц)

### Что делает

1. **Создает endpoint файл** в `backend/app/api/v1/endpoints/{model_name}.py`:
   - POST endpoint для создания (admin-only для dimension)
   - GET /{id} endpoint для получения одной записи
   - GET / endpoint для списка (с пагинацией, БЕЗ user_id фильтра)
   - PUT /{id} endpoint для обновления (SCD Type 2 для dimension, admin-only)
   - DELETE /{id} endpoint для удаления (admin-only для dimension)
   - **БЕЗ user_id фильтрации** - Shared Family Budget

2. **Создает Pydantic схемы** в `backend/app/schemas/{model_name}.py`:
   - `{Model}Create` - для создания
   - `{Model}Update` - для обновления
   - `{Model}Response` - для ответов
   - `{Model}ListResponse` - для списка с пагинацией

3. **Регистрирует router** в `backend/app/api/v1/router.py`:
   ```python
   from backend.app.api.v1.endpoints import {model_name}

   api_router.include_router(
       {model_name}.router,
       prefix="/{model_name}s",
       tags=["{ModelName}s"]
   )
   ```

4. **Создает базовые unit тесты** в `tests/endpoints/test_{model_name}.py`

5. **Создает integration тесты** в `tests/integration/test_{model_name}_workflow.py`

### Шаблон CRUD Endpoint (Dimension Table)

```python
"""
{ModelName} CRUD endpoints (Dimension Table with SCD Type 2).

Implements CRUD operations for {model_name} with SCD Type 2 versioning.

Features:
    - Shared Family Budget (NO user_id filtering for GET)
    - Admin-only CREATE/UPDATE/DELETE
    - SCD Type 2 updates (new version on each change)
    - user_id for audit trail only
"""

from typing import Annotated
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlmodel import select, func
from sqlmodel.ext.asyncio.session import AsyncSession

from backend.app.core.dependencies import CurrentUser, get_session
from backend.app.models.{model_name} import {ModelName}
from backend.app.schemas.{model_name} import (
    {ModelName}Create,
    {ModelName}Update,
    {ModelName}Response,
    {ModelName}ListResponse,
)
from backend.app.services.scd2_service import (
    create_new_version,
    has_changes,
)

router = APIRouter(prefix="/{model_name}s", tags=["{ModelName}s"])


@router.post(
    "",
    response_model={ModelName}Response,
    status_code=status.HTTP_201_CREATED,
)
async def create_{model_name}(
    data: {ModelName}Create,
    current_user: CurrentUser,
    session: AsyncSession = Depends(get_session),
) -> {ModelName}:
    """
    Create a new {model_name} (ADMIN ONLY).

    **Shared Family Budget:**
    - Only admins can create dimension records
    - user_id stored for audit trail (who created)
    - All users can view this record (no isolation)

    **Returns:**
    - 201 Created: {ModelName} created successfully
    - 401 Unauthorized: User not authenticated
    - 403 Forbidden: Non-admin user
    """
    # Validate: Only admins can create dimensions
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can create {model_name}s"
        )

    # Create new instance
    instance = {ModelName}(
        **data.model_dump(),
        user_id=current_user.id,  # Audit trail only
        is_current=True,
        valid_from=datetime.utcnow(),
        valid_to=datetime(9999, 12, 31, 23, 59, 59),
    )

    session.add(instance)
    await session.commit()
    await session.refresh(instance)

    return instance


@router.get(
    "/{{{model_name}_id}}",
    response_model={ModelName}Response,
)
async def get_{model_name}(
    {model_name}_id: int,
    current_user: CurrentUser,
    session: AsyncSession = Depends(get_session),
) -> {ModelName}:
    """
    Get a single {model_name} by ID.

    **Shared Family Budget:**
    - NO user_id filtering - all users see all records
    - Only checks is_current=true (SCD Type 2)

    **Returns:**
    - 200 OK: {ModelName} found
    - 401 Unauthorized: User not authenticated
    - 404 Not Found: {ModelName} not found
    """
    # NO user_id filter - Shared Family Budget
    stmt = select({ModelName}).where(
        {ModelName}.id == {model_name}_id,
        {ModelName}.is_current == True  # noqa: E712
    )

    result = await session.execute(stmt)
    instance = result.scalar_one_or_none()

    if not instance:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"{ModelName} with id={{{model_name}_id}} not found"
        )

    return instance


@router.get(
    "",
    response_model={ModelName}ListResponse,
)
async def list_{model_name}s(
    current_user: CurrentUser,
    session: AsyncSession = Depends(get_session),
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(100, ge=1, le=1000, description="Maximum records to return"),
) -> {ModelName}ListResponse:
    """
    List {model_name}s with pagination.

    **Shared Family Budget:**
    - NO user_id filtering - all users see all records
    - Returns all current (is_current=true) records

    **Returns:**
    - 200 OK: List of {model_name}s
    - 401 Unauthorized: User not authenticated
    """
    # NO user_id filter - Shared Family Budget
    stmt = select({ModelName}).where({ModelName}.is_current == True)  # noqa: E712

    # Count total
    count_stmt = select(func.count()).select_from(stmt.subquery())
    count_result = await session.execute(count_stmt)
    total = count_result.scalar_one()

    # Apply pagination
    stmt = stmt.offset(skip).limit(limit)

    result = await session.execute(stmt)
    items = list(result.scalars().all())

    return {ModelName}ListResponse(
        items=items,
        total=total,
        skip=skip,
        limit=limit,
    )


@router.put(
    "/{{{model_name}_id}}",
    response_model={ModelName}Response,
)
async def update_{model_name}(
    {model_name}_id: int,
    updates: {ModelName}Update,
    current_user: CurrentUser,
    session: AsyncSession = Depends(get_session),
) -> {ModelName}:
    """
    Update a {model_name} (creates new SCD Type 2 version, ADMIN ONLY).

    **SCD Type 2:**
    - Creates new version with is_current=True
    - Old version: is_current=False, valid_to=now()
    - Preserves complete audit trail

    **Shared Family Budget:**
    - Only admins can update dimensions
    - NO ownership check - any admin can update any record

    **Returns:**
    - 200 OK: {ModelName} updated successfully (new version created)
    - 401 Unauthorized: User not authenticated
    - 403 Forbidden: Non-admin user
    - 404 Not Found: {ModelName} not found
    """
    # Validate: Only admins can update dimensions
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can update {model_name}s"
        )

    # Get current version (NO user_id filter - Shared Budget)
    stmt = select({ModelName}).where(
        {ModelName}.id == {model_name}_id,
        {ModelName}.is_current == True  # noqa: E712
    )
    result = await session.execute(stmt)
    instance = result.scalar_one_or_none()

    if not instance:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"{ModelName} with id={{{model_name}_id}} not found"
        )

    # Check if anything actually changed
    update_dict = updates.model_dump(exclude_unset=True)
    changed, changed_fields = has_changes(instance, update_dict)

    if not changed:
        # No changes, return current version
        return instance

    # Create new SCD Type 2 version
    new_instance = await create_new_version(
        session=session,
        old_instance=instance,
        updates=update_dict,
        changed_fields=changed_fields,
    )

    return new_instance


@router.delete(
    "/{{{model_name}_id}}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_{model_name}(
    {model_name}_id: int,
    current_user: CurrentUser,
    session: AsyncSession = Depends(get_session),
) -> None:
    """
    Delete a {model_name} (soft delete - sets is_current=False, ADMIN ONLY).

    **Shared Family Budget:**
    - Only admins can delete dimensions
    - NO ownership check - any admin can delete any record

    **Returns:**
    - 204 No Content: {ModelName} deleted successfully
    - 401 Unauthorized: User not authenticated
    - 403 Forbidden: Non-admin user
    - 404 Not Found: {ModelName} not found
    """
    # Validate: Only admins can delete dimensions
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can delete {model_name}s"
        )

    # Get current version (NO user_id filter - Shared Budget)
    stmt = select({ModelName}).where(
        {ModelName}.id == {model_name}_id,
        {ModelName}.is_current == True  # noqa: E712
    )
    result = await session.execute(stmt)
    instance = result.scalar_one_or_none()

    if not instance:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"{ModelName} with id={{{model_name}_id}} not found"
        )

    # Soft delete (SCD Type 2: close current version)
    instance.is_current = False
    instance.valid_to = datetime.utcnow()
    instance.updated_at = datetime.utcnow()

    await session.commit()
```

### Шаблон CRUD Endpoint (Fact Table)

```python
"""
{ModelName} CRUD endpoints (Fact Table - NO SCD Type 2).

Implements CRUD operations for {model_name} fact records.

Features:
    - Shared Family Budget (NO user_id filtering)
    - ANY user can create/update/delete ANY record
    - user_id for audit trail only
    - Regular UPDATE (not SCD Type 2)
"""

@router.post("", response_model={ModelName}Response, status_code=status.HTTP_201_CREATED)
async def create_{model_name}(
    data: {ModelName}Create,
    current_user: CurrentUser,
    session: AsyncSession = Depends(get_session),
) -> {ModelName}:
    """
    Create a new {model_name} fact record.

    **Shared Family Budget:**
    - Any authenticated user can create
    - user_id stored for audit trail (who created)
    - Record visible to ALL users
    """
    instance = {ModelName}(
        **data.model_dump(),
        user_id=current_user.id,  # Audit trail only
    )

    session.add(instance)
    await session.commit()
    await session.refresh(instance)

    return instance


@router.get("", response_model={ModelName}ListResponse)
async def list_{model_name}s(
    current_user: CurrentUser,
    session: AsyncSession = Depends(get_session),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
) -> {ModelName}ListResponse:
    """
    List all {model_name} fact records with pagination.

    **Shared Family Budget:**
    - NO user_id filtering - all users see all records
    """
    # NO user_id filter - Shared Family Budget
    stmt = select({ModelName})

    # Count total
    count_stmt = select(func.count()).select_from(stmt.subquery())
    count_result = await session.execute(count_stmt)
    total = count_result.scalar_one()

    # Apply pagination
    stmt = stmt.offset(skip).limit(limit)

    result = await session.execute(stmt)
    items = list(result.scalars().all())

    return {ModelName}ListResponse(
        items=items,
        total=total,
        skip=skip,
        limit=limit,
    )


@router.put("/{{{model_name}_id}}", response_model={ModelName}Response)
async def update_{model_name}(
    {model_name}_id: int,
    updates: {ModelName}Update,
    current_user: CurrentUser,
    session: AsyncSession = Depends(get_session),
) -> {ModelName}:
    """
    Update a {model_name} fact record (regular UPDATE, not SCD Type 2).

    **Shared Family Budget:**
    - Any user can update any record
    - NO ownership check - full transparency
    """
    # Get record (NO user_id filter - Shared Budget)
    stmt = select({ModelName}).where({ModelName}.id == {model_name}_id)
    result = await session.execute(stmt)
    instance = result.scalar_one_or_none()

    if not instance:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"{ModelName} with id={{{model_name}_id}} not found"
        )

    # Update fields (regular UPDATE, not SCD Type 2)
    update_dict = updates.model_dump(exclude_unset=True)
    for key, value in update_dict.items():
        setattr(instance, key, value)

    instance.updated_at = datetime.utcnow()

    await session.commit()
    await session.refresh(instance)

    return instance


@router.delete("/{{{model_name}_id}}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_{model_name}(
    {model_name}_id: int,
    current_user: CurrentUser,
    session: AsyncSession = Depends(get_session),
) -> None:
    """
    Delete a {model_name} fact record (hard delete).

    **Shared Family Budget:**
    - Any user can delete any record
    - NO ownership check - full transparency
    """
    # Get record (NO user_id filter - Shared Budget)
    stmt = select({ModelName}).where({ModelName}.id == {model_name}_id)
    result = await session.execute(stmt)
    instance = result.scalar_one_or_none()

    if not instance:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"{ModelName} with id={{{model_name}_id}} not found"
        )

    # Hard delete (fact table)
    await session.delete(instance)
    await session.commit()
```

## Проверочный чеклист

После создания endpoint проверь:

- [ ] Endpoint файл создан в `backend/app/api/v1/endpoints/{model_name}.py`
- [ ] Схемы созданы в `backend/app/schemas/{model_name}.py`
- [ ] Router зарегистрирован в `backend/app/api/v1/router.py`
- [ ] Добавлены dependencies: `CurrentUser`, `get_session`
- [ ] **КРИТИЧНО:** БЕЗ user_id фильтрации в GET endpoints (Shared Family Budget)
- [ ] Dimension tables: admin-only для CREATE/UPDATE/DELETE
- [ ] Dimension tables: UPDATE использует SCD Type 2 (`create_new_version()`)
- [ ] Dimension tables: DELETE делает soft delete (is_current=False)
- [ ] Fact tables: обычный UPDATE (НЕ SCD Type 2)
- [ ] Fact tables: hard delete (или soft delete с deleted_at)
- [ ] Созданы базовые unit тесты
- [ ] OpenAPI документация доступна в `/docs`
- [ ] Все endpoints возвращают корректные HTTP статусы
- [ ] Добавлена обработка ошибок (404, 403, 401, 422)

## Связанные скилы

- **db-management**: для создания миграций и моделей
- **testing**: для создания integration и e2e тестов
- **bot-development**: для интеграции с Telegram Bot

## Примеры использования

### Пример 1: Создать CRUD для dimension таблицы

```
Создай REST API endpoint для модели "FinancialCenter" (ЦФО) с операциями create, read, update, delete, list.
Это dimension таблица с SCD Type 2.
Используй Shared Family Budget модель (без user_id фильтрации для GET).
CREATE/UPDATE/DELETE только для админов.
```

### Пример 2: Создать CRUD для fact таблицы

```
Создай REST API endpoint для модели "BudgetFact" (транзакции) с операциями create, read, update, delete, list.
Это fact таблица БЕЗ SCD Type 2 (regular UPDATE).
Используй Shared Family Budget модель - любой может создавать/редактировать/удалять записи.
```

### Пример 3: Создать read-only endpoint для аналитики

```
Создай GET endpoint для аналитики "/api/v1/analytics/plan-vs-fact".
Возвращает сводку план vs факт за указанный период.
Параметры: period_id (required), article_id (optional для группировки).
Только аутентифицированные пользователи, без user_id фильтрации.
```

## Часто задаваемые вопросы

**Q: Когда использовать SCD Type 2, а когда обычный UPDATE?**

A: SCD Type 2 используй для dimension таблиц (Article, FinancialCenter, CostCenter, Period), где нужна история изменений. Для fact таблиц (BudgetFact) используй обычный UPDATE.

**Q: Почему нет user_id фильтрации?**

A: Проект реализует Shared Family Budget для 2-5 пользователей. Полная прозрачность - все видят все транзакции и справочники. user_id используется только для audit trail (кто создал/изменил).

**Q: Как добавить дополнительные фильтры в list endpoint?**

A: Добавь Query параметры:
```python
@router.get("")
async def list_items(
    name: Optional[str] = Query(None, description="Filter by name"),
    ...
):
    stmt = select(Model).where(Model.is_current == True)
    if name:
        stmt = stmt.where(Model.name.ilike(f"%{name}%"))
```

**Q: Как реализовать bulk операции?**

A: Создай отдельный endpoint с массивом данных:
```python
@router.post("/bulk", status_code=status.HTTP_201_CREATED)
async def create_bulk(items: list[{ModelName}Create], current_user: CurrentUser):
    if not current_user.is_admin:  # For dimensions
        raise HTTPException(403, "Admin only")

    created = []
    for item in items:
        instance = {ModelName}(**item.model_dump(), user_id=current_user.id)
        session.add(instance)
        created.append(instance)
    await session.commit()
    return created
```
