# CLAUDE.md

This file provides guidance to Claude Code when working with code in this repository.

## Project Overview

Family Budget is a family budget management system with Telegram bot and web interface. Built on FastAPI (backend), PostgreSQL (database), Docker deployment.

**Key Features:**
- 🔐 Authentication: Telegram OAuth, Email+Password, WebAuthn biometrics
- 📊 Hierarchical budget categories (Closure Table pattern)
- 💰 Transaction tracking with offline sync support
- 🤖 Telegram bot with Web Apps
- 🌐 Progressive Web App (HTMX + Tailwind CSS + DaisyUI)
- 📈 Real-time updates via WebSocket + Redis Pub/Sub
- 🔄 Change history (SCD Type 1 + History tables)

**Stack:** FastAPI 0.121.2 | PostgreSQL 16 | python-telegram-bot 21.10 | Docker Compose

## Quick Start

### Local Development
```bash
# Backend
cd backend
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt
uvicorn backend.app.main:app --reload

# Database migrations
cd backend
alembic upgrade head
alembic revision --autogenerate -m "description"

# Frontend build
npm run build        # Full build (CSS + JS + minify + precompress)
npm run watch:css    # Watch mode
```

### Testing Environment Workflow

**CRITICAL:** Test changes ONLY on budget-test server via standard procedure:

```bash
# 1. Connect and pull latest code
ssh budget-test
cd ~/familyBudget && git pull origin test

# 2. Deploy with patch mode
sudo bash deploy.sh --sync-mode update --cleanup-mode smart --patch

# 3. Verify deployment
docker compose ps
curl -s http://localhost:8000/health | jq

# 4. Check logs for errors
docker compose logs -f backend
```

**See:** `/docs/architecture/guides/deployment-troubleshooting.md` for complete guide

### Docker Deployment
```bash
# From repository directory (~/familyBudget)
./deploy.sh                          # Basic (postgres + backend)
./deploy.sh --profile full           # Full (+ nginx + bot + certbot)
./deploy.sh --build                  # Rebuild images
./deploy.sh --patch                  # Fast patch deployment (2-5 min)

# Diagnostics
./logs.sh                            # Full diagnostics
./logs.sh --follow backend           # Live tail
```

## Terminology (UI ↔ Code)

| UI (Russian) | Code | DB Table | Description |
|--------------|------|----------|-------------|
| **Счет** | `FinancialCenter` | `t_d_financial_center` | Bank accounts, wallets |
| **Место затрат** | `CostCenter` | `t_d_cost_center` | Projects, departments |
| **Статья** | `Article` | `t_d_article` | Budget categories (hierarchical) |
| **Транзакция** | `BudgetFact` | `t_f_budget_fact` | Income/expenses/transfers |

## Architecture

### Key Components

**Backend:**
- `backend/app/main.py` - Application entry point
- `backend/app/api/v1/` - REST API endpoints
- `backend/app/api/web/` - Web pages (HTMX)
- `backend/app/services/` - Business logic
- `backend/app/middleware/` - Auth, logging, CSP

**Database:**
- SCD Type 1 (main tables) + SCD Type 2 (history tables)
- Closure Table for category hierarchy
- PostgreSQL 16 + Alembic migrations

**Frontend:**
- Progressive Web App (PWA)
- HTMX + Tailwind CSS + DaisyUI
- Web Workers for heavy processing
- Service Worker with cache busting
- Real-time updates via WebSocket

**See detailed architecture:**
- `/docs/architecture/README.md` - Dependency graph + recent changes
- `/docs/architecture/authentication.md` - Auth system (JWT, OAuth, WebAuthn)
- `/docs/architecture/pwa.md` - PWA features, offline support, caching
- `/docs/architecture/websocket.md` - Real-time updates, Redis Pub/Sub
- `/docs/architecture/web-workers.md` - Background processing
- `/docs/architecture/build-system.md` - Build pipeline, optimization
- `/docs/architecture/recurring-plans.md` - Recurring payments system
- `/docs/architecture/notifications.md` - Push + Telegram notifications
- `/docs/architecture/transfers-system.md` - Transfer deduplication
- `/docs/architecture/es-modules-migration.md` - ES Modules migration (v7.0.0)

### Module System (v7.0.0+)

**Build System:** Vite + TypeScript
**Module Format:** ES Modules (ESM)
**Bundle Output:** IIFE for browser compatibility

#### Module Structure

All large modules follow consistent structure:
- `core/`: State management (ZERO dependencies!) + core operations
- `operations/` or `rendering/`: Main functionality
- `features/`: Optional features (search, autocomplete, multi-tab, etc.)
- `ui/`: UI components (modals, toasts, dialogs)
- `integration/`: External integrations (API, WebSocket, offline)
- `index.ts`: Barrel export (public API)

#### Development Commands

```bash
# Production build (minified + gzipped)
npm run build              # Vite build (TypeScript → minified JS + CSS)

# Development mode with HMR
npm run dev                # Vite dev server (instant updates)

# Watch mode (auto-rebuild on file changes)
npm run watch              # CSS + JS watch

# Type check (0 errors required)
npm run type-check         # TypeScript validation
npm run type-check:watch   # Watch mode

# Bundle size analysis
npm run analyze            # Opens bundle-stats.html
```

**Deprecated Commands (v7.0.0+):**
```bash
# ❌ REMOVED - Do not use!
npm run bundle             # Use: npm run build
npm run bundle:dev         # Use: npm run dev
npm run minify:js          # Use: npm run build (automatic)
npm run minify:css         # Use: npm run build (automatic)
```

#### Import Patterns

```typescript
// Barrel exports (recommended)
import { loadShoppingLists, createItem } from '@web/lists/listsManager';

// Direct imports (when needed)
import { ListsState } from '@web/lists/listsManager/core/ListsState';

// Type-only imports
import type { ShoppingList, ShoppingItem } from '@web/lists/listsManager';
```

#### TypeScript Hybrid Approach (v7.1.0+)

**Critical**: Family Budget uses hybrid TypeScript/JavaScript approach:
- **Development**: .ts files for type-checking and IDE support
- **Production**: .js files remain for backward compatibility
- **Build**: Vite compiles .ts → .js automatically during build

**Type Definition Files (types/):**
- `api.d.ts` - API responses, network types (170 lines)
- `models.d.ts` - Domain models (User, BudgetFact, Article, etc.) (219 lines)
- `global.d.ts` - Window namespace extensions (144 lines)
- `indexeddb.d.ts` - IndexedDB schema (167 lines)
- `navigator.d.ts` - Browser APIs (Network Information) (165 lines)
- `telegram.d.ts` - Telegram WebApp types (246 lines)

**Pre-commit Hook:**
```bash
# .husky/pre-commit automatically runs:
npm run type-check

# If TypeScript errors found → commit BLOCKED
# Fix errors in .ts files → retry commit
```

**Development Workflow:**
```bash
# 1. Edit TypeScript files (.ts)
vim frontend/web/static/js/offline/offlineManager.ts

# 2. Type check (optional, runs automatically on commit)
npm run type-check

# 3. Build (compiles .ts → .js)
npm run build

# 4. Commit (automatic type-check via pre-commit hook)
git commit -m "feat: new feature"
```

**See:** `/docs/architecture/build-system.md` for complete TypeScript integration guide

#### Module Foundations (Phase 2.1-2.5)

**Status:** Foundation modules created (state management only)

| Module | State File | Lines | Bundle Size |
|--------|-----------|-------|-------------|
| listsManager | ListsState.ts | 161 | 34KB total |
| budgetWSClient | WSState.ts | 308 | 34KB total |
| csvImporter | ImportState.ts | 204 | 34KB total |
| offlineManager | OfflineState.ts | 167 | 34KB total |
| webapp | storage.ts | 206 | 8.4KB |

**Future (Phase 3+):** Extract remaining logic from monolithic files

**See:** `/docs/architecture/es-modules-migration.md` for complete migration guide

#### Lists Bundle (v7.0.1+)

Shopping lists functionality consolidated into single bundle via build-all.js:

**Entry Point:** `frontend/web/static/js/lists-bundle.ts`
**Output:** `frontend/web/static/js/lists.min.js` (140 KB minified, 29.7 KB gzipped)
**Includes:**
- listsManager (TypeScript, modular structure) - Core CRUD logic
- csvImporter (TypeScript) - CSV import functionality
- googleSheetsImporter (JavaScript) - Google Sheets integration
- importManager (JavaScript) - Import coordination
- hierarchyView (JavaScript) - Hierarchy rendering

**Usage in HTML:**
```html
<script src="/static/js/lists.min.js?v={{ sw_version }}"></script>
```

**Build Configuration:**
```javascript
// build-all.js entry (added v7.0.1)
{
  name: 'lists',
  input: 'frontend/web/static/js/lists-bundle.ts',
  output: 'frontend/web/static/js/lists.min.js',
  globalName: 'ListsApp'
}
```

**Migration Notes:**
- Replaces 5 separate .min.js files in lists.html (deprecated as of v7.0.1)
- Built via build-all.js → vite.config.single.ts (same as other bundles)
- Fixed 404 errors from missing minified files (1-7 days stale)
- Total bundles: 32 (was 31)

### Database Patterns

**SCD Type 1 + History Tables (v5.1.0+):**
- Main tables: ONLY current state (in-place updates)
- History tables: ALL changes (SCD Type 2)
- Benefits: Stable PKs, simple queries, performance

```python
# Update Article (in-place)
article.name = "New Name"
await session.commit()  # UPDATE, not INSERT
# History recorded automatically via triggers/service
```

**Hierarchical Categories (Closure Table):**
- `ArticleHierarchy` table: ancestor_id, descendant_id, depth
- Fast queries: subtree, ancestors, breadcrumbs

```python
subtree = await article_service.get_subtree(article_id)
ancestors = await article_service.get_ancestors(article_id)
```

**Shared Family Budget:**
- All users see ALL data (no row-level security)
- `user_id` indicates creator, NOT access control
- Articles: Shared across users (READ all, WRITE admin only)

**See:** `/docs/architecture/database/` for complete schema documentation

## Critical Development Patterns

### 1. AsyncSession - ALWAYS await

**CRITICAL:** Missing `await` on AsyncSession methods causes silent failures.

```python
# ✅ CORRECT
await session.execute(query)
await session.commit()
await session.delete(obj)

# ❌ WRONG - RuntimeWarning + nothing happens!
session.delete(obj)          # Coroutine created but NOT executed
await session.commit()       # Commits empty transaction
```

### 2. History Tables - Copy ALL Fields

**Rule:** History records MUST copy ALL fields, including nullable ones.

```python
# ✅ CORRECT
fact_history = BudgetFactHistory(
    fact_id=fact.id,
    user_id=fact.user_id,
    article_id=fact.article_id,
    financial_center_id=fact.financial_center_id,  # nullable - copy anyway
    cost_center_id=fact.cost_center_id,            # nullable - copy anyway
    record_type=fact.record_type,                  # NOT NULL in history!
    transfer_id=fact.transfer_id,                  # nullable - copy for completeness
    valid_from=datetime.utcnow(),
    change_type="CREATE",
)

# ❌ WRONG - Missing record_type
# → IntegrityError: null value in column "record_type"
```

### 3. Testing - Verify DB After Operations

**Rule:** HTTP 200 ≠ Successful operation. ALWAYS verify DB state.

```bash
# 1. Execute operation
curl -X DELETE https://example.com/api/v1/admin/articles/45

# 2. ✅ REQUIRED: Verify DB
docker compose exec postgres psql -U familybudget -d familybudget -c \
  "SELECT COUNT(*) FROM t_d_article WHERE id = 45;"

# 3. Check logs
docker compose logs backend | grep "DELETE.*articles/45"
```

### 4. WebSocket Multi-Worker (v5.x+)

**Current:** Redis Pub/Sub for cross-worker event synchronization.

**Configuration:**
- `.env`: `REDIS_ENABLED=true` + `WORKERS=<N>`
- Fallback: In-memory (single worker only)

**See:** `/docs/architecture/websocket.md` for complete architecture

### 5. iOS Safari Quirks

**Rule:** Use `visibility: hidden` for guaranteed non-interactivity.

```css
/* ✅ CORRECT - NOT clickable on iOS */
.hidden-element {
    opacity: 0;
    visibility: hidden;        /* Required for iOS */
    pointer-events: none;
    transition: opacity 0.3s, visibility 0s 0.3s;
}

/* ❌ WRONG - Still clickable on iOS */
.hidden-element {
    opacity: 0;
    pointer-events: none;      /* Children can override on iOS! */
}
```

**See:** `/docs/architecture/frontend/responsive-design.md` for iOS best practices

### 6. Service Worker Updates (v6.4.1+)

**Strategy:** Manual update with "new" text indicator and version display.

**Modal Features (v7.x+):**
- **Version Display:** Shows transition `v20260107_1330 → v20260107_1400`
- **Current Version:** Gray badge from `localStorage.getItem('pwa_sw_version')`
- **New Version:** Yellow warning badge from `localStorage.getItem('pwa_new_version')`
- **Edge Cases:** Displays `(неизвестно)` for missing versions
- **User Choice:** "Позже" (defer) or "Обновить сейчас" (reload + clear cache)

**Update Flow:**
1. New SW detected → `controllerchange` event fires
2. Version comparison → "new" indicator appears in header
3. User clicks indicator → Modal shows version transition
4. User confirms → Unregister SW, clear all caches, reload page

**Build Requirements:**
```bash
# Development: No build needed for testing
npm run dev  # Vite dev server with HMR

# Production: Full build before deployment
npm run build  # Vite build + minify + gzip
```

**See:** `/docs/architecture/pwa.md` → Service Worker Updates for complete flow

### 7. Transfer Deduplication (v5.4.1+)

**Pattern:** `sync_hash` + `content_hash` prevent duplicate transfers.

```python
# Both facts (expense + income) share SAME sync_hash
expense_fact = BudgetFact(..., sync_hash=transfer.sync_hash)
income_fact = BudgetFact(..., sync_hash=transfer.sync_hash)
```

**See:** `/docs/architecture/transfers-system.md` for complete documentation

### 8. Deduplication Pattern (v6.8.0+)

**Rule:** Use singleton promise locks for functions called from multiple sources.

**Problem:** Race conditions when async function called simultaneously from 18+ locations.

**Solution:** Singleton promise lock (pattern from `offlineManager.js:82`).

```javascript
// ✅ CORRECT - Deduplication lock
let _operationLock = null;
let _callCount = 0;

async function deduplicatedOperation() {
    const callId = ++_callCount;
    console.log(`[DEDUP] Call #${callId}`);

    // If another call is in progress, wait for it
    if (_operationLock) {
        console.log(`[DEDUP] Call #${callId} waiting`);
        await _operationLock;
        console.log(`[DEDUP] Call #${callId} deduped`);
        return;
    }

    console.log(`[DEDUP] Call #${callId} starting`);

    // Create lock promise
    _operationLock = (async () => {
        try {
            await _operationImpl(callId);
        } finally {
            console.log(`[DEDUP] Call #${callId} releasing lock`);
            _operationLock = null;
        }
    })();

    await _operationLock;
    console.log(`[DEDUP] Call #${callId} completed`);
}

async function _operationImpl(callId) {
    // Actual work here
    const data = await db.getData();
    dom.update(data);
}

// ❌ WRONG - Race conditions
async function nonDeduplicatedOperation() {
    // Multiple simultaneous calls create conflicts
    const data = await db.getData();
    dom.update(data);  // Duplicate updates! Visual glitches!
}
```

**Benefits:**
- Before: 18 simultaneous DB reads + 18 DOM updates = ~200ms
- After: 1 DB read + 1 DOM update = ~15ms
- Improvement: **13x faster**, eliminates visual glitches

**Example:** `index.html:4453` (loadPendingRecords deduplication)

**See:** `index.html:4435-4479` for complete implementation

### 9. FAB Navigation Positioning (v7.x+)

**Rule:** Use `!important` for display properties to prevent CSS override conflicts.

**Pattern:**

```css
/* Mobile (< 1024px) */
@media (max-width: 1023px) {
    .fab-container {
        position: fixed !important;  /* Prevent override */
        bottom: 0;
        left: 0;
        right: 0;

        /* Safe-area-inset for iPhone notch */
        padding-bottom: calc(0.5rem + env(safe-area-inset-bottom));
    }

    .mobile-nav-wrapper {
        display: block !important;
    }

    .desktop-fab-wrapper {
        display: none !important;
    }
}

/* Desktop (≥ 1024px) */
@media (min-width: 1024px) {
    .fab-container {
        position: fixed !important;
        bottom: 1.5rem;
        right: 1.5rem;
    }

    .mobile-nav-wrapper {
        display: none !important;
        visibility: hidden !important;  /* iOS Safari protection */
    }

    .desktop-fab-wrapper {
        display: block !important;
    }
}
```

**iOS Safari Protection:**

```css
/* Speed Dial closed state - MUST include visibility: hidden */
.desktop-fab-wrapper.closed .fab-menu-item {
    opacity: 0;
    visibility: hidden;  /* Required for iOS Safari */
    pointer-events: none;
    transition: opacity 0.3s, visibility 0s 0.3s, transform 0.3s;
}

/* Speed Dial open state */
.desktop-fab-wrapper.open .fab-menu-item {
    opacity: 1;
    visibility: visible;
    pointer-events: auto;
    transition: opacity 0.3s, visibility 0s, transform 0.3s;
}
```

**Why `!important` is necessary:**
- Multiple stylesheets may compete for specificity
- Prevents accidental override from utility classes
- Guarantees mobile/desktop exclusive display

**Why `visibility: hidden` is required:**
- iOS Safari can still click elements with `opacity: 0` + `pointer-events: none`
- `visibility: hidden` provides guaranteed non-interactivity
- Transition delay (`0s 0.3s`) prevents flicker during animation

**Resize Listener Pattern (v7.x+):**

```javascript
// Dynamic breakpoint switching with debouncing
let resizeTimeout;
const BREAKPOINT = 1024;
let currentMode = mode;  // Track current mode

window.addEventListener('resize', function() {
    clearTimeout(resizeTimeout);

    resizeTimeout = setTimeout(function() {
        const newIsDesktop = window.innerWidth >= BREAKPOINT;
        const newMode = newIsDesktop ? 'desktop-fab' : 'mobile-nav';

        // Only update if mode actually changed (crossing breakpoint)
        if (newMode !== currentMode) {
            console.log('[FAB_TOOLBAR] Breakpoint crossed:', {
                from: currentMode,
                to: newMode,
                windowWidth: window.innerWidth,
                breakpoint: BREAKPOINT
            });

            currentMode = newMode;

            // Toggle visibility of mobile nav and desktop FAB
            // ... (see fab_toolbar.html for complete implementation)
        }
    }, 200);  // 200ms debounce delay
});
```

**Benefits:**
- Works on tablet rotation (landscape ↔ portrait) without page reload
- Handles desktop window resize dynamically
- Debouncing prevents excessive re-renders
- Preserves page-specific visibility logic (allowedPages)

**See:** `/docs/architecture/frontend/responsive-design.md` → FAB Navigation Architecture

## Important Features

### Admin Authentication Bypass (v6.3.0+)

Admin users can login via email/password WITHOUT 2FA (emergency access).

**See:** `/docs/architecture/admin-setup.md` for setup guide

### WebAuthn Biometric Auth (v6.5.0+)

Optional passwordless login (TouchID/FaceID/Windows Hello).

**See:** `/docs/architecture/authentication.md` → WebAuthn section

### Recurring Plans (v6.2.0+)

Automated recurring payments with MMDD encoding for yearly frequency.

**Example:** `frequency_value=315` → March 15 every year

**See:** `/docs/architecture/recurring-plans.md` for complete documentation

### Notification Preferences (v6.4.0+)

Users control Web Push and Telegram notifications independently.

**API:** `PATCH /api/v1/users/me/notification-preferences`

**See:** `/docs/architecture/notifications.md` for architecture

### Shopping List Quantity Format (v7.x+)

**Display:** Always shows integers (rounded from decimals if needed)
**Input:** HTML restricts to integers (`step="1"`)
**Storage:** NUMERIC(10,3) for backward compatibility

**Examples:**
- User enters: 5 → Stored as 5.000 → Displayed as "5"
- Legacy data: 2.5 kg → Displayed as "3 kg" (rounded)
- Empty: NULL → Displayed as "—"

**Implementation:**
- Frontend validation: `normalizeQuantityToInteger()` in listsManager.ts:3207
- Display formatting: `Math.round()` in tableBuilder.ts:51
- HTML constraint: `<input step="1" min="0">` in lists.html:350
- Backend: Accepts decimals, logs warnings for non-integers

### Bulk Delete Optimization (v6.6.0+)

WebSocket summary events eliminate toast spam during mass deletions.

**Pattern:** N individual events → 1 summary event

**See:** `/docs/architecture/bulk-delete-optimization.md` for complete guide

## Development Workflow

### Update Application

**Critical:** Understand three directories:
1. **Repository** (`~/familyBudget`) - Source code
2. **Deployment** (`/opt/budget`) - Docker working copy
3. **Docker volumes** - Persistent data

```bash
# ✅ CORRECT workflow
cd ~/familyBudget       # Repository
git pull origin main
./setup.sh              # Sync to /opt/budget
./deploy.sh --profile full

# ❌ WRONG - copies itself to itself
cd /opt/budget
./setup.sh
```

### Code Quality

```bash
# Linting + formatting + type checking
ruff check backend/
black backend/
mypy backend/

# Tests
pytest                              # All tests
pytest -m integration               # Integration only
npx playwright test                 # E2E tests
```

### Build Requirements

**CRITICAL RULE:** Minification is NOT required during development.

```bash
# ✅ Development workflow - Quick iteration
# 1. Edit code
vim frontend/web/static/js/app.js

# 2. Syntax check ONLY
node --check frontend/web/static/js/app.js

# 3. Test locally
uvicorn backend.app.main:app --reload

# 4. When ready to commit → THEN minify
npm run build
git add . && git commit -m "feat: new feature"
```

**When Minification IS Required:**
- Before committing to `main` or `test` branches
- Before deployment (automatically via `deploy.sh`)
- When testing Service Worker updates
- Before creating pull requests

**Why This Matters:**
- Minification adds 30-60s to each build cycle
- Development focuses on functionality first
- Final optimization happens in deployment pipeline
- Syntax errors caught by linters/type checkers

**Build Commands:**
```bash
npm run build           # Full build (CSS + JS + minify + precompress)
npm run watch:css       # Watch Tailwind CSS
npm run minify:js       # Minify JavaScript only
npm run minify:css      # Minify CSS only
npm run precompress     # Gzip pre-compression
```

**See:** `docs/architecture/build-system.md` → Development vs Production Build Requirements

### Installation Script

**Main:** `install.sh` - System dependencies + Docker + Node.js

**Resilience (v1.0.0+):**
- Timeout + retry with exponential backoff
- Network pre-flight checks
- GPG key validation (v1.1.0+)
- Repository detection (v1.1.0+)

**See:** `/docs/architecture/installation-resilience.md` for complete guide

### Deployment Flags

```bash
--sync-mode update      # Sync only changed files
--cleanup-mode smart    # Clean old images (safe)
--patch                 # Fast patch (2-5 min, no rebuild)
--build                 # Force rebuild (10-15 min)
--clean                 # DELETES ALL DATA!
```

**See:** `/docs/architecture/guides/deployment-troubleshooting.md`

## API Endpoints

### Authentication
- `POST /auth/telegram` - Telegram OAuth
- `POST /auth/login` - Email+Password
- `POST /auth/webauthn/authenticate/verify` - WebAuthn login
- `POST /auth/refresh` - Refresh JWT

### REST API v1
- `/api/v1/articles` - Categories CRUD
- `/api/v1/facts` - Transactions CRUD
- `/api/v1/transfers` - Transfer creation
- `/api/v1/recurring-plans` - Recurring payments
- `/api/v1/financial-centers` - Financial centers
- `/api/v1/users/me/notification-preferences` - User preferences

### WebSocket
- `ws://localhost:8000/ws/budget` - Real-time updates

**See:** `/docs/architecture/endpoints/` for complete API documentation

## Logging Conventions

**Prefix standards:**
- `[AUTH_EMAIL]` - Email authentication
- `[AUTH_WEBAUTHN]` - WebAuthn authentication
- `[RECURRING_PLAN]` - Recurring plans
- `[BULK_DELETE]` - Bulk operations
- `[WS_BULK]` - WebSocket bulk events
- `[DEDUP]` - Deduplication
- `[SW_UPDATE]` - Service Worker updates
- `[NAV]` - Navigation detection
- `[RTT_FILTER]` - RTT filtering

**Frontend:**
```javascript
logAPI.info('Request started');
logAPI.time('API call');
logAPI.timeEnd('API call');
```

**See:** `frontend/web/static/js/config/logging.js` for configuration

## Troubleshooting

### Common Issues

**1. Installation hangs:**
```bash
# Check network
source scripts/lib/network_health.sh
network_preflight_check "false"

# Increase timeout
TIMEOUT_NPM_INSTALL=1800 sudo -E ./install.sh
```

**2. Docker GPG key error:**
```bash
# Remove corrupted key
sudo rm -f /etc/apt/keyrings/docker.gpg
sudo ./install.sh
```

**3. Deployment fails:**
```bash
# Check logs
tail -f /var/log/familybudget_install.log
cat /opt/budget/logs/deploy.log

# Check disk space
df -h
docker system df
```

**4. WebSocket disconnects:**
```bash
# Check Redis
docker compose logs redis

# Check backend logs
docker compose logs backend | grep -E "WS|Redis"
```

**See:** `/docs/architecture/guides/` for comprehensive troubleshooting guides

## Documentation Index

### Architecture
- [README.md](docs/architecture/README.md) - Dependency graph + recent changes
- [authentication.md](docs/architecture/authentication.md) - JWT, OAuth, WebAuthn
- [pwa.md](docs/architecture/pwa.md) - PWA, offline, Service Worker
- [websocket.md](docs/architecture/websocket.md) - Real-time updates
- [web-workers.md](docs/architecture/web-workers.md) - Background processing
- [build-system.md](docs/architecture/build-system.md) - Build pipeline
- [recurring-plans.md](docs/architecture/recurring-plans.md) - Recurring payments
- [notifications.md](docs/architecture/notifications.md) - Push + Telegram
- [transfers-system.md](docs/architecture/transfers-system.md) - Transfer deduplication
- [bulk-delete-optimization.md](docs/architecture/bulk-delete-optimization.md) - Bulk operations
- [installation-resilience.md](docs/architecture/installation-resilience.md) - Installation framework
- [backup-system.md](docs/architecture/backup-system.md) - Backup + restore
- [caching-strategy.md](docs/architecture/caching-strategy.md) - HTTP caching

### Guides
- [deployment-troubleshooting.md](docs/architecture/guides/deployment-troubleshooting.md) - Deployment issues
- [disaster-recovery.md](docs/architecture/guides/disaster-recovery.md) - Disaster recovery
- [backup-operations.md](docs/architecture/guides/backup-operations.md) - Backup procedures

### Product
- [docs/prd/](docs/prd/) - Product requirements
- [docs/guides/](docs/guides/) - User guides
- [START.md](START.md) - Administrator installation guide

### API
- `/docs` (Swagger) - Interactive API documentation
- [docs/architecture/endpoints/](docs/architecture/endpoints/) - Endpoint documentation

## Emergency Contacts

**Repository Issues:** https://github.com/anthropics/familybudget/issues
**Production Monitoring:** Check `/opt/budget/logs/`
**Database Backup:** `/opt/budget/backups/` (7-day retention)
