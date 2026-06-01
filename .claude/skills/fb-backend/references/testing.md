# Backend Testing Reference

## Setup

**Run tests:**
```bash
cd tests && ./run-tests.sh backend    # integration + unit backend tests
cd tests && ./run-tests.sh all        # all tests
pytest tests/unit/backend/ -v         # unit tests only
pytest tests/integration/backend/ -v  # integration tests only
pytest -m "not destructive" -v        # skip destructive (post-deploy safe)
```

**Database priority** (conftest.py):
1. `DATABASE_URL` env var (CI/CD)
2. `TEST_DATABASE_URL` env var (local `.env.test`)
3. Default: `postgresql+asyncpg://...@localhost:5432/familybudget_test`

**pytest.ini markers:**
- `@pytest.mark.unit` — pure logic, no DB
- `@pytest.mark.integration` — hits real test DB
- `@pytest.mark.destructive` — skipped in post-deploy CI
- `@pytest.mark.asyncio` — async test (auto in asyncio_mode=auto)

---

## Core Fixtures (conftest.py)

```python
# DB session — rolls back every test automatically
async def test_something(db_session: AsyncSession):
    ...

# Unauthenticated HTTP client
async def test_unauth(client: AsyncClient):
    response = await client.get("/api/v1/articles")
    assert response.status_code == 401

# Authenticated client (normal user)
async def test_auth(authenticated_client: AsyncClient):
    response = await authenticated_client.get("/api/v1/articles")
    assert response.status_code == 200

# Admin client
async def test_admin(authenticated_admin_client: AsyncClient):
    response = await authenticated_admin_client.delete("/api/v1/admin/users/99")
    assert response.status_code == 204

# User objects
async def test_with_user(test_user: User, admin_user: User):
    ...
```

---

## Integration Test Pattern

```python
import pytest
from httpx import AsyncClient

pytestmark = [pytest.mark.integration, pytest.mark.asyncio]

async def test_create_article(authenticated_client: AsyncClient):
    payload = {"name": "Salary", "type": "income"}
    response = await authenticated_client.post("/api/v1/articles", json=payload)

    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "Salary"
    assert data["type"] == "income"
    assert "id" in data
    assert "code" in data  # ART-1, ART-2, ...

async def test_create_article_duplicate(authenticated_client: AsyncClient):
    payload = {"name": "Salary", "type": "income"}
    await authenticated_client.post("/api/v1/articles", json=payload)
    response = await authenticated_client.post("/api/v1/articles", json=payload)

    assert response.status_code == 409

async def test_list_articles_pagination(authenticated_client: AsyncClient):
    response = await authenticated_client.get("/api/v1/articles?limit=10&offset=0")
    assert response.status_code == 200
    data = response.json()
    assert "articles" in data
    assert "total" in data
    assert "limit" in data
    assert data["limit"] == 10
```

---

## Unit Test Pattern

```python
import pytest
from unittest.mock import AsyncMock, MagicMock

pytestmark = [pytest.mark.unit, pytest.mark.asyncio]

async def test_generate_code():
    session = AsyncMock()
    session.execute.return_value.scalar_one_or_none.return_value = None

    code = await generate_code(session, Article)

    assert code.startswith("ART-")
    session.execute.assert_called_once()

async def test_apply_user_filter_non_admin():
    user = MagicMock(id=42, is_admin=False)
    stmt = select(Fact)
    filtered = apply_user_filter(stmt, user)
    # Verify WHERE clause contains user_id = 42
    compiled = filtered.compile()
    assert "user_id" in str(compiled)
```

---

## Testing WebSocket Events

```python
async def test_fact_broadcast(
    authenticated_client: AsyncClient,
    db_session: AsyncSession,
    mocker,
):
    mock_broadcast = mocker.patch(
        "app.api.v1.endpoints.budget_ws.broadcast_fact_created",
        new_callable=AsyncMock,
    )

    payload = {"article_id": 1, "amount": 5000, "fact_date": "2026-06-01", "record_type": "fact"}
    response = await authenticated_client.post("/api/v1/facts", json=payload)

    assert response.status_code == 201
    mock_broadcast.assert_called_once()
    call_arg = mock_broadcast.call_args[0][0]
    assert call_arg.id is not None
```

---

## Testing Auth Endpoints

```python
async def test_login_telegram(client: AsyncClient, test_user: User, mocker):
    mocker.patch(
        "app.services.telegram_auth.validate_telegram_auth",
        return_value={"id": test_user.telegram_id, "first_name": "Test"},
    )

    response = await client.post("/api/v1/auth/telegram", json={"initData": "mock_data"})
    assert response.status_code == 200
    assert "access_token" in response.cookies

async def test_protected_endpoint_without_auth(client: AsyncClient):
    response = await client.get("/api/v1/facts")
    assert response.status_code == 401
```

---

## Testing Migrations

```python
# tests/migrations/ — test that migration applies without error
async def test_migration_head(engine):
    # engine fixture runs alembic upgrade head during session setup
    # Just verify tables exist
    async with engine.connect() as conn:
        result = await conn.execute(text("SELECT 1 FROM t_d_article LIMIT 1"))
        assert result is not None
```
