# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Family Budget is a family budget management system with Telegram bot and web interface support. Built on FastAPI (backend), PostgreSQL (database), using Docker for deployment.

**Key Features:**
- 🔐 Authentication via Telegram OAuth
- 📊 Hierarchical budget categories (articles)
- 💰 Transaction tracking (income/expenses)
- 🤖 Telegram bot with Web Apps interface
- 🌐 Web interface (HTMX + Tailwind CSS + DaisyUI)
- 📈 Reports and statistics
- 🔄 Change history (SCD Type 1 + History tables)
- 📱 Transfer support (transfers between accounts)

## Terminology (UI ↔ Code)

| UI (Russian) | Code (English) | DB Table | Description |
|--------------|----------------|----------|-------------|
| **Счет** | `FinancialCenter` | `t_d_financial_center` | Bank accounts, wallets, cash |
| **Место затрат** | `CostCenter` | `t_d_cost_center` | Projects, departments, expense categories |
| **Статья** | `Article` | `t_d_article` | Budget categories (hierarchical) |
| **Транзакция** | `BudgetFact` | `t_f_budget_fact` | Income, expenses, transfers |

## Architecture

### Stack
- **Backend**: FastAPI 0.121.2 + SQLModel + asyncpg
- **Database**: PostgreSQL 16 + Alembic migrations
- **Bot**: python-telegram-bot 21.10
- **Frontend**: HTMX + Jinja2 + Tailwind CSS + DaisyUI
- **Deployment**: Docker Compose + bash scripts
- **Authentication**: JWT (httpOnly cookies) + Telegram OAuth

### Key Components

**1. Backend (FastAPI)**
- `backend/app/main.py` - Application entry point
- `backend/app/api/v1/router.py` - API v1 router
- `backend/app/api/web/router.py` - Web pages router
- `backend/app/core/config.py` - Settings (Pydantic Settings)
- `backend/app/db/session.py` - Database connection pool
- `backend/app/middleware/` - JWT auth, logging, CSP, validation

**2. Database Models (SQLModel)**
All models use **SCD Type 1** (in-place updates) + separate **History tables** (SCD Type 2):
- `Article` - Budget categories (hierarchical, shared across users)
- `ArticleHistory` - Article change history (SCD Type 2)
- `BudgetFact` - Facts (fact table)
- `BudgetFactHistory` - BudgetFact change history (SCD Type 2)
- `User` - Users (SCD Type 1 + UserHistory)
- `FinancialCenter` - Financial centers (accounts, wallets)
- `CostCenter` - Cost centers (projects, departments)
- `ArticleHierarchy` - Closure table for category hierarchy
- `Notification` - Notifications (broadcast support)
- `ImportStaging` - Staging table for Tinkoff import

**3. Database Migrations (Alembic)**
- `backend/db/migrations/env.py` - Alembic environment
- `backend/db/migrations/versions/` - Migration files
- Format: `YYYYMMDD_hash_description.py`
- **Important**: Migration 20251110 - baseline v5.1.0 (consolidated)

**4. Telegram Bot**
- `bot/bot.py` - Main bot handler
- `bot/utils/api_client.py` - Backend API client
- `bot/utils/telegram_auth.py` - Telegram OAuth
- `bot/utils/notification_service.py` - Push notifications
- `bot/jobs/weekly_report.py` - Weekly report job

**5. Frontend**
- **Web UI**: HTMX + Jinja2 templates + Tailwind CSS + DaisyUI
- **Telegram Web Apps**: Standalone HTML pages for Menu Button
- **Shared modules**: Category tree (Choices.js), calendar widget, date formatter

## Development Commands

### Local Development

```bash
# Python virtual environment
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Run backend locally (requires PostgreSQL)
uvicorn backend.app.main:app --reload --port 8000

# Run bot locally
cd bot
python bot.py
```

### Database (Alembic)

```bash
# Create new migration (from backend/ directory)
cd backend
alembic revision --autogenerate -m "description of changes"

# Apply migrations
alembic upgrade head

# Rollback migration
alembic downgrade -1

# Show current version
alembic current

# Show migration history
alembic history

# IMPORTANT: Before creating migration check env.py - it imports all models
```

### Frontend (Tailwind CSS + JS)

```bash
# Build Tailwind CSS
npm run build:css

# Watch mode (automatic rebuild)
npm run watch:css

# Minify JS
npm run minify:js

# Minify CSS
npm run minify:css

# Full build (CSS + JS + minify)
npm run build

# Validate minified files
npm run validate:minified
```

### Testing

```bash
# All tests
pytest

# Only unit tests
pytest -m unit

# Only integration tests
pytest -m integration

# E2E tests (Playwright)
npx playwright test
npx playwright test --ui  # Interactive mode

# With coverage
pytest --cov=backend --cov=bot --cov-report=html

# Specific test
pytest tests/unit/test_article_service.py::test_create_article

# Verbose mode
pytest -v -s
```

### Code Quality

```bash
# Linting (ruff)
ruff check backend/
ruff check --fix backend/  # Auto-fix

# Formatting (black)
black backend/
black --check backend/  # Check only

# Type checking (mypy)
mypy backend/

# All checks together
ruff check backend/ && black --check backend/ && mypy backend/
```

### Docker (Deployment)

```bash
# IMPORTANT: Run from repository directory (~/familyBudget), NOT from /opt/budget

# Basic deployment (postgres + backend)
./deploy.sh

# Full deployment (+ nginx + bot + certbot)
./deploy.sh --profile full

# Rebuild images
./deploy.sh --build

# Foreground mode (real-time logs)
./deploy.sh --foreground

# Clean deployment (DELETES ALL DATA!)
./deploy.sh --clean

# Without migrations
./deploy.sh --no-migrate

# Docker Compose commands (from /opt/budget)
cd /opt/budget
docker compose ps                    # Status
docker compose logs -f backend       # Backend logs
docker compose restart backend       # Restart
docker compose down                  # Stop
docker compose exec backend bash     # Shell in container

# Diagnostics and logs
./logs.sh                   # Full diagnostics
./logs.sh --save            # Save to file
./logs.sh --quick           # Status only
./logs.sh --alert           # Critical issues only
./logs.sh --follow backend  # Live tail
```

### Backup & Restore

```bash
# Backup PostgreSQL
./scripts/backup.sh

# Restore backup
./scripts/restore.sh /opt/budget/backups/backup_20251120.sql

# S3 backup (if S3 configured)
./scripts/s3_backup.py
```

### UFW Firewall for PostgreSQL

**Automatic Configuration:** `deploy.sh` automatically configures UFW rules for PostgreSQL based on `.env` variables.

**Environment Variables:**
- `POSTGRES_EXTERNAL_ACCESS` - Enable external PostgreSQL access (default: `false`)
- `POSTGRES_ALLOWED_IP` - IP address allowed to connect (required if `POSTGRES_EXTERNAL_ACCESS=true`)

**Behavior:**

```bash
# Scenario 1: External access DISABLED (default, most secure)
POSTGRES_EXTERNAL_ACCESS=false

# Result: All UFW rules for port 5432 are removed (internal Docker only)
# PostgreSQL accessible ONLY from Docker containers

# Scenario 2: External access ENABLED with specific IP
POSTGRES_EXTERNAL_ACCESS=true
POSTGRES_ALLOWED_IP=192.168.1.100

# Result: UFW rule created: allow from 192.168.1.100 to any port 5432
# Old rules automatically removed, new rule created

# Scenario 3: External access ENABLED but IP not set (ERROR)
POSTGRES_EXTERNAL_ACCESS=true
POSTGRES_ALLOWED_IP=

# Result: ERROR - deployment fails for security
# Message: "POSTGRES_ALLOWED_IP is not set! This would allow from ANY IP (security risk)"
```

**Manual Management:**

```bash
# Test UFW configuration function (without deploy)
cd ~/familyBudget
source scripts/lib/config.sh
source scripts/lib/utils.sh
source scripts/lib/firewall.sh
configure_ufw_for_postgres

# Check current UFW rules
sudo ufw status numbered
# Look for rules with port 5432

# Manually add rule (if not using deploy.sh)
sudo ufw allow from 192.168.1.100 to any port 5432 comment "PostgreSQL external access"

# Manually remove rule
sudo ufw status numbered  # Find rule number for port 5432
sudo ufw delete <rule-number>

# Verify PostgreSQL external connectivity
psql -h <server-ip> -U familybudget -d familybudget
# Should connect if IP allowed, timeout if blocked
```

**Security Notes:**
- ✅ **Recommended:** `POSTGRES_EXTERNAL_ACCESS=false` (internal only via Docker)
- ⚠️ **Use sparingly:** External access only for remote administration
- ❌ **Never:** Leave `POSTGRES_ALLOWED_IP` empty when `POSTGRES_EXTERNAL_ACCESS=true`
- 🔒 **Defense in depth:** UFW rules + Docker firewall (DOCKER-USER chain) both protect PostgreSQL

**Troubleshooting:**

```bash
# Check UFW status
sudo ufw status verbose

# Check Docker firewall (iptables)
sudo iptables -L DOCKER-USER -n -v --line-numbers

# Test PostgreSQL connectivity from external IP
# From allowed IP:
psql -h <server-ip> -U familybudget -d familybudget
# Should connect if rules correct

# From blocked IP:
psql -h <server-ip> -U familybudget -d familybudget
# Should timeout (no route / connection refused)

# Logs
tail -f /opt/budget/logs/deploy.log
# Look for "Configuring UFW Rules for PostgreSQL"
```

**See also:**
- `scripts/lib/firewall.sh` - Firewall configuration functions
- `deploy.sh` lines 1447-1456 - Automatic UFW configuration during deployment

## Testing Environment Workflow

**CRITICAL:** This is the ONLY approved process for testing changes on the test server (budget-test).

### Standard Testing Procedure

**Prerequisites:**
- SSH access configured for `budget-test` server
- Changes committed to `test` branch in local repository
- Test server has `~/familyBudget` repository cloned

**Step-by-Step Process:**

```bash
# 1. Connect to test server
ssh budget-test

# 2. Pull latest changes in test branch
cd ~/familyBudget
git pull origin test

# 3. Execute deployment with patch mode
sudo bash deploy.sh --sync-mode update --cleanup-mode smart --patch

# 4. Analyze terminal output during deployment
# Watch for:
# - Build errors
# - Migration failures
# - Container startup issues
# - Port conflicts

# 5. After successful completion, review deployment log
cat /opt/budget/logs/deploy.log
# Look for:
# - WARNING/ERROR entries
# - Failed health checks
# - Incomplete operations

# 6. Analyze running container logs
cd /opt/budget
docker compose logs -f backend     # Backend application logs
docker compose logs -f postgres    # Database logs
docker compose logs -f nginx       # Web server logs
docker compose logs -f bot         # Telegram bot logs

# Check for:
# - Python exceptions/tracebacks
# - SQL errors
# - Connection failures
# - Resource warnings (memory, CPU)
```

### Issue Resolution Workflow

**When issues are found:**

```bash
# 1. Document the issue
# - Screenshot error messages
# - Copy relevant log excerpts
# - Note reproduction steps

# 2. Fix locally in repository (NOT on server)
cd ~/familyBudget  # Local machine
# Edit files
# Test locally if possible

# 3. Commit and push to test branch
git add .
git commit -m "fix: description of fix"
git push origin test

# 4. Return to Step 1 (deploy on test server again)
```

### Post-Deployment Verification

**CRITICAL:** Always check for orphaned processes after deployment.

```bash
# Check for processes that should have stopped
ps aux | grep -E "(uvicorn|gunicorn|python.*bot\.py)" | grep -v grep

# Check Docker container status
docker compose ps

# Verify only expected containers are running:
# - postgres (always)
# - backend (always)
# - nginx (if --profile full)
# - bot (if --profile full)
# - certbot (if --profile full, may be stopped after cert renewal)

# Check for port conflicts
sudo netstat -tlnp | grep -E ":(5432|8000|80|443)"

# Check system resources
docker stats --no-stream

# Verify application health
curl -s http://localhost:8000/health | jq
curl -s http://localhost:8000/ready | jq
```

### Common Issues and Diagnostics

**Issue: Container fails to start**
```bash
# Check container logs
docker compose logs --tail=100 <container-name>

# Inspect container state
docker compose ps -a

# Check for port conflicts
sudo lsof -i :<port-number>
```

**Issue: Migration fails**
```bash
# Check migration status
docker compose exec backend alembic current
docker compose exec backend alembic history

# View migration logs
grep -A20 "Migration" /opt/budget/logs/deploy.log

# Manually run migrations (if safe)
docker compose exec backend alembic upgrade head
```

**Issue: Orphaned processes**
```bash
# Find orphaned Python processes
ps aux | grep python | grep -v docker

# Kill orphaned processes (be careful!)
sudo pkill -f "uvicorn.*familybudget"
sudo pkill -f "python.*bot\.py"

# Verify clean state
ps aux | grep -E "(uvicorn|gunicorn|python.*bot)" | grep -v grep
# Should return nothing
```

### Deployment Flags Explained

**Flags used in standard testing workflow:**

- `--sync-mode update`: Sync only changed files from repository to /opt/budget
  - Faster than full sync
  - Preserves .env and other local configs
  - Safe for incremental updates

- `--cleanup-mode smart`: Intelligent cleanup of old artifacts
  - Removes old Docker images (not used by running containers)
  - Cleans up temporary files
  - Preserves backups and logs
  - Safe for regular deployments

- `--patch`: Patch deployment (no rebuild unless necessary)
  - Restarts only changed services
  - Fast deployment (2-5 minutes vs 10-15 for full rebuild)
  - Preserves database and volumes
  - **Use for:** Code changes, config updates, minor fixes
  - **Don't use for:** Dependency changes, Dockerfile changes, major refactoring

### Test Branch Workflow

**IMPORTANT:** The `test` branch is for testing only. Never merge untested code to `main`.

```bash
# Local development workflow:
git checkout test
# Make changes
git add .
git commit -m "type: description"
git push origin test

# Test on budget-test server (see Standard Testing Procedure above)

# If tests pass, merge to main
git checkout main
git merge test
git push origin main

# If tests fail, return to development
git checkout test
# Fix issues
# Repeat cycle
```

### Performance Benchmarks (budget-test)

**Expected deployment times:**
- Patch deployment (`--patch`): 2-5 minutes
- Full rebuild (`--build`): 10-15 minutes
- Clean deployment (`--clean`): 15-20 minutes

**Expected container startup times:**
- postgres: 5-10 seconds
- backend: 10-15 seconds (includes migrations)
- nginx: 2-5 seconds
- bot: 5-10 seconds

**If deployment takes longer:** Check logs for issues (network, disk I/O, resource constraints).

### Emergency Procedures

**If deployment fails catastrophically:**

```bash
# 1. Stop all containers
cd /opt/budget
docker compose down

# 2. Check system resources
df -h          # Disk space
free -h        # Memory
docker system df  # Docker disk usage

# 3. Clean Docker system (if space issue)
docker system prune -a --volumes  # ⚠️ DELETES ALL DATA

# 4. Restore from backup (if data corrupted)
cd ~/familyBudget
./scripts/restore.sh /opt/budget/backups/latest.sql

# 5. Clean redeployment
sudo bash deploy.sh --clean --profile full
```

**If test server becomes unresponsive:**

```bash
# From local machine
ssh budget-test "sudo reboot"

# Wait 2-3 minutes, then reconnect
ssh budget-test

# Check services after reboot
cd /opt/budget
docker compose ps
```

### Checklist: Before Leaving Test Server

**Always verify before disconnecting SSH:**

- [ ] All expected containers are running (`docker compose ps`)
- [ ] No orphaned processes (`ps aux | grep python`)
- [ ] Application responds to health checks (`curl localhost:8000/health`)
- [ ] Logs show no errors (`docker compose logs --tail=50`)
- [ ] Disk space is adequate (`df -h`)
- [ ] No port conflicts (`sudo netstat -tlnp`)

**Clean exit:**
```bash
# Review final state
cd /opt/budget
docker compose ps
docker stats --no-stream

# Exit SSH
exit
```

## Important Concepts and Patterns

### SCD Type 1 + History Tables

**Since version 5.1.0 architecture changed:**
- **Main tables** (Article, User, etc.) contain ONLY current state (SCD Type 1)
- **History tables** (ArticleHistory, UserHistory, etc.) store ALL history (SCD Type 2)
- **Benefits**: Stable PK in fact tables, simple queries, performance

**Examples:**
```python
# Update Article (in-place)
article.name = "New Name"
await session.commit()  # UPDATE, not INSERT

# History is automatically recorded via database triggers or service layer
```

### Hierarchical Categories (Closure Table)

Articles use **Closure Table** pattern for efficient hierarchical queries:
- `ArticleHierarchy` - Closure table (ancestor_id, descendant_id, depth)
- Allows fast retrieval of: subtree, ancestors, breadcrumbs, depth

**Examples:**
```python
# Get all child categories
subtree = await article_service.get_subtree(article_id)

# Get all parent categories
ancestors = await article_service.get_ancestors(article_id)

# Breadcrumbs (from root to article)
breadcrumbs = await article_service.get_breadcrumbs(article_id)
```

### Shared Family Budget Model

**Data Model:** Project uses "Shared Family Budget" - all users see ALL data.

**Important features:**
- **Articles**: Shared across all users (READ for all, WRITE for admin only)
- **BudgetFact**: Shared - all users see all family transactions
- **FinancialCenter, CostCenter**: Shared - common directories for entire family
- **user_id in BudgetFact**: Indicates WHO created record, but does NOT restrict access

### Transfer Deduplication (Offline Sync & Duplicate Prevention)

**Added in version 5.4.1** - Critical fix to prevent duplicate transfer creation.

**Problem Solved:**
- Frontend double-submission (multiple clicks, network retries, race conditions)
- Offline sync repeated clicks
- Multiple form submissions creating duplicate transfers

**Architecture:**

Transfers use **sync_hash + content_hash** deduplication pattern (same as Facts):

```python
# Migration: 20251214_v7h8i9j0k1l2_add_deduplication_hashes.py
# Added to t_f_budget_fact and t_f_budget_fact_history:
- sync_hash: VARCHAR(32) NULL - MD5(content_hash|user_id|created_date)
- content_hash: VARCHAR(32) NULL - MD5(article_id|amount|fact_date|description|record_type)
```

**Deduplication Logic in transfers.py:143-241:**

1. **Check for duplicate** (if `is_offline_sync=true` AND `sync_hash` provided):
   ```python
   # Search for existing transfer with same sync_hash < 24 hours
   duplicate_stmt = select(BudgetFact).where(
       BudgetFact.sync_hash == transfer.sync_hash,
       BudgetFact.is_offline_sync == True,
       BudgetFact.transfer_id.isnot(None),
       BudgetFact.created_at >= datetime.utcnow() - timedelta(days=1)
   )
   ```

2. **Return existing transfer** (idempotent response):
   ```python
   if existing_fact:
       # Load both expense and income facts via transfer_id
       # Return TransferResponse with existing transfer_id + fact IDs
       return TransferResponse(
           transfer_id=existing_transfer_id,
           expense_fact_id=expense_fact.id,
           income_fact_id=income_fact.id,
           ...
       )
   ```

3. **Create new transfer** (if no duplicate found):
   ```python
   # Save sync_hash and content_hash to BOTH facts (expense + income)
   expense_fact = BudgetFact(
       ...,
       sync_hash=transfer.sync_hash,
       content_hash=transfer.content_hash,
   )
   income_fact = BudgetFact(
       ...,
       sync_hash=transfer.sync_hash,  # Same hash for both facts
       content_hash=transfer.content_hash,
   )
   ```

**Why sync_hash is SAME for both facts:**
- Transfer creates 2 BudgetFact records (expense + income)
- Both facts belong to same logical transfer operation
- Same `sync_hash` allows duplicate detection on EITHER fact
- Both facts share same `transfer_id` for linking

**Testing Deduplication:**

```bash
# 1. Create transfer with sync_hash
curl -X POST http://localhost:8000/api/v1/transfers \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "from_financial_center_id": 1,
    "to_financial_center_id": 2,
    "from_article_id": 10,
    "to_article_id": 20,
    "amount": 100.00,
    "transfer_date": "2025-12-25",
    "is_offline_sync": true,
    "sync_hash": "abc123unique456hash789"
  }'

# Response: {"transfer_id": 100, "expense_fact_id": 200, "income_fact_id": 201, ...}

# 2. Repeat SAME request → should return EXISTING transfer
curl -X POST ... (same payload)

# Response: {"transfer_id": 100, ...}  # Same IDs (no new transfer created!)

# 3. Check database - should have exactly 2 BudgetFact records
docker compose exec postgres psql -U familybudget -d familybudget -c \
  "SELECT id, transfer_id, sync_hash FROM t_f_budget_fact WHERE transfer_id = 100;"

# Expected: 2 rows (expense + income), both with same sync_hash

# 4. Check logs - second request should log deduplication
docker compose logs backend | grep "\[DEDUP\]"
# Expected: [DEDUP] Transfer duplicate detected: sync_hash=abc123..., existing_transfer_id=100
```

**Comparison with facts.py:**

| Feature | facts.py (single record) | transfers.py (2 records) |
|---------|--------------------------|--------------------------|
| Deduplication check | ✅ Yes (lines 111-173) | ✅ Yes (lines 173-241) |
| sync_hash usage | ✅ Per-record hash | ✅ Same hash for expense + income |
| content_hash usage | ✅ Per-record content | ✅ Same content for both facts |
| Idempotent response | ✅ Returns existing fact | ✅ Returns existing transfer |
| Time window | ✅ 24 hours | ✅ 24 hours |
| Write-Behind support | ✅ Yes (async via Redis) | ⚠️ No (sync write only) |

**Future Enhancement:**
- Add Write-Behind pattern to transfers.py for async writes (like facts.py)
- Would reduce latency from ~50ms to ~10ms for transfer creation

**Related Files:**
- `backend/app/schemas/transfer.py:69-78` - sync_hash/content_hash fields
- `backend/app/api/v1/endpoints/transfers.py:173-241` - Deduplication logic
- `backend/db/migrations/versions/20251214_v7h8i9j0k1l2_add_deduplication_hashes.py` - Migration

### JWT Authentication

- JWT tokens in **httpOnly cookies** (security)
- Middleware `JWTAuthMiddleware` automatically validates tokens
- Refresh tokens in DB (`RefreshToken` model)
- Telegram OAuth for login (`/auth/telegram` endpoint)

### Background Jobs (Scheduler)

- APScheduler for periodic tasks
- `backend/app/scheduler.py` - Scheduler configuration
- `bot/jobs/` - Job functions

**Example jobs:**
- Weekly report (every Monday)
- Database cleanup
- SSL certificate renewal check

## Critical Best Practices

### SQLAlchemy 2.0 AsyncSession

**CRITICALLY IMPORTANT:** Always use `await` for all async AsyncSession methods.

**Correct:**
```python
# Async methods require await
await session.execute(query)
await session.commit()
await session.delete(obj)
await session.refresh(obj)
```

**INCORRECT (RuntimeWarning):**
```python
# ❌ WITHOUT await - coroutine created but NOT executed!
session.delete(obj)  # RuntimeWarning: coroutine 'AsyncSession.delete' was never awaited
await session.commit()  # Commits empty transaction - nothing deleted!
```

**Consequences of missing `await`:**
- RuntimeWarning in logs
- Coroutines don't execute
- `commit()` commits empty transaction
- Data remains in DB (despite success logs)
- Very difficult to catch (code runs, logs write, but nothing happens)

### History Tables: Complete Field Copying

**Rule:** When creating records in History tables (`BudgetFactHistory`, `ArticleHistory`, etc.) MUST copy ALL fields from main table, including nullable fields.

**Why this is important:**
- History tables should preserve data snapshot at time of change
- NOT NULL constraints in History table are stricter than in main table (for data quality)
- Missing field = constraint violation = transaction rollback

**Example (BudgetFactHistory):**
```python
# ✅ CORRECT - all fields copied
fact_history = BudgetFactHistory(
    fact_id=fact.id,
    user_id=fact.user_id,
    article_id=fact.article_id,
    financial_center_id=fact.financial_center_id,  # nullable, but copy
    cost_center_id=fact.cost_center_id,            # nullable, but copy
    amount=fact.amount,
    fact_date=fact.fact_date,
    description=fact.description,
    record_type=fact.record_type,  # ⚠️ REQUIRED! NOT NULL in history
    transfer_id=fact.transfer_id,  # nullable, but copy for completeness
    valid_from=datetime.utcnow(),
    is_current=True,
    change_type="CREATE",
)

# ❌ INCORRECT - record_type missing
# → IntegrityError: null value in column "record_type"
```

### SSE Single Worker Requirement

**CRITICAL:** This application MUST run with WORKERS=1 (single uvicorn worker).

The SSE implementation uses in-memory BudgetConnectionManager which does NOT share state between workers. Running with multiple workers will cause SSE events to be lost.

**Why this is critical:**
- SSE is used for real-time updates on main page (metrics, recent records)
- Each uvicorn worker has its OWN instance of `BudgetConnectionManager`
- In multi-worker: user A on worker 1 creates transaction → broadcast only goes to worker 1 clients
- User B on worker 2 does NOT receive event → doesn't see changes without reload

**Configuration:**
- `docker-compose.yml`: `--workers 1` (hardcoded)
- `setup.sh`: WORKERS=1 (no option to change)
- Dockerfile: `--workers 1` (default)

**For scaling:** Need to implement Redis Pub/Sub for SSE event synchronization between workers.

### Testing: Verify DB After Operations

**Rule:** After data modification operations (CREATE/UPDATE/DELETE) ALWAYS verify actual DB state, not just HTTP status codes.

**Why HTTP 200 != Successful Operation:**
- Async coroutines may not execute (see above)
- Logging happens BEFORE commit (may rollback after)
- Middleware may catch errors and return 200

**Best practice testing workflow:**

```bash
# 1. Execute operation via API
curl -X DELETE https://example.com/api/v1/admin/articles/45

# 2. ✅ REQUIRED: Verify DB
docker compose exec postgres psql -U familybudget -d familybudget -c \
  "SELECT COUNT(*) FROM t_d_article WHERE id = 45;"

# 3. Check logs for warnings/errors
docker compose logs backend | grep -A10 "DELETE.*articles/45" | grep -i "warning\|error"

# 4. For DELETE operations: check History tables
docker compose exec postgres psql -U familybudget -d familybudget -c \
  "SELECT change_type, COUNT(*) FROM t_d_article_history WHERE article_id = 45 GROUP BY change_type;"
```

### Service Worker Updates

**Rule:** Service worker uses **aggressive auto-update** strategy - updates activate automatically within 1 hour of deployment.

**Why this is critical:**
- All users must be on same version for data consistency
- Bug fixes and security patches deploy immediately
- No manual user intervention required
- Mobile app-like update experience

**Implementation (since v5.4.0):**
1. Service worker calls `skipWaiting()` on install (immediate activation)
2. Service worker calls `clients.claim()` on activate (take control of all tabs)
3. Update checks run every **1 hour** (plus on every page load)
4. Users see 3-second countdown before automatic reload
5. All tabs reload simultaneously

**Update Flow:**

```bash
# 1. Deploy new version
./deploy.sh --profile full

# 2. Service worker version updated automatically via scripts/update-sw-version.sh
# CACHE_VERSION set to: v20251224_2029 (timestamp)

# 3. Users trigger update check (page reload OR hourly check)
# Console logs:
[PWA] Checking for updates...
[PWA] New service worker found, installing...
[SW] Installing version: v20251224_2029
[SW] CRITICAL: Forcing immediate activation via skipWaiting()
[SW] Activating version: v20251224_2029
[SW] Deleted 1 old caches
[SW] Clients claimed
[SW] Notifying 1 clients about SW update
[PWA] New service worker activated, reloading in 3 seconds...
[Countdown toast: "Обновление приложения через 3... 2... 1..."]
[PWA] Reloading page...
[Page reloads automatically]

# 4. Result: User on new version within 3 seconds
```

**Testing Update Flow:**

```bash
# Manual testing (local development)
cd ~/familyBudget

# 1. Note current version in browser console
# [SW] Activating version: v20251224_1500

# 2. Update CACHE_VERSION in sw.js
scripts/update-sw-version.sh

# 3. Minify service worker
npm run minify:js

# 4. Reload page in browser
# Observe console logs (should show update flow above)

# 5. Verify new version active
# [SW] Activating version: v20251224_1530
```

**Multi-Tab Testing:**

```bash
# 1. Open app in 3 different browser tabs
# 2. Deploy new version (or update sw.js locally)
# 3. Reload any tab
# 4. Verify: All 3 tabs show countdown simultaneously
# 5. Verify: All 3 tabs reload within 3 seconds
# 6. Verify: All tabs on same new version
```

**Debugging:**

```bash
# Check current service worker version
# DevTools → Console:
navigator.serviceWorker.controller.scriptURL
# Should show: /sw.min.js

# Check cache version
# DevTools → Application → Cache Storage:
# Should have exactly 1 cache: budget-vXXXXXXXX_XXXX

# Check update registration
# DevTools → Application → Service Workers:
# Status: "activated and is running"
# Update on reload: (toggle for testing)

# Force update check (in console)
navigator.serviceWorker.getRegistration().then(reg => reg.update());
```

**Important Notes:**
- **No state preservation:** Users should save work before reload
- **First-time install:** Does NOT trigger reload (shows toast "Приложение готово к работе офлайн")
- **Offline functionality:** Unchanged (IndexedDB, background sync, push notifications all work)
- **Update frequency:** Max 1-hour delay for 99% of users

**Risks:**
- User may lose unsaved form data during update → Mitigation: Display UI warning
- Update may interrupt transaction submission → Future: Add check to delay reload

**See also:**
- `/docs/architecture/pwa.md` - Comprehensive PWA documentation
- `sw.js` lines 75-163 - Service worker install/activate events
- `frontend/web/templates/base.html` lines 1309-1407 - Frontend registration

## Workflow for Updating Application

**Critical to understand three directories:**
1. **Repository** (`~/familyBudget`) - Source code, git clone
2. **Deployment** (`/opt/budget`) - Working copy for Docker
3. **Docker volumes** - DB data, logs (persistent)

**Correct workflow:**
```bash
# 1. Update code in repository
cd ~/familyBudget
git pull origin main

# 2. Sync to /opt/budget
./setup.sh

# 3. Apply changes
./deploy.sh --profile full
```

**Common mistakes:**
```bash
# ❌ INCORRECT (copies itself to itself)
cd /opt/budget
./setup.sh

# ✅ CORRECT
cd ~/familyBudget  # Repository
./setup.sh         # Copies to /opt/budget
```

## API Endpoints

### Authentication
- `POST /auth/telegram` - Telegram OAuth login
- `POST /auth/refresh` - Refresh JWT token
- `POST /auth/logout` - Logout

### REST API v1
- `/api/v1/articles` - CRUD categories
- `/api/v1/facts` - CRUD transactions
- `/api/v1/financial-centers` - CRUD financial centers
- `/api/v1/cost-centers` - CRUD cost centers
- `/api/v1/users` - User management (admin)

### Web Pages (HTMX)
- `/` - Home page
- `/transactions` - Transactions list
- `/statistics` - Statistics dashboard
- `/admin` - Admin panel

### Telegram Web Apps
- `/webapp/` - Main menu
- `/webapp/add.html` - Add transaction
- `/webapp/history.html` - Transaction history
- `/webapp/stats.html` - Statistics

### Health Checks
- `/ping` - Simple ping
- `/health` - Basic health check
- `/ready` - Readiness probe
- `/health/detailed` - Detailed diagnostics

## Documentation

| Document | For |
|----------|-----|
| [START.md](START.md) | 🔧 Administrators (installation) |
| [CLAUDE.md](CLAUDE.md) | 👨‍💻 Developers |
| [docs/prd/](docs/prd/) | 📋 Product Requirements |
| [docs/guides/](docs/guides/) | 📖 User guides |
| `/docs` (Swagger) | 🔌 API documentation |
