---
name: API Development
description: Автоматизация создания REST API endpoints для проекта Family Budget
version: 1.0.0
author: Family Budget Team
tags: [api, fastapi, rest, crud, scd-type-2]
dependencies: [db-management]
---

# API Development Skill

Автоматизация создания REST API endpoints для проекта Family Budget с поддержкой SCD Type 2, user isolation и JWT аутентификации.

## Когда использовать этот скил

Используй этот скил когда нужно:
- Создать новый REST API endpoint (CRUD)
- Добавить Pydantic схемы для валидации
- Создать SQLModel модель с user isolation
- Интегрировать SCD Type 2 паттерн
- Генерировать базовые тесты для endpoint

Скил автоматически вызывается при запросах типа:
- "Создай API endpoint для модели X"
- "Добавь CRUD операции для Y"
- "Сделай REST API для управления Z"

## Контекст проекта

Проект использует:
- **FastAPI** для REST API
- **SQLModel** для моделей базы данных
- **Pydantic** для валидации запросов/ответов
- **Async SQLAlchemy** для асинхронных операций с БД
- **SCD Type 2** для dimension таблиц (историческое отслеживание изменений)
- **User Data Isolation** - каждый пользователь видит только свои данные

## Архитектурные требования

### Обязательные паттерны:

1. **User Data Isolation** - ВСЕГДА фильтровать по `current_user.id`:
   ```python
   stmt = select(Model).where(Model.user_id == current_user.id)
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
       CurrentUser,
       get_session,
       apply_user_filter,
       ensure_user_owns_resource
   )
   ```

4. **Exception Handling** - использовать кастомные исключения:
   ```python
   from backend.app.core.exceptions import (
       NotFoundException,
       ForbiddenException,
       ValidationException
   )
   ```

## Команда: create-endpoint

Создать новый CRUD endpoint с соблюдением архитектуры проекта.

### Использование

Для создания нового endpoint используйте описание:
```
Создай новый REST API endpoint для модели <ModelName> с операциями <operations>.
Используй SCD Type 2 для обновлений, добавь user isolation и JWT аутентификацию.
```

### Параметры (указываются в запросе)

- **ModelName**: Название модели (PascalCase, например: Budget, Transaction)
- **operations**: Список операций (например: create, read, update, delete, list)
- **auth_type**: Тип аутентификации (required|admin|optional)
- **isolation**: Тип изоляции данных (user|global|none)
- **parent_model**: Родительская модель для иерархии (опционально)

### Что делает

1. **Создает endpoint файл** в `backend/app/api/v1/endpoints/{model_name}.py`:
   - POST endpoint для создания
   - GET /{id} endpoint для получения одной записи
   - GET / endpoint для списка (с пагинацией)
   - PUT /{id} endpoint для обновления (SCD Type 2)
   - DELETE /{id} endpoint для мягкого удаления
   - Все endpoints с user isolation фильтрами

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

4. **Создает базовые unit тесты** в `backend/tests/endpoints/test_{model_name}.py`

5. **Создает integration тесты** в `backend/tests/integration/test_{model_name}_workflow.py`

### Шаблон CRUD Endpoint

```python
"""
{ModelName} CRUD endpoints.

Implements CRUD operations for {model_name} with SCD Type 2 versioning.

Features:
    - User data isolation
    - Admin bypass (admins see all records)
    - SCD Type 2 updates
    - Soft delete
"""

from typing import Annotated

from fastapi import APIRouter, Depends, Query, status
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from backend.app.core.dependencies import (
    CurrentUser,
    get_session,
    apply_user_filter,
)
from backend.app.core.exceptions import NotFoundException
from backend.app.models.{model_name} import {ModelName}
from backend.app.schemas import get_common_responses
from backend.app.schemas.{model_name} import (
    {ModelName}Create,
    {ModelName}Update,
    {ModelName}Response,
    {ModelName}ListResponse,
)
from backend.app.services.scd2_service import (
    create_new_version,
    get_current_version,
    has_changes,
)

router = APIRouter(prefix="/{model_name}s", tags=["{ModelName}s"])


@router.post(
    "",
    response_model={ModelName}Response,
    status_code=status.HTTP_201_CREATED,
    responses=get_common_responses(include_401=True, include_403=True),
)
async def create_{model_name}(
    data: {ModelName}Create,
    current_user: CurrentUser,
    session: AsyncSession = Depends(get_session),
) -> {ModelName}:
    """
    Create a new {model_name}.

    **User Isolation:**
    - {ModelName} is created with current user as owner
    - Global {model_name}s (is_global=True) can only be created by admins

    **Returns:**
    - 201 Created: {ModelName} created successfully
    - 401 Unauthorized: User not authenticated
    - 403 Forbidden: Non-admin trying to create global {model_name}
    """
    # Validate: Only admins can create global items
    if hasattr(data, 'is_global') and data.is_global and not current_user.is_admin:
        raise ForbiddenException("Only admins can create global {model_name}s")

    # Create new instance
    instance = {ModelName}(
        **data.model_dump(),
        user_id=current_user.id,
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
    responses=get_common_responses(include_401=True, include_404=True),
)
async def get_{model_name}(
    {model_name}_id: int,
    current_user: CurrentUser,
    session: AsyncSession = Depends(get_session),
) -> {ModelName}:
    """
    Get a single {model_name} by ID.

    **User Isolation:**
    - Users can only see their own {model_name}s
    - Admins can see all {model_name}s

    **Returns:**
    - 200 OK: {ModelName} found
    - 401 Unauthorized: User not authenticated
    - 404 Not Found: {ModelName} not found or access denied
    """
    # Build query with user isolation
    stmt = select({ModelName}).where(
        {ModelName}.id == {model_name}_id,
        {ModelName}.is_current == True  # noqa: E712
    )

    # Apply user filter (allows admins to bypass)
    stmt = apply_user_filter(stmt, {ModelName}, current_user)

    result = await session.execute(stmt)
    instance = result.scalar_one_or_none()

    if not instance:
        raise NotFoundException(f"{ModelName} with id={{{model_name}_id}} not found")

    return instance


@router.get(
    "",
    response_model={ModelName}ListResponse,
    responses=get_common_responses(include_401=True),
)
async def list_{model_name}s(
    current_user: CurrentUser,
    session: AsyncSession = Depends(get_session),
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(100, ge=1, le=1000, description="Maximum number of records to return"),
) -> {ModelName}ListResponse:
    """
    List {model_name}s with pagination.

    **User Isolation:**
    - Users see only their own {model_name}s + global {model_name}s
    - Admins see all {model_name}s

    **Returns:**
    - 200 OK: List of {model_name}s
    - 401 Unauthorized: User not authenticated
    """
    # Build query with user isolation
    stmt = select({ModelName}).where({ModelName}.is_current == True)  # noqa: E712
    stmt = apply_user_filter(stmt, {ModelName}, current_user)

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
    responses=get_common_responses(include_401=True, include_404=True),
)
async def update_{model_name}(
    {model_name}_id: int,
    updates: {ModelName}Update,
    current_user: CurrentUser,
    session: AsyncSession = Depends(get_session),
) -> {ModelName}:
    """
    Update a {model_name} (creates new SCD Type 2 version).

    **SCD Type 2:**
    - Creates new version with is_current=True
    - Old version: is_current=False, valid_to=now()
    - Preserves complete audit trail

    **User Isolation:**
    - Users can only update their own {model_name}s
    - Admins can update all {model_name}s

    **Returns:**
    - 200 OK: {ModelName} updated successfully (new version created)
    - 401 Unauthorized: User not authenticated
    - 404 Not Found: {ModelName} not found or access denied
    """
    # Get current version with user isolation
    instance = await get_current_version(
        session=session,
        model_class={ModelName},
        id={model_name}_id,
        user_id=None if current_user.is_admin else current_user.id,
    )

    if not instance:
        raise NotFoundException(f"{ModelName} with id={{{model_name}_id}} not found")

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
    responses=get_common_responses(include_401=True, include_404=True),
)
async def delete_{model_name}(
    {model_name}_id: int,
    current_user: CurrentUser,
    session: AsyncSession = Depends(get_session),
) -> None:
    """
    Delete a {model_name} (soft delete - sets is_current=False).

    **User Isolation:**
    - Users can only delete their own {model_name}s
    - Admins can delete all {model_name}s

    **Returns:**
    - 204 No Content: {ModelName} deleted successfully
    - 401 Unauthorized: User not authenticated
    - 404 Not Found: {ModelName} not found or access denied
    """
    # Get current version with user isolation
    instance = await get_current_version(
        session=session,
        model_class={ModelName},
        id={model_name}_id,
        user_id=None if current_user.is_admin else current_user.id,
    )

    if not instance:
        raise NotFoundException(f"{ModelName} with id={{{model_name}_id}} not found")

    # Soft delete (SCD Type 2: close current version)
    instance.is_current = False
    instance.valid_to = datetime.utcnow()
    instance.updated_at = datetime.utcnow()

    await session.commit()
```

### Шаблон Pydantic схем

```python
"""
{ModelName} Pydantic schemas for request/response validation.
"""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class {ModelName}Base(BaseModel):
    """Base schema with common fields."""

    name: str = Field(..., min_length=1, max_length=255, description="{ModelName} name")
    description: Optional[str] = Field(None, max_length=1000, description="Description")


class {ModelName}Create({ModelName}Base):
    """Schema for creating a {model_name}."""

    is_global: bool = Field(False, description="Is this a global {model_name}?")


class {ModelName}Update(BaseModel):
    """Schema for updating a {model_name}."""

    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = Field(None, max_length=1000)


class {ModelName}Response({ModelName}Base):
    """Schema for {model_name} response."""

    id: int
    user_id: int
    is_global: bool
    is_current: bool
    valid_from: datetime
    valid_to: datetime
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class {ModelName}ListResponse(BaseModel):
    """Schema for paginated list response."""

    items: list[{ModelName}Response]
    total: int
    skip: int
    limit: int
```

### Шаблон Unit тестов

```python
"""
Unit tests for {ModelName} endpoints.
"""

import pytest
from httpx import AsyncClient
from sqlmodel.ext.asyncio.session import AsyncSession

from backend.app.models.user import User
from backend.app.models.{model_name} import {ModelName}


@pytest.mark.asyncio
async def test_create_{model_name}(
    client: AsyncClient,
    test_user_token: str,
    test_user: User,
):
    """Test creating a {model_name}."""
    payload = {
        "name": "Test {ModelName}",
        "description": "Test description",
    }

    response = await client.post(
        "/api/v1/{model_name}s",
        json=payload,
        headers={"Authorization": f"Bearer {test_user_token}"},
    )

    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "Test {ModelName}"
    assert data["user_id"] == test_user.id
    assert data["is_current"] is True


@pytest.mark.asyncio
async def test_get_{model_name}(
    client: AsyncClient,
    test_user_token: str,
    test_{model_name}: {ModelName},
):
    """Test getting a {model_name} by ID."""
    response = await client.get(
        f"/api/v1/{model_name}s/{test_{model_name}.id}",
        headers={"Authorization": f"Bearer {test_user_token}"},
    )

    assert response.status_code == 200
    data = response.json()
    assert data["id"] == test_{model_name}.id
    assert data["name"] == test_{model_name}.name


@pytest.mark.asyncio
async def test_update_{model_name}_creates_new_version(
    client: AsyncClient,
    test_user_token: str,
    test_{model_name}: {ModelName},
    session: AsyncSession,
):
    """Test that update creates new SCD Type 2 version."""
    old_id = test_{model_name}.id

    # Update
    payload = {"name": "Updated Name"}
    response = await client.put(
        f"/api/v1/{model_name}s/{old_id}",
        json=payload,
        headers={"Authorization": f"Bearer {test_user_token}"},
    )

    assert response.status_code == 200
    data = response.json()

    # New version has different ID
    assert data["id"] != old_id
    assert data["name"] == "Updated Name"
    assert data["is_current"] is True

    # Old version still exists but not current
    await session.refresh(test_{model_name})
    assert test_{model_name}.is_current is False


@pytest.mark.asyncio
async def test_user_isolation_{model_name}(
    client: AsyncClient,
    test_user_token: str,
    other_user_{model_name}: {ModelName},
):
    """Test that users cannot see other users' {model_name}s."""
    response = await client.get(
        f"/api/v1/{model_name}s/{other_user_{model_name}.id}",
        headers={"Authorization": f"Bearer {test_user_token}"},
    )

    assert response.status_code == 404
```

## Проверочный чеклист

После создания endpoint проверь:

- [ ] Endpoint файл создан в `backend/app/api/v1/endpoints/{model_name}.py`
- [ ] Схемы созданы в `backend/app/schemas/{model_name}.py`
- [ ] Router зарегистрирован в `backend/app/api/v1/router.py`
- [ ] Добавлены dependencies: `CurrentUser`, `get_session`
- [ ] Добавлен user isolation: `apply_user_filter()` или `user_id=current_user.id`
- [ ] UPDATE использует SCD Type 2: `create_new_version()`
- [ ] DELETE делает soft delete (is_current=False)
- [ ] Созданы базовые unit тесты
- [ ] OpenAPI документация доступна в `/docs`
- [ ] Все endpoints возвращают корректные HTTP статусы
- [ ] Добавлена обработка ошибок (404, 403, 401)

## Связанные скилы

- **db-management**: для создания миграций и моделей
- **testing**: для создания integration и e2e тестов
- **monitoring**: для добавления логирования и метрик

## Примеры использования

### Пример 1: Создать простой CRUD endpoint

```
Создай REST API endpoint для модели "Note" с операциями create, read, update, delete, list.
Используй JWT аутентификацию, user isolation и SCD Type 2.

Поля модели:
- title: str (обязательное)
- content: str (опциональное)
- is_global: bool (только для админов)
```

### Пример 2: Создать endpoint с иерархией

```
Создай REST API endpoint для модели "Category" с поддержкой иерархии (parent_id).
Операции: create, read, update, delete, list, get_children, get_ancestors.
Используй HierarchyService для работы с Closure Table.
```

### Пример 3: Создать read-only endpoint для аналитики

```
Создай GET endpoint для аналитики "/api/v1/analytics/budget-summary".
Возвращает сводку по бюджету (план vs факт) за указанный период.
Только аутентифицированные пользователи, с user isolation.
```

## Часто задаваемые вопросы

**Q: Когда использовать SCD Type 2, а когда обычный UPDATE?**

A: SCD Type 2 используй для dimension таблиц (User, Article, FinancialCenter, CostCenter), где нужна история изменений. Для fact таблиц (BudgetFact) используй обычный UPDATE.

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
async def create_bulk(items: list[{ModelName}Create], ...):
    created = []
    for item in items:
        instance = {ModelName}(**item.model_dump(), ...)
        session.add(instance)
        created.append(instance)
    await session.commit()
    return created
```
