# Family Budget - Backend API

FastAPI-based backend for Family Budget Management System.

## Project Structure

```
backend/
├── app/
│   ├── main.py              # FastAPI application entry point
│   ├── api/
│   │   └── v1/
│   │       └── router.py    # API v1 router (placeholders for endpoints)
│   ├── core/
│   │   ├── config.py        # Application settings (Pydantic)
│   │   └── dependencies.py  # FastAPI dependencies (DB, auth, etc.)
│   ├── models/              # SQLModel models (TASK-010)
│   ├── schemas/             # Pydantic schemas for validation
│   ├── services/            # Business logic services
│   ├── middleware/          # Custom middleware
│   └── db/
│       └── session.py       # Database session management (TASK-011)
├── db/
│   ├── migrations/          # SQL migration scripts (EPIC-001 - COMPLETED)
│   └── tests/               # Database tests
├── tests/                   # Application tests
│   ├── api/
│   ├── models/
│   ├── auth/
│   ├── integration/
│   └── services/
├── requirements.txt         # Python dependencies
├── .env.example             # Environment variables template
└── README.md                # This file
```

## Setup

### 1. Install Dependencies

**Production dependencies:**
```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

**Development/testing dependencies** (optional, for local development):
```bash
pip install -r requirements-dev.txt
```

This includes:
- Testing: `pytest`, `pytest-asyncio`, `pytest-cov`, `httpx`
- Code quality: `black`, `ruff`

### 2. Configure Environment

```bash
cp .env.example .env
# Edit .env with your actual values
```

**Required Environment Variables:**
- `DATABASE_URL` - PostgreSQL connection string
- `JWT_SECRET` - Secret key for JWT tokens
- `TELEGRAM_BOT_TOKEN` - Your Telegram bot token
- `CORS_ORIGINS` - Allowed CORS origins

### 3. Run Database Migrations (EPIC-001)

```bash
cd db
./run_migrations.sh
```

### 4. Start Development Server

```bash
uvicorn backend.app.main:app --reload --host 0.0.0.0 --port 8000
```

The API will be available at:
- **API:** http://localhost:8000
- **Health check:** http://localhost:8000/health
- **API docs (Swagger):** http://localhost:8000/docs
- **API docs (ReDoc):** http://localhost:8000/redoc

## Development Status

### ✅ Completed (EPIC-001)
- Database schema (SCD Type 2 dimensions, Closure Table)
- PostgreSQL migrations

### ✅ Completed (TASK-009)
- FastAPI application structure
- Configuration management (Pydantic Settings)
- API v1 router skeleton
- Health check endpoint

### 🚧 In Progress (EPIC-002)
- **TASK-010:** SQLModel models
- **TASK-011:** Database connection pool
- **TASK-012:** Telegram OAuth endpoint (CRITICAL)
- **TASK-013-027:** Additional backend features

## API Endpoints (Planned)

### Authentication
- `POST /api/v1/auth/telegram` - Telegram OAuth login (TASK-012)

### Facts
- `GET/POST /api/v1/facts` - List/create budget facts (TASK-016)
- `GET /api/v1/facts/{id}` - Get fact details
- `PUT /api/v1/facts/{id}` - Update fact
- `DELETE /api/v1/facts/{id}` - Delete fact

### Articles (Categories)
- `GET/POST /api/v1/articles` - List/create articles (TASK-015)
- `GET /api/v1/articles/{id}/subtree` - Get article hierarchy

### Users
- `GET /api/v1/users` - List users (admin only, TASK-017)
- `GET /api/v1/users/me` - Get current user

## Testing

```bash
# Run all tests
pytest

# Run with coverage
pytest --cov=backend/app --cov-report=html

# Run specific test file
pytest tests/api/test_facts.py
```

## Tech Stack

- **Framework:** FastAPI 0.109+
- **ORM:** SQLModel 0.0.14
- **Database:** PostgreSQL 16+ (async via asyncpg)
- **Auth:** python-jose (JWT)
- **Telegram:** python-telegram-bot 20.7
- **Testing:** pytest, pytest-asyncio, pytest-cov

## Next Steps

1. ✅ **TASK-009:** FastAPI app structure - COMPLETED
2. ⏳ **TASK-011:** Database connection pool
3. ⏳ **TASK-010:** SQLModel models
4. ⏳ **TASK-012:** Telegram OAuth (SECURITY CRITICAL)

---

**Version:** 1.0.0 (EPIC-002 in progress)
**Last Updated:** 2025-10-09
