# Adding a New Backend Feature

Complete checklist for adding a new domain (model + endpoint + service + migration + tests).

## 1. Create the SQLModel Model

File: `backend/app/models/<domain>.py`

```python
from sqlmodel import Field, SQLModel
from datetime import datetime
from sqlalchemy import func

class Tag(SQLModel, table=True):
    __tablename__ = "t_d_tag"

    id: int | None = Field(default=None, primary_key=True)
    name: str = Field(max_length=100, index=True)
    user_id: int | None = Field(default=None, foreign_key="t_d_user.id", index=True)
    is_active: bool = Field(default=True, index=True)
    created_at: datetime = Field(default_factory=datetime.utcnow, nullable=False)
    updated_at: datetime = Field(
        default_factory=datetime.utcnow,
        sa_column_kwargs={"onupdate": func.now()},
    )
```

Import in `backend/app/models/__init__.py` (if such file exists, or ensure the model is importable).

## 2. Create Pydantic Schemas

File: `backend/app/schemas/<domain>.py`

```python
from pydantic import BaseModel, ConfigDict, Field
from datetime import datetime

class TagCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)

class TagUpdate(BaseModel):
    name: str | None = None

class TagResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    is_active: bool
    created_at: datetime
    updated_at: datetime

class TagListResponse(BaseModel):
    tags: list[TagResponse]
    total: int
    limit: int
    offset: int
```

## 3. Create the Endpoint Module

File: `backend/app/api/v1/endpoints/<domain>.py`

```python
from fastapi import APIRouter, Depends, Query, status
from typing import Annotated
from sqlmodel import select, func
from sqlmodel.ext.asyncio.session import AsyncSession

from app.core.dependencies import CurrentUser, get_session
from app.core.exceptions import NotFoundException, ConflictException
from app.core.user_isolation import apply_user_filter, ensure_user_owns_resource
from app.schemas.errors import get_common_responses
from app.schemas.tag import TagCreate, TagUpdate, TagResponse, TagListResponse
from app.models.tag import Tag

router = APIRouter(prefix="/tags", tags=["Tags"])


@router.post(
    "",
    response_model=TagResponse,
    status_code=status.HTTP_201_CREATED,
    responses=get_common_responses(include_409=True),
)
async def create_tag(
    tag_data: TagCreate,
    current_user: CurrentUser,
    session: AsyncSession = Depends(get_session),
) -> Tag:
    dup = (await session.execute(
        select(Tag).where(Tag.name == tag_data.name, Tag.is_active == True)
    )).scalar_one_or_none()
    if dup:
        raise ConflictException("Tag with this name already exists")

    tag = Tag(**tag_data.model_dump(), user_id=current_user.id)
    session.add(tag)
    await session.flush()
    await session.refresh(tag)
    return tag


@router.get("", response_model=TagListResponse)
async def list_tags(
    current_user: CurrentUser,
    session: AsyncSession = Depends(get_session),
    limit: Annotated[int, Query(ge=1, le=1000)] = 100,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> TagListResponse:
    base_stmt = select(Tag).where(Tag.is_active == True)
    base_stmt = apply_user_filter(base_stmt, current_user)

    total = (await session.execute(
        select(func.count()).select_from(base_stmt.subquery())
    )).scalar_one()
    tags = (await session.execute(
        base_stmt.order_by(Tag.name).limit(limit).offset(offset)
    )).scalars().all()

    return TagListResponse(tags=tags, total=total, limit=limit, offset=offset)


@router.get("/{tag_id}", response_model=TagResponse, responses=get_common_responses(include_404=True))
async def get_tag(
    tag_id: int,
    current_user: CurrentUser,
    session: AsyncSession = Depends(get_session),
) -> Tag:
    tag = await session.get(Tag, tag_id)
    if not tag or not tag.is_active:
        raise NotFoundException("Tag not found")
    ensure_user_owns_resource(tag.user_id, current_user)
    return tag


@router.patch("/{tag_id}", response_model=TagResponse, responses=get_common_responses(include_404=True))
async def update_tag(
    tag_id: int,
    tag_data: TagUpdate,
    current_user: CurrentUser,
    session: AsyncSession = Depends(get_session),
) -> Tag:
    tag = await session.get(Tag, tag_id)
    if not tag or not tag.is_active:
        raise NotFoundException("Tag not found")
    ensure_user_owns_resource(tag.user_id, current_user)

    for field, value in tag_data.model_dump(exclude_unset=True).items():
        setattr(tag, field, value)
    await session.flush()
    await session.refresh(tag)
    return tag


@router.delete("/{tag_id}", status_code=status.HTTP_204_NO_CONTENT, responses=get_common_responses(include_404=True))
async def delete_tag(
    tag_id: int,
    current_user: CurrentUser,
    session: AsyncSession = Depends(get_session),
) -> None:
    tag = await session.get(Tag, tag_id)
    if not tag or not tag.is_active:
        raise NotFoundException("Tag not found")
    ensure_user_owns_resource(tag.user_id, current_user)
    tag.is_active = False
    await session.flush()
```

## 4. Register in Router

File: `backend/app/api/v1/router.py`

```python
from app.api.v1.endpoints.tag import router as tags_router
# ...
api_router.include_router(tags_router)
```

## 5. Create Alembic Migration

```bash
cd backend
alembic revision --autogenerate -m "add_tags_table"
```

Rename the file to `YYYYMMDD_<hex>_add_tags_table.py`. Review and clean up the generated SQL if needed.

## 6. Write Tests

File: `tests/integration/backend/test_tags.py`

```python
import pytest
from httpx import AsyncClient

pytestmark = [pytest.mark.integration, pytest.mark.asyncio]

async def test_create_tag(authenticated_client: AsyncClient):
    response = await authenticated_client.post("/api/v1/tags", json={"name": "Food"})
    assert response.status_code == 201
    assert response.json()["name"] == "Food"

async def test_create_tag_duplicate(authenticated_client: AsyncClient):
    await authenticated_client.post("/api/v1/tags", json={"name": "Food"})
    response = await authenticated_client.post("/api/v1/tags", json={"name": "Food"})
    assert response.status_code == 409

async def test_list_tags(authenticated_client: AsyncClient):
    await authenticated_client.post("/api/v1/tags", json={"name": "Food"})
    response = await authenticated_client.get("/api/v1/tags")
    assert response.status_code == 200
    data = response.json()
    assert data["total"] >= 1
    assert any(t["name"] == "Food" for t in data["tags"])

async def test_delete_tag(authenticated_client: AsyncClient):
    r = await authenticated_client.post("/api/v1/tags", json={"name": "Temp"})
    tag_id = r.json()["id"]
    response = await authenticated_client.delete(f"/api/v1/tags/{tag_id}")
    assert response.status_code == 204

async def test_tag_isolation(authenticated_client: AsyncClient, authenticated_admin_client: AsyncClient):
    r = await authenticated_client.post("/api/v1/tags", json={"name": "Private"})
    tag_id = r.json()["id"]
    response = await authenticated_admin_client.get(f"/api/v1/tags/{tag_id}")
    assert response.status_code == 403
```

## Checklist

- [ ] `models/<domain>.py` — SQLModel with `__tablename__`, timestamps, `is_active`
- [ ] `schemas/<domain>.py` — `Create`, `Update`, `Response`, `ListResponse`
- [ ] `api/v1/endpoints/<domain>.py` — CRUD with `get_common_responses`
- [ ] `api/v1/router.py` — router registered
- [ ] Migration created + renamed to timestamp convention
- [ ] Integration tests cover: create, duplicate 409, list, get, update, delete, isolation
- [ ] If writes are real-time: add `broadcast_*()` call after flush
- [ ] If data is cached: add `cache_service.invalidate_*()` call after flush
