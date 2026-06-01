# Backend Patterns Reference

## Models

**Base pattern** — all models use SQLModel with `table=True`:

```python
from sqlmodel import Field, SQLModel
from datetime import datetime
from sqlalchemy import func

class Article(SQLModel, table=True):
    __tablename__ = "t_d_article"

    id: int | None = Field(default=None, primary_key=True)
    name: str = Field(max_length=255, index=True)
    code: str = Field(max_length=20, unique=True)       # auto-generated: ART-1
    type: str = Field(max_length=50)                     # 'income' | 'expense'
    parent_id: int | None = Field(default=None, foreign_key="t_d_article.id", index=True)
    user_id: int | None = Field(default=None, foreign_key="t_d_user.id", index=True)
    is_active: bool = Field(default=True, index=True)
    created_at: datetime = Field(default_factory=datetime.utcnow, nullable=False)
    updated_at: datetime = Field(
        default_factory=datetime.utcnow,
        sa_column_kwargs={"onupdate": func.now()},
    )
```

### Data Patterns in This Project

**SCD Type 1 (current data)** — dimension tables (Article, User, FinancialCenter, etc.):
- In-place updates via `UPDATE`
- `is_active` for soft-delete
- Stable `id` — never changes

**SCD Type 2 (full history)** — separate `*History` tables:
- `valid_from`, `valid_to`, `is_current`
- Full row snapshots on every change
- Service: `services/scd2_service.py`

**Closure Table (hierarchy)** — `ArticleHierarchy` model:
- `ancestor_id`, `descendant_id`, `depth`
- Pre-computed paths for O(1) tree queries
- Service: `services/hierarchy_service.py`

**Fact Table (star schema)** — `BudgetFact`:
- FK to all dimension tables
- Partitioned by `fact_date` (monthly)
- Never versioned; immutable after creation

---

## Schemas

Always create three classes per domain:

```python
from pydantic import BaseModel, ConfigDict, Field, field_validator
from typing import Literal

class ArticleCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    type: Literal["income", "expense", "debit", "credit"]
    parent_id: int | None = None

    @field_validator("name")
    @classmethod
    def name_strip(cls, v: str) -> str:
        return v.strip()

class ArticleUpdate(BaseModel):
    name: str | None = None
    type: str | None = None
    parent_id: int | None = None

class ArticleResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    type: str
    is_active: bool
    created_at: datetime
    updated_at: datetime

class ArticleListResponse(BaseModel):
    articles: list[ArticleResponse]
    total: int
    limit: int
    offset: int
```

**Error response helpers** — `schemas/errors.py`:
```python
responses=get_common_responses(include_403=True, include_404=True)
```

---

## Endpoints

Standard endpoint pattern — `api/v1/endpoints/articles.py`:

```python
from fastapi import APIRouter, Depends, Query, status
from typing import Annotated
from sqlmodel.ext.asyncio.session import AsyncSession

from app.core.dependencies import CurrentUser, get_session
from app.schemas.errors import get_common_responses
from app.schemas.article import ArticleCreate, ArticleResponse, ArticleListResponse
from app.core.exceptions import NotFoundException, ConflictException

router = APIRouter(prefix="/articles", tags=["Articles"])

@router.post(
    "",
    response_model=ArticleResponse,
    status_code=status.HTTP_201_CREATED,
    responses=get_common_responses(include_403=True, include_404=True),
)
async def create_article(
    article_data: ArticleCreate,
    current_user: CurrentUser,
    session: AsyncSession = Depends(get_session),
) -> Article:
    # 1. Validate (parent exists, no duplicate)
    # 2. Generate code via generate_code(session, Article)
    # 3. Create model instance, session.add(), await session.flush()
    # 4. Create history record (SCD2 if needed)
    # 5. await cache_service.invalidate_articles()
    # 6. await broadcast_article_created(article)
    return article

@router.get("", response_model=ArticleListResponse)
async def list_articles(
    current_user: CurrentUser,
    session: AsyncSession = Depends(get_session),
    limit: Annotated[int, Query(ge=1, le=1000)] = 100,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> ArticleListResponse:
    stmt = select(Article).where(Article.is_active == True)
    # apply_user_filter(stmt, current_user)  ← for user-owned resources
    total = (await session.execute(select(func.count()).select_from(stmt.subquery()))).scalar_one()
    items = (await session.execute(stmt.limit(limit).offset(offset))).scalars().all()
    return ArticleListResponse(articles=items, total=total, limit=limit, offset=offset)
```

**Register router** in `api/v1/router.py`:
```python
from app.api.v1.endpoints.articles import router as articles_router
api_router.include_router(articles_router)
```

---

## Services

Services receive `session` — they **never** call `session.commit()`:

```python
# services/article_service.py
from sqlmodel.ext.asyncio.session import AsyncSession
from app.models.article import Article

async def create_initial_history(session: AsyncSession, article: Article, change_type: str) -> None:
    history = ArticleHistory(
        article_id=article.id,
        name=article.name,
        type=article.type,
        change_type=change_type,
        valid_from=datetime.utcnow(),
        is_current=True,
    )
    session.add(history)
    await session.flush()
```

Session lifecycle is owned by the endpoint's `Depends(get_session)`.

---

## Auth

**Dependencies** from `core/dependencies.py`:

```python
CurrentUser = Annotated[User, Depends(get_current_user)]       # raises 401 if not logged in
CurrentAdmin = Annotated[User, Depends(get_current_admin)]     # raises 403 if not admin
CurrentUserOptional = Annotated[User | None, Depends(get_current_user_optional)]
```

**User isolation** — `core/user_isolation.py`:

```python
from app.core.user_isolation import apply_user_filter, ensure_user_owns_resource

# Filter list queries:
stmt = apply_user_filter(select(Fact), current_user)

# Validate ownership before update/delete (pass user_id, not the object):
ensure_user_owns_resource(fact.user_id, current_user)  # raises ForbiddenException
```

**JWT flow**:
- `access_token` httpOnly cookie → JWT Middleware → `request.state.user_id`
- `get_current_user` loads `User` from DB using `request.state.user_id`
- WebSocket tokens: `POST /ws/token` → short-lived `type: 'ws'` JWT

---

## Migrations

Create a new migration:

```bash
cd backend
alembic revision --autogenerate -m "add_article_tags_table"
# Then review/edit the generated file in db/migrations/versions/
```

Naming convention: `YYYYMMDD_<8hex>_<slug>.py`
Example: `20260601_a1b2c3d4_add_article_tags_table.py`

Rename the auto-generated file to match the convention.

**Migration template pattern:**

```python
def upgrade() -> None:
    op.create_table(
        "t_d_article_tag",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("article_id", sa.Integer(), sa.ForeignKey("t_d_article.id"), nullable=False),
        sa.Column("name", sa.String(100), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.Index("ix_article_tag_article_id", "article_id"),
    )

def downgrade() -> None:
    op.drop_table("t_d_article_tag")
```

**Run migrations** (in Docker container):
```bash
alembic upgrade head
```

---

## WebSocket

**Broadcast after a write:**

```python
# Direct import from budget_ws.py
from app.api.v1.endpoints.budget_ws import broadcast_fact_created

# Pass response schema dict (model_dump), not the ORM object:
response = FactResponse.model_validate(fact)
await broadcast_fact_created(response.model_dump(mode="json"))
```

Available broadcast functions (see `budget_ws.py` lines 915+):
- `broadcast_fact_created/updated/deleted`
- `broadcast_plan_created/updated/deleted`
- `broadcast_item_created/updated/deleted`
- `broadcast_shopping_list_created/updated/deleted`
- `broadcast_transfer_created/deleted`
- `broadcast_financial_center/cost_center/store/product_group_*`

**Adding a new event type:**

1. Add `broadcast_X_created()` function in `budget_ws.py` following the safe-fields pattern
2. Add the event type string to the `EventType` union (if typed)
3. Subscribe on the frontend via `window.budgetWSClient.on('x_created', handler)`

**Redis Pub/Sub** (multi-worker):
- `services/redis_pubsub_service.py` — `publish_event(event_type, data)`
- All `broadcast_*()` calls use this internally
- Fallback to in-memory if Redis unavailable

---

## Scheduler

Background jobs in `scheduler.py` via APScheduler:

```python
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from app.db.session import get_session_context

scheduler = AsyncIOScheduler()

@scheduler.scheduled_job("cron", hour=0, minute=0)
async def recalculate_usage_stats():
    async with get_session_context() as session:
        await usage_stats_service.recalculate(session)
```

Use `get_session_context()` (not `get_session` dependency) for background tasks.

---

## Cache Service

```python
from app.services.cache_service import cache_service

# Read (returns None if cache miss or Redis unavailable)
data = await cache_service.get("articles:user:42")

# Write
await cache_service.set("articles:user:42", serialized_data, ttl=300)

# Invalidate by pattern
await cache_service.invalidate_articles()       # clears all article caches
await cache_service.invalidate_facts(user_id)   # clears user's fact caches
```

TTL categories (seconds):
- `REDIS_CACHE_TTL_REFERENCE = 300` — reference data (articles, categories)
- `REDIS_CACHE_TTL_DASHBOARD = 30` — quick stats, balances
- `REDIS_CACHE_TTL_DYNAMIC = 60` — fact lists
- `REDIS_CACHE_TTL_SHORT = 10` — HTML fragments

---

## Web Page Routes

Page routes live in `api/web/router.py` and return `HTMLResponse`:

```python
from fastapi import Request
from fastapi.responses import HTMLResponse
from app.core.dependencies import CurrentUserOptional

@web_router.get("/my-page", response_class=HTMLResponse)
async def my_page(
    request: Request,
    current_user: CurrentUserOptional,
) -> HTMLResponse:
    return templates.TemplateResponse(
        "my_page.html",
        {"request": request, "user": current_user, "title": "My Page"},
    )
```

Template file goes in `frontend/web/templates/my_page.html` (extends `base.html`).
