# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Family Budget** is a production-ready personal finance management system with Telegram bot integration and web analytics. The system uses advanced database patterns (SCD Type 2 + Closure Table) for historical tracking and efficient hierarchical queries.

**Tech Stack:** FastAPI (backend) + PostgreSQL (database) + HTMX/ECharts (frontend) + Docker (deployment)

**For complete project requirements and architecture details, see:**
- **[Product Requirements Document (PRD)](docs/prd/README.md)** - Complete product specification
- **[System Architecture](docs/prd/03-system-architecture.md)** - Detailed architecture documentation
- **[Functional Requirements](docs/prd/04-functional-requirements.md)** - 21 functional requirements with acceptance criteria

## Development Commands

### Local Development

```bash
# Backend development server
uvicorn backend.app.main:app --reload --host 0.0.0.0 --port 8000

# Access Swagger docs
open http://localhost:8000/docs

# Access ReDoc
open http://localhost:8000/redoc
```

### Testing

```bash
# Run all tests
pytest backend/tests/

# Unit tests only
pytest backend/tests/unit -v

# Integration tests
pytest backend/tests/integration -v

# E2E tests (comprehensive user workflows)
pytest backend/tests/e2e -v

# Run single test file
pytest backend/tests/e2e/test_user_journey.py -v

# Run specific test class
pytest backend/tests/e2e/test_user_journey.py::TestCompleteUserJourney -v

# Run with coverage
pytest --cov=backend/app --cov-report=html

# Run with detailed output
pytest backend/tests/e2e/ -v -s
```

### Database Migrations

```bash
# Run all migrations (from backend/db/)
./run_migrations.sh

# Check migration status
./check_migrations.sh

# Create new Alembic migration (when using Alembic in future)
alembic revision --autogenerate -m "Description"
alembic upgrade head
```

### Code Quality

```bash
# Format code
black backend/

# Lint code
ruff check backend/

# Type checking (when mypy config is added)
mypy backend/
```

### Docker Deployment

```bash
# Full production deployment (3 steps)
sudo ./install.sh     # Install Docker, UFW (one-time)
./setup.sh            # Configure environment (interactive)
./deploy.sh           # Deploy services

# Build and deploy
./deploy.sh --build

# Deploy without migrations
./deploy.sh --no-migrate

# View logs
docker compose logs -f
docker compose logs -f backend
docker compose logs -f postgres

# Restart service
docker compose restart backend

# Stop all services
docker compose down

# Clean restart (DELETES DATA!)
docker compose down -v
./deploy.sh --clean --build
```

### Health Checks

```bash
# Basic health check
curl http://localhost:8000/health

# Detailed health check
curl http://localhost:8000/health/detailed

# Readiness check
curl http://localhost:8000/ready

# Ping
curl http://localhost:8000/ping
```

## Architecture Highlights

### Database Design Patterns

This project uses two advanced database patterns that work together:

#### 1. SCD Type 2 (Slowly Changing Dimension Type 2)

**Applied to:** `t_d_user` (users) and `t_d_article` (budget categories)

**Purpose:** Track historical changes while preserving audit trail.

**Key fields:**
- `is_current`: `true` for current version, `false` for historical
- `valid_from`: When this version became active
- `valid_to`: When this version expired (`9999-12-31` for current)

**Important:** When updating an Article or User:
- Do NOT modify the existing record
- Create a NEW record with updated data
- Set old record's `is_current = false` and `valid_to = NOW()`
- Set new record's `is_current = true` and `valid_from = NOW()`

**Why it matters:** Provides complete audit trail of all changes. Never lose historical data. Required for compliance and debugging.

#### 2. Closure Table Pattern

**Applied to:** `t_d_article_hierarchy` (article hierarchy paths)

**Purpose:** Efficient hierarchical queries on article tree structure.

**How it works:**
- Stores ALL ancestor-descendant paths in the hierarchy
- Maintained automatically by database triggers (do NOT modify directly)
- Enables O(1) query complexity for finding descendants/ancestors

**Example:**
```
Food (id=1)
  +-- Groceries (id=2)
      +-- Organic (id=3)
  +-- Dining Out (id=5)
```

Closure table contains:
- Self-references: `(1,1,0)`, `(2,2,0)`, `(3,3,0)`, `(5,5,0)`
- Direct children: `(1,2,1)`, `(1,5,1)`, `(2,3,1)`
- Transitive paths: `(1,3,2)` (Food -> Organic via Groceries)

**Query patterns:**
```sql
-- All descendants of Food (id=1)
SELECT descendant_id FROM t_d_article_hierarchy
WHERE ancestor_id = 1 AND depth > 0;

-- Direct children only
SELECT descendant_id FROM t_d_article_hierarchy
WHERE ancestor_id = 1 AND depth = 1;

-- All ancestors of Organic (id=3)
SELECT ancestor_id FROM t_d_article_hierarchy
WHERE descendant_id = 3 AND depth > 0;
```

**Why it matters:** Makes complex hierarchy queries trivial. No recursive CTEs needed. Critical for performance when users have deep category trees.

### Model Import Patterns

**CRITICAL:** There's a circular import issue between models. Always use this pattern:

```python
# CORRECT - Use alias to avoid circular import
from backend.app.models.fact import Fact as FactModel

# WRONG - Direct import conflicts with pydantic schemas
from backend.app.models.fact import Fact
```

**Files affected:**
- `backend/app/api/v1/facts.py`
- `backend/app/api/v1/analytics.py`
- `backend/app/services/fact_service.py`

### Middleware Stack Order

Middleware order matters! Current stack (from `backend/app/main.py`):

1. **CORSMiddleware** - CORS handling
2. **LoggingMiddleware** - Request/response logging with correlation IDs
3. **JWTAuthMiddleware** - JWT token validation

**Why this order:** Logging must come before JWT so we can log auth failures. CORS must be outermost.

### Exception Handler Order

Exception handlers are registered in specific order (specific -> generic):

1. `RequestValidationError` / `ValidationError` - Pydantic validation
2. `APIException` - Custom API exceptions
3. `HTTPException` - FastAPI HTTP exceptions
4. `SQLAlchemyError` - Database errors
5. `ValueError` - Generic value errors
6. `Exception` - Catch-all (last resort)

**Why it matters:** FastAPI checks handlers in registration order. More specific handlers must come first.

### Logging

**Use StructuredLogger, NOT get_logger:**

```python
# CORRECT - Supports extra kwargs like correlation_id
from backend.app.core.logging import StructuredLogger
logger = StructuredLogger(__name__)
logger.info("Message", correlation_id="123", user_id=456)

# WRONG - Standard logger doesn't support kwargs
from backend.app.core.logging import get_logger
logger = get_logger(__name__)
logger.info("Message", correlation_id="123")  # ERROR!
```

**Files using StructuredLogger:**
- `backend/app/middleware/error_handler.py`
- `backend/app/middleware/logging_middleware.py`

## API Architecture

### Authentication Flow

1. User authenticates via Telegram OAuth (`/api/v1/auth/telegram`)
2. Backend validates Telegram hash using HMAC-SHA256
3. JWT token issued and stored in HTTP-only cookie (`access_token`)
4. All subsequent requests automatically include cookie
5. `JWTAuthMiddleware` validates token on each request

**Security features:**
- HTTP-only cookies (no JavaScript access)
- HMAC-SHA256 hash validation
- JWT with 7-day expiration
- User isolation enforced at database query level

### Data Isolation Pattern

**Critical:** All user data must be isolated by `user_id`.

```python
# CORRECT - Filter by current user
articles = await session.execute(
    select(Article).where(
        Article.user_id == current_user.id,
        Article.is_current == True
    )
)

# WRONG - Returns all users' data!
articles = await session.execute(
    select(Article).where(Article.is_current == True)
)
```

**Exception:** Global articles (`is_global=True`) are visible to all users.

### Admin vs Regular User Permissions

Admin endpoints (prefix `/api/v1/admin/`) require `is_admin=True`:

```python
from backend.app.core.dependencies import get_current_admin

@router.get("/admin/users")
async def list_users(current_admin: User = Depends(get_current_admin)):
    # Only admins can access
    ...
```

Regular endpoints use `get_current_user`:

```python
from backend.app.core.dependencies import get_current_user

@router.get("/articles")
async def list_articles(current_user: User = Depends(get_current_user)):
    # Any authenticated user
    ...
```

## Database Schema Summary

### Tables

- **t_d_user** - Users (SCD Type 2)
  - Business key: `telegram_id`
  - Tracks user profile changes over time

- **t_d_article** - Budget categories (SCD Type 2 + Adjacency List)
  - Business key: `(user_id, code)` or `code` for global
  - Supports hierarchy via `parent_id`
  - Can be global (`is_global=true`) or user-specific

- **t_d_article_hierarchy** - Closure table (auto-maintained by triggers)
  - Stores all ancestor-descendant paths
  - Do NOT modify directly - update `Article.parent_id` instead

- **t_f_fact** - Transactions (NO SCD Type 2)
  - Simple transactional records
  - Links to `Article` and `User`
  - Partitioned by month for performance

### Indexes

Critical indexes for query performance:

- `t_d_user`: `(telegram_id)`, `(is_current)`
- `t_d_article`: `(user_id)`, `(parent_id)`, `(is_current)`, `(type)`
- `t_d_article_hierarchy`: `(ancestor_id, descendant_id)` [PRIMARY], `(descendant_id)`, `(depth)`
- `t_f_fact`: `(user_id)`, `(article_id)`, `(fact_date)`

## Common Patterns and Gotchas

### Working with SCD Type 2

```python
# Get current version only (most common)
article = await session.execute(
    select(Article).where(
        Article.id == article_id,
        Article.is_current == True
    )
)

# Get all versions (for audit/history)
versions = await session.execute(
    select(Article).where(Article.id == article_id)
    .order_by(Article.valid_from.desc())
)

# Update article (create new version)
async def update_article(article_id: int, updates: dict):
    # 1. Expire old version
    old.is_current = False
    old.valid_to = datetime.utcnow()

    # 2. Create new version
    new = Article(**old.dict(), **updates)
    new.id = None  # Will get new ID
    new.is_current = True
    new.valid_from = datetime.utcnow()
    new.valid_to = datetime(9999, 12, 31, 23, 59, 59)

    session.add(new)
    await session.commit()
```

### Working with Hierarchies

```python
# Get article with all descendants (subtree)
descendants = await session.execute(
    select(Article)
    .join(ArticleHierarchy, Article.id == ArticleHierarchy.descendant_id)
    .where(
        ArticleHierarchy.ancestor_id == root_id,
        Article.is_current == True
    )
)

# Get direct children only
children = await session.execute(
    select(Article)
    .join(ArticleHierarchy, Article.id == ArticleHierarchy.descendant_id)
    .where(
        ArticleHierarchy.ancestor_id == parent_id,
        ArticleHierarchy.depth == 1,
        Article.is_current == True
    )
)

# Get breadcrumb path to root
path = await session.execute(
    select(Article)
    .join(ArticleHierarchy, Article.id == ArticleHierarchy.ancestor_id)
    .where(
        ArticleHierarchy.descendant_id == child_id,
        Article.is_current == True
    )
    .order_by(ArticleHierarchy.depth.desc())
)
```

### Dependency Injection Pattern

FastAPI dependencies are used extensively:

```python
# Database session
async def get_session() -> AsyncSession:
    async with engine.begin() as session:
        yield session

# Current user (regular)
async def get_current_user(
    session: AsyncSession = Depends(get_session),
    token: str = Cookie(None, alias="access_token")
) -> User:
    # Validate JWT, return user
    ...

# Current admin
async def get_current_admin(
    current_user: User = Depends(get_current_user)
) -> User:
    if not current_user.is_admin:
        raise HTTPException(403, "Admin access required")
    return current_user
```

**Critical:** Always use `Depends()` wrapper in endpoint signatures:

```python
# CORRECT
@router.get("/facts")
async def list_facts(
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    ...

# WRONG - Missing Depends()
@router.get("/facts")
async def list_facts(
    session: AsyncSession = get_session,  # ERROR!
    current_user: User = get_current_user  # ERROR!
):
    ...
```

## Testing Strategy

### Test Structure

- **Unit tests** (`backend/tests/unit/`) - Model logic, utilities
- **Integration tests** (`backend/tests/integration/`) - API endpoints, services, database
- **E2E tests** (`backend/tests/e2e/`) - Complete user workflows

### E2E Test Coverage

The E2E tests simulate real-world workflows:

**User Journeys** (`test_user_journey.py`):
- Complete 11-step user workflow (categories -> transactions -> analytics)
- Budget planning and plan-vs-fact comparison
- Analytics exploration (all 6 chart types)

**Admin Journeys** (`test_admin_journey.py`):
- User management and search
- Global articles CRUD
- System monitoring and statistics
- Security and access control

**Run specific journey:**
```bash
pytest backend/tests/e2e/test_user_journey.py::TestCompleteUserJourney -v -s
```

### Test Fixtures

Key fixtures from `backend/tests/conftest.py`:

- `auth_client` - Authenticated HTTP client (regular user)
- `admin_client` - Authenticated HTTP client (admin user)
- `test_user` - Pre-created test user
- `test_admin` - Pre-created admin user
- `session` - Database session with automatic rollback

## Documentation

All documentation is in `docs/` directory:

- **docs/README.md** - Master documentation index
- **docs/prd/** - Product Requirements Document (PRD)
  - **docs/prd/README.md** - PRD master index with navigation
  - 13 modular PRD documents (Executive Summary, Architecture, Requirements, etc.)
  - Critical for understanding project vision, architecture decisions, and requirements
- **docs/api/API_DOCUMENTATION.md** - Complete API reference (40+ endpoints)
- **docs/testing/E2E_TESTS.md** - E2E test documentation
- **docs/deployment/** - Deployment guides and reports
- **docs/tasks/** - Task completion reports (35 files, organized by Epic)
- **docs/scripts/** - Deployment scripts documentation

## Deployment

### Security Configuration

**PostgreSQL External Access:**
- Default: DISABLED (most secure)
- If enabled: UFW firewall restricts access to single IP
- Never expose PostgreSQL to 0.0.0.0 in production

**Environment Variables:**
- `.env` file has 600 permissions (owner read/write only)
- Never commit `.env` to git
- Use auto-generated secrets (32+ chars for passwords, 64 hex for JWT)

### Container Architecture

**Network segmentation:**
- External network (`172.29.0.0/16`): nginx, backend, bot (public-facing)
- Internal network (`172.28.0.0/16`): postgres, backend, bot (isolated)

**PostgreSQL isolation:**
- Only accessible from backend/bot containers
- No direct internet access
- Port 5432 NOT exposed to host (unless explicitly configured with IP whitelist)

## Project-Specific Conventions

### Commit Messages

Follow Conventional Commits format:

```
feat: Add waterfall chart endpoint
fix: Resolve correlation_id logging error
docs: Update API documentation
test: Add E2E test for budget planning
chore: Update dependencies
```

Include co-author footer:
```
feat: Add amazing feature

> Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>
```

### Code Organization

**Backend structure:**
```
backend/app/
 main.py              # FastAPI app, middleware, exception handlers
 api/
    health.py        # Health check endpoints
    v1/              # API v1 endpoints
    web/             # Web pages (HTMX)
 core/
    config.py        # Settings (Pydantic)
    dependencies.py  # FastAPI dependencies
    exceptions.py    # Custom exceptions
    logging.py       # Structured logging
 models/              # SQLModel models
 schemas/             # Pydantic schemas
 services/            # Business logic
 middleware/          # Custom middleware
```

**Database structure:**
```
backend/db/
 migrations/          # SQL migration scripts (9 files)
 run_migrations.sh    # Execute all migrations
 check_migrations.sh  # Verify migration status
```

### Version Numbers

Current version: **4.4.0**

Version scheme: `MAJOR.MINOR.PATCH`
- MAJOR: Breaking changes
- MINOR: New features (backward compatible)
- PATCH: Bug fixes

Updated in:
- `backend/app/main.py` (FastAPI app version)
- `docs/README.md` (documentation version)
- `README.md` (project version)
