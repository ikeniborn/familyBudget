# Backend Dependencies Audit - Оптимизация Docker образа

## Цель
Удалить 3 неиспользуемых пакета и переместить 6 test-only пакетов в requirements-dev.txt для уменьшения размера Docker образа и ускорения сборки.

## Ожидаемый эффект
- **Размер образа**: -15-25 MB (удаление reportlab/openpyxl/sse-starlette)
- **Build time**: -5-10 секунд
- **Dependency tree**: очистка от неиспользуемых зависимостей
- **Security**: меньше пакетов = меньше потенциальных уязвимостей

## ✅ Packages Already in Use (Keep)

### orjson (High-Performance JSON)
**УЖЕ РЕАЛИЗОВАН И АКТИВЕН** - не удаляем!
- Реализация: `backend/app/core/json_utils.py` (строки 110-292)
- Активация: `backend/app/main.py:251` - `default_response_class=ORJSONResponse`
- Все API endpoints автоматически используют high-performance JSON serialization

### email-validator (Pydantic EmailStr)
**КРИТИЧНО ДЛЯ PRODUCTION** - не удаляем!
- Использование: Indirect via `Pydantic EmailStr` в `backend/app/schemas/auth.py`
- Назначение: Pydantic v2 требует email-validator для EmailStr validation
- Без него: Authentication будет сломан (login, password reset, OAuth)

### python-dotenv (Environment Variables)
**КРИТИЧНО ДЛЯ PRODUCTION** - не удаляем!
- Использование: Indirect via `pydantic-settings` в `backend/app/core/config.py`
- Назначение: Загрузка `.env` файла с DATABASE_URL, JWT_SECRET, TELEGRAM_BOT_TOKEN
- Без него: Application startup fail с missing env vars

### aiofiles (Async File I/O)
**КРИТИЧНО ДЛЯ PRODUCTION** - не удаляем!
- Использование: Indirect via FastAPI `UploadFile` в `backend/app/api/v1/endpoints/import_endpoints.py`
- Назначение: Async file upload processing (CSV imports, bank statements)
- Без него: File uploads будут падать с async errors

---

## Результаты анализа

### 🔴 Definitely Unused (3 пакета - SAFE TO REMOVE)

1. **reportlab** (4.2.5) - PDF generation
   - ❌ 0 direct imports в entire codebase
   - ❌ 0 transitive dependencies
   - Export endpoints (`export.py`, `admin_export.py`) используют только CSV
   - **Risk**: 🟢 LOW - Orphaned dependency, never implemented
   - **Action**: ✅ SAFE TO REMOVE

2. **openpyxl** (3.1.5) - Excel (xlsx) generation
   - ❌ 0 direct imports в entire codebase
   - ❌ 0 transitive dependencies
   - Export utilities (`utils/export.py`) только CSV
   - **Risk**: 🟢 LOW - Legacy artifact, never integrated
   - **Action**: ✅ SAFE TO REMOVE

3. **sse-starlette** (>=2.0.0) - Server-Sent Events
   - ❌ 0 direct imports (`from sse_starlette`, `EventSourceResponse`)
   - Real-time updates используют **WebSocket + Redis Pub/Sub** (`budget_ws.py`)
   - Marked as "Development" dependency но никогда не использовался
   - **Risk**: 🟢 LOW - No SSE fallback exists
   - **Action**: ✅ SAFE TO REMOVE

### 🟡 Test-Only Packages (6 пакетов - ПЕРЕМЕСТИТЬ)

**Текущее состояние**: В `requirements.txt`
**Целевое состояние**: В `requirements-dev.txt` (новый файл)

1. pytest (8.3.4)
2. pytest-asyncio (0.24.0)
3. pytest-cov (6.0.0)
4. httpx (0.28.1)
5. black (24.10.0)
6. ruff (0.8.4)

### ✅ Verified Used (44+ пакетов - СОХРАНИТЬ)

- FastAPI framework (fastapi, starlette, uvicorn)
- Database (sqlmodel, asyncpg, alembic, psycopg2-binary)
- Auth (python-jose, argon2-cffi, pyotp, webauthn, pywebpush)
- Services (redis, apscheduler, slowapi, psutil, python-json-logger)
- **docker** (7.1.0) - используется в `logs_collector_service.py`

---

## План выполнения

### Phase 1: Git Branch Setup (Выполняется сразу после approval)

**Git Branch**: `dev/optimize-dependency-audit_<timestamp>` (base: test)

**Action**: Создать branch через Bash:
```bash
git checkout test
git pull origin test
git checkout -b dev/optimize-dependency-audit_$(date +%Y%m%d%H%M%S)
```

⚠️ **ВАЖНО**: Branch создаётся как первый шаг execution phase, сразу после получения approval плана.

### Phase 2: Создание requirements-dev.txt

**Файл**: `backend/requirements-dev.txt` (новый)

```txt
# Development and Testing Dependencies
# Install: pip install -r requirements-dev.txt

# Testing Framework
pytest==8.3.4
pytest-asyncio==0.24.0
pytest-cov==6.0.0

# HTTP Client for Testing
httpx==0.28.1

# Code Quality
black==24.10.0
ruff==0.8.4
```

### Phase 3: Обновление requirements.txt

**Удалить 3 неиспользуемых пакета:**
- ❌ reportlab==4.2.5 (PDF export - не реализован)
- ❌ openpyxl==3.1.5 (Excel export - не реализован)
- ❌ sse-starlette>=2.0.0 (SSE - не используется, есть WebSocket)

**Сохранить критичные пакеты (НЕ удалять!):**
- ✅ **orjson>=3.10.0** - Активен (json_utils.py + main.py:251)
- ✅ **email-validator==2.2.0** - Критично (Pydantic EmailStr → auth schemas)
- ✅ **python-dotenv==1.0.1** - Критично (pydantic-settings → .env loading)
- ✅ **aiofiles==24.1.0** - Критично (FastAPI UploadFile → CSV imports)

**Переместить 6 test-only пакетов** в requirements-dev.txt (см. Phase 2)

**Результат**: requirements.txt с 48 пакетами (было 57: -3 unused -6 test-only)

### Phase 4: Обновление Docker конфигурации

**Файлы**: `backend/Dockerfile`

**Изменения**:
```dockerfile
# Development stage (если есть)
FROM python:3.12-slim AS development
COPY requirements.txt requirements-dev.txt ./
RUN pip install -r requirements.txt -r requirements-dev.txt

# Production stage (оставить как есть)
FROM python:3.12-slim AS production
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
```

**Проверить**: Если Dockerfile использует multi-stage builds, добавить requirements-dev.txt только для dev stage.

### Phase 5: Обновление CI/CD

**Файл**: `.github/workflows/backend-tests.yml`

**Текущее состояние** (строки 57-61):
```yaml
- name: Install backend dependencies
  run: |
    cd backend
    pip install -r requirements.txt
    pip install pytest-cov pytest-asyncio  # ❌ Дублирование!
```

**После изменений**:
```yaml
- name: Install backend dependencies
  run: |
    cd backend
    pip install -r requirements.txt
    pip install -r requirements-dev.txt  # ✅ Все test dependencies
```

**Обоснование**: pytest, pytest-cov, pytest-asyncio уже будут в requirements-dev.txt, не нужно устанавливать отдельно.

### Phase 6: Обновление документации

**Файл 1**: `backend/README.md`

Добавить секцию:
```markdown
## Development Setup

Install production dependencies:
pip install -r requirements.txt

Install development/test dependencies:
pip install -r requirements-dev.txt
```

**Файл 2**: `docs/architecture/docker.md`

Добавить примечание о requirements-dev.txt и оптимизации зависимостей.

---

## Validation Plan

### 1. Local Testing

```bash
# Clean environment test
cd backend/
python -m venv venv-test
source venv-test/bin/activate
pip install -r requirements.txt

# Verify no import errors
python -c "from app.main import app; print('✅ App imports OK')"

# Run full test suite with dev dependencies
pip install -r requirements-dev.txt
pytest tests/ -v --cov=app
# Expected: 100% pass rate (34+ tests)
```

### 2. Docker Build Test

```bash
# Build new image
docker build -f backend/Dockerfile -t family-budget-backend:audit-test .

# Compare image sizes
docker images | grep family-budget-backend
# Expected: ~20-40 MB reduction

# Test container startup
docker run -d --name test-backend family-budget-backend:audit-test
docker logs test-backend  # Should show clean startup

# Health check
curl http://localhost:8000/health
# Expected: 200 OK

docker stop test-backend && docker rm test-backend
```

### 3. Integration Tests

```bash
# Full integration test with docker-compose
docker compose -f docker-compose.test.yml up -d
pytest backend/tests/integration/ -v

# WebSocket test (verify redis/websocket still work)
# Auth test (verify JWT/OAuth still work)
# Database test (verify alembic/asyncpg still work)
```

### 4. Verify Critical Dependencies Still Work

**Цель**: Убедиться, что сохранённые критичные пакеты работают корректно

```bash
# Test email validation (email-validator)
python -c "from backend.app.schemas.auth import UserRegister; u = UserRegister(email='test@example.com', password='Test123!'); print('✅ EmailStr validation works')"

# Test settings loading (python-dotenv)
python -c "from backend.app.core.config import get_settings; s = get_settings(); print(f'✅ Settings loaded: DB={s.POSTGRES_HOST}')"

# Test file upload handling (aiofiles + orjson)
pytest backend/tests/endpoints/test_import.py -v -k "upload"
```

---

## Rollback Plan

### Quick Rollback (if tests fail)

```bash
# Revert git commit
git revert <commit-hash>
git push origin dev/optimize-dependency-audit_<timestamp>

# Rebuild Docker image
docker compose pull backend
docker compose up -d backend
```

### Partial Rollback (if specific package needed)

Если email-validator или python-dotenv вызывают проблемы:

```bash
# Add back to requirements.txt
echo "email-validator==2.2.0" >> backend/requirements.txt
pip install -r backend/requirements.txt
docker compose build backend
```

---

## Risk Assessment

### Packages Being Removed (3 total)

| Package | Risk | Impact if broken | Verification |
|---------|------|------------------|------------|
| reportlab | 🟢 LOW | None (0 imports, PDF export never implemented) | ✅ grep confirms zero usage |
| openpyxl | 🟢 LOW | None (0 imports, Excel export never implemented) | ✅ grep confirms zero usage |
| sse-starlette | 🟢 LOW | None (0 imports, WebSocket used instead) | ✅ grep confirms zero usage |
| test packages | 🟢 LOW | Dev workflow only (moved to requirements-dev.txt) | ✅ CI/CD updated |

### Packages Being Kept (Critical Dependencies)

| Package | Why Keeping | Impact if removed | Evidence |
|---------|-------------|-------------------|----------|
| email-validator | Pydantic EmailStr dependency | 🔴 Auth breaks (login/OAuth/password reset) | schemas/auth.py uses EmailStr |
| python-dotenv | pydantic-settings dependency | 🔴 App startup fails (no .env loading) | config.py uses env_file=".env" |
| aiofiles | FastAPI UploadFile dependency | 🔴 File uploads break (CSV imports) | import_endpoints.py uses UploadFile |
| orjson | Already active JSON serialization | 🟡 Performance regression (3-10x slower) | json_utils.py + main.py:251 |

**Overall Risk**: 🟢 **LOW** - Only removing genuinely unused packages (0 imports verified)

---

## Critical Files to Modify

1. ✅ `backend/requirements.txt`
   - Remove 3 unused: reportlab, openpyxl, sse-starlette
   - Remove 6 test packages: pytest, pytest-asyncio, pytest-cov, httpx, black, ruff
   - **KEEP 4 critical**: orjson, email-validator, python-dotenv, aiofiles

2. ✅ `backend/requirements-dev.txt` - NEW file with 6 test packages

3. ❌ `backend/Dockerfile` - НЕ ТРЕБУЕТСЯ (production не нуждается в dev deps)

4. ✅ `.github/workflows/backend-tests.yml`
   - Replace `pip install pytest-cov pytest-asyncio` → `pip install -r requirements-dev.txt`

5. ✅ `backend/README.md` - Update installation instructions

6. ✅ `docs/architecture/docker.md` - Document optimization + critical dependencies explanation

---

## Success Criteria

- ✅ All 34+ tests pass with new requirements.txt
- ✅ Docker image size reduced by 15-25 MB (3 unused packages removed)
- ✅ Docker build time reduced by 5-10 seconds
- ✅ No import errors on app startup
- ✅ **Critical dependencies verified working:**
  - Email validation (EmailStr in auth schemas)
  - Settings loading (.env via pydantic-settings)
  - File uploads (UploadFile via aiofiles)
  - JSON serialization (orjson active)
- ✅ CI/CD pipeline passes
- ✅ Documentation updated with critical dependencies explanation

---

## Estimated Timeline

- **Phase 1**: Branch creation - 5 minutes (после approval)
- **Phase 2-3**: requirements files update - 1 hour
- **Phase 4**: Docker configuration - 30 minutes
- **Phase 5**: CI/CD update - 30 minutes
- **Phase 6**: Documentation - 30 minutes
- **Validation**: Local + Docker + Integration tests - 2 hours
- **Total**: ~4.5 hours

---

## Deep Dependency Analysis Results

### Critical Findings - DO NOT REMOVE

#### 1️⃣ email-validator==2.2.0 ✅ KEEP
**Why it's critical:**
- Pydantic v2 **requires** email-validator for `EmailStr` type validation
- Used in `backend/app/schemas/auth.py` for authentication schemas
- Powers: login, OAuth, password reset, admin email validation

**What breaks without it:**
```python
# This will raise ImportError at runtime:
from pydantic import EmailStr  # Needs email-validator installed
```

**Evidence**: Indirect import via Pydantic → `schemas/auth.py` uses EmailStr

---

#### 2️⃣ python-dotenv==1.0.1 ✅ KEEP
**Why it's critical:**
- pydantic-settings **requires** python-dotenv to load `.env` files
- Config explicitly uses: `model_config = SettingsConfigDict(env_file=".env")`
- Loads: DATABASE_URL, JWT_SECRET, TELEGRAM_BOT_TOKEN, REDIS_URL, etc.

**What breaks without it:**
- Application startup fails with "Missing environment variable" errors
- Docker containers won't start
- All environment-based configuration breaks

**Evidence**: Indirect import via pydantic-settings → `core/config.py` line 42

---

#### 3️⃣ aiofiles==24.1.0 ✅ KEEP
**Why it's critical:**
- FastAPI/Starlette **internally uses** aiofiles for async file handling
- Required for `UploadFile` processing (CSV imports, bank statements)
- Used in: `backend/app/api/v1/endpoints/import_endpoints.py`

**What breaks without it:**
- File upload endpoints return 500 errors
- CSV import feature (Tinkoff bank exports) stops working
- Mysterious async I/O errors during file processing

**Evidence**: Indirect import via FastAPI → `import_endpoints.py` uses UploadFile

---

#### 4️⃣ orjson>=3.10.0 ✅ KEEP (Already Active!)
**Why it's critical:**
- Already implemented and active in production
- 3-10x performance improvement over stdlib json
- Default response class for ALL API endpoints

**Implementation:**
- `backend/app/core/json_utils.py` (lines 110-292): Full implementation
- `backend/app/main.py:251`: `default_response_class=ORJSONResponse`

**What breaks without it:**
- Performance regression (3-10x slower JSON serialization)
- Graceful fallback exists, but defeats purpose of optimization

---

### Packages Safe to Remove (Verified 0 Usage)

#### 🗑️ reportlab==4.2.5
- **0 direct imports** in entire codebase
- PDF export never implemented (only CSV exists)
- Orphaned dependency from planned feature

#### 🗑️ openpyxl==3.1.5
- **0 direct imports** in entire codebase
- Excel export never implemented (only CSV exists)
- Legacy artifact never integrated

#### 🗑️ sse-starlette>=2.0.0
- **0 direct imports** (`EventSourceResponse`, `from sse_starlette`)
- Real-time uses WebSocket + Redis Pub/Sub instead
- Marked as "Development" but unused

---

## Architecture Verification

✅ **CI/CD**: Есть `.github/workflows/backend-tests.yml`
- Строка 60-61: pytest установлен ДВАЖДЫ (в requirements.txt И отдельной командой)
- **Требуется**: Обновить для использования requirements-dev.txt

✅ **Dockerfile**: Multi-stage build подтверждён
- Stage 1: python-builder (строки 3-30)
- Stage 2: frontend-builder (строки 32-50)
- Production stage НЕ требует requirements-dev.txt (корректно)

---

## Next Steps After Approval

1. Execute Phase 2-6 modifications
2. Run validation tests (Phase 1-5 from Validation Plan)
3. Commit changes via git-workflow skill
4. Monitor CI/CD pipeline
5. Update documentation
