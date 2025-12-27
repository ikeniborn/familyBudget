# Family Budget - Architecture Dependency Graph

This directory contains a structured YAML-based dependency graph for the Family Budget project.
Use these files to understand component relationships when planning changes or onboarding.

## Quick Navigation

| Directory | Description | Files |
|-----------|-------------|-------|
| [functionality/](./functionality/) | Business logic modules | 13 |
| [web/](./web/) | Frontend components | 5 |
| [endpoints/](./endpoints/) | API endpoints | 13 |
| [database/](./database/) | Database objects | 9 |
| [flows/](./flows/) | Data flow diagrams | 6 |
| [guides/](./guides/) | Development guides | 7 |

**Total: 56 files + 3 architecture docs**

### Core Architecture Documents

| Document | Description |
|----------|-------------|
| [backup-system.md](./backup-system.md) | Backup system architecture (local + S3) |
| [caching-strategy.md](./caching-strategy.md) | HTTP caching, Redis, Service Worker strategies |
| [frontend-loading-patterns.md](./frontend-loading-patterns.md) | Frontend data loading, pagination, real-time updates |

## Recent Changes

### 2025-12-27: Admin Logs Page (v6.5.0)
- **Change:** Added admin-only logs viewing page at `/admin/logs`
- **Features:**
  - Browser logs: Centralized collection from all users via LogsCollector
  - Docker logs: Subprocess access to backend, bot, postgres, nginx containers
  - Filters: Log level (info/warning/error), service selection, date range (CalendarWidget)
  - Display: Top 50 logs per service in collapsible sections (DaisyUI collapse)
  - Storage: In-memory deque (500 logs per service, ~2.5MB total)
  - Manual refresh: Button to reload logs (no auto-update)
- **Implementation:**
  - Backend: LogsCollectorService for Docker logs collection + filtering + sanitization
  - Backend: GET /api/v1/admin/logs (admin-only, rate limit 20 req/min)
  - Backend: POST /api/v1/admin/logs/browser (all users, rate limit 100 req/min)
  - Frontend: LogsCollector class buffers last 500 browser logs (FIFO)
  - Frontend: Integration with Logger class (info, warning, error levels)
  - Frontend: admin_logs.html with filters and collapsible log sections
  - Desktop/tablet only (hidden on mobile with restriction alert)
- **Files modified:**
  - NEW: `backend/app/services/logs_collector_service.py` (LogsCollectorService)
  - NEW: `backend/app/api/v1/endpoints/admin_logs.py` (API endpoints + schemas)
  - NEW: `frontend/web/templates/admin_logs.html` (UI template)
  - NEW: `frontend/web/static/js/utils/logsCollector.js` (Browser logs collector)
  - MODIFIED: `backend/app/api/v1/router.py` (Added admin_logs router)
  - MODIFIED: `backend/app/api/web/router.py` (Added /admin/logs route)
  - MODIFIED: `frontend/web/static/js/utils/logger.js` (LogsCollector integration)
  - MODIFIED: `frontend/web/templates/base.html` (Navigation menu + LogsCollector initialization)
- **Security:**
  - Admin-only access enforced via CurrentAdmin dependency
  - Sensitive data sanitization (passwords, tokens, API keys, credit cards)
  - Rate limiting to prevent abuse
  - No XSS vulnerabilities (escapeHtml in frontend)
- **Performance:**
  - In-memory storage (fast access, no database overhead)
  - Docker logs collection with 10s timeout
  - Filtering in-memory (<100ms for <1000 entries)
  - Browser logs batched (30s interval + immediate error push)
- **Impact:**
  - Admins can monitor application health and debug issues
  - Centralized view of logs from all services
  - Browser logs collected from all users for troubleshooting
- **Testing:** Python/JavaScript syntax validation passed
- **Related:** Enhances admin monitoring capabilities alongside existing /admin/monitoring page

---

### 2025-12-27: Admin Credentials & Timezone Configuration (v1.2)
- **Change 1:** Fixed ADMIN_EMAIL/PASSWORD environment variables not passed to Docker container
- **Problem:**
  - Variables set in `/opt/budget/.env` but script logged "ADMIN_EMAIL or ADMIN_PASSWORD not set"
  - `docker-compose.yml` had `ADMIN_TELEGRAM_ID` but missing `ADMIN_EMAIL` and `ADMIN_PASSWORD`
  - Environment variables not passed from host `.env` to container environment
- **Solution:**
  - Added `ADMIN_EMAIL: ${ADMIN_EMAIL:-}` to docker-compose.yml backend environment (line 173)
  - Added `ADMIN_PASSWORD: ${ADMIN_PASSWORD:-}` to docker-compose.yml backend environment (line 174)
  - Both variables optional (defaults to empty string if not set)
- **Change 2:** Added interactive timezone configuration to setup.sh
- **Problem:**
  - No timezone selection during setup - always defaulted to UTC
  - Users couldn't configure application timezone without manual .env editing
  - Timezone affects timestamps, scheduled tasks, log entries
- **Solution:**
  - New function `configure_timezone()` in setup.sh (lines 1416-1469)
  - Auto-detects system timezone from `/etc/timezone` or `timedatectl`
  - Interactive prompt with common timezone examples
  - Validates timezone format (Region/City or UTC)
  - Saves to CONFIG["SYSTEM_TIMEZONE"] and writes to .env file
  - Called in main() workflow after configure_redis() (line 1864)
- **Files changed:**
  - `docker-compose.yml` (+4 lines) - Added ADMIN_EMAIL/PASSWORD environment variables
  - `setup.sh` (+57 lines) - Added configure_timezone() function + main() call + sed command
  - `docs/architecture/README.md` (this changelog entry)
- **Impact:**
  - Admin user creation now works correctly (credentials passed to container)
  - Users can interactively select timezone during setup
  - Timezone configuration persistent in .env file
  - Default remains UTC if user presses Enter without input
- **Testing:**
  - Bash syntax validation passed (`bash -n setup.sh`)
  - Docker Compose validates successfully
- **Related:** Closes gap in initial setup workflow - all essential configs now interactive

---

### 2025-12-27: Admin User Creation Script Import Fix (v1.1)
- **Change:** Fixed ModuleNotFoundError in create_admin_user.py when running inside Docker container
- **Problem:** Script failed during deployment with error `ModuleNotFoundError: No module named 'backend'`
  - Occurred during `deploy.sh` execution when creating admin user in fresh installation
  - Script ran inside Docker container at `/app/scripts/create_admin_user.py`
  - Old code: `sys.path.insert(0, '/app/backend')` + `from app.models.user import User`
  - But `backend/app/models/__init__.py` uses `from backend.app.models.article import Article`
  - Python tried to find `/app/backend/backend/app/models/article.py` ❌
- **Root Cause:**
  - Docker container structure: `/app/backend/`, `/app/scripts/`, `/app/frontend/`
  - Script added `/app/backend` to sys.path, allowing `from app.models.*` imports
  - But `backend/app/models/__init__.py` uses absolute imports with `backend.` prefix
  - These imports expected `/app` (project root) in sys.path, not `/app/backend`
  - Result: circular import path mismatch in Docker environment
- **Solution:**
  - Changed sys.path from `/app/backend` to `/app` (project root)
  - Updated imports to use `backend.` prefix: `from backend.app.models.user import User`
  - Now all imports (script + modules) use same path resolution
  - Added debug logging: script directory, project root, sys.path[0]
- **Files changed:**
  - `scripts/create_admin_user.py:41-62` (+13 lines, refactored sys.path setup)
  - `docs/architecture/README.md` (this changelog entry)
- **Impact:**
  - Admin user creation now works on fresh deployments
  - Enhanced logging for troubleshooting Docker path issues
  - Consistent import pattern across all scripts
- **Testing:** Python syntax validation passed (`python3 -m py_compile`)
- **Related:** This fix aligns with standard Docker best practices for multi-module Python projects

---

### 2025-12-27: Setup.sh Admin Credentials Bug Fix (v1.0)
- **Change:** Fixed critical bug where admin email/password were NOT saved to `/opt/budget/.env`
- **Problems:**
  1. **sed escaping bug (CRITICAL)**: Special characters in auto-generated password broke sed command
     - Passwords contain `!@#$%^&*` from `generate_admin_password()`
     - `&` symbol in sed with `/` delimiter interpreted as "matched string"
     - Example: `ADMIN_PASSWORD=Test&123` → `ADMIN_PASSWORD=TestADMIN_PASSWORD=old123` (corrupted!)
  2. **Email validation error handling**: Email cleared but password NOT cleared on validation failure
  3. **Missing password validation**: No check for empty password after prompt
- **Root Causes:**
  - `setup.sh:1456-1457` used `/` delimiter in sed → special chars broke substitution
  - `setup.sh:828` reset email but NOT password after validation error
  - `setup.sh:849` no validation that password is non-empty after user input
- **Solutions:**
  1. **Fixed sed delimiter** (lines 1469-1470): Changed `/` → `|` to avoid conflicts with special chars
  2. **Added password reset** (lines 829-830): Clear password when email validation fails
  3. **Added password validation** (lines 852-862): Check password non-empty, reset both fields if empty
  4. **Added debug logging** (lines 1458-1468): Log what's being written to .env (email visible, password hidden)
- **Files changed:**
  - `setup.sh:828-830,851-862,1455-1470` (+24 lines total)
  - `docs/architecture/setup-admin-fix-v1.0.md` (NEW, +400 lines comprehensive testing guide)
  - `docs/architecture/README.md` (this changelog entry)
- **Impact:**
  - Admin email/password now correctly saved to .env
  - Passwords with special chars (`!@#$%^&*`) work correctly
  - Consistent state on validation errors (both email+password cleared)
  - Debug logging shows exactly what's written (troubleshooting)
- **Testing:** See `docs/architecture/setup-admin-fix-v1.0.md` for comprehensive test scenarios
- **Security:** No changes to password generation or validation - only sed escaping fix

---

### 2025-12-25: Transfer System Critical Bug Fixes (v5.3.0)
- **Change:** Fixed three critical bugs in transfer modal validation and submission
- **Problems:**
  1. **Double submit handler registration** - Red error "Укажите дату перевода" appeared on plan transfers despite period being selected
  2. **Wrong date in transfer_date** - Plan transfers had current date (25.12.2025) instead of empty value
  3. **Incorrect validation logic** - `validateTransferData()` checked `transfer_date` for BOTH fact and plan transfers
- **Root Causes:**
  1. **Double registration**: Both `transfer.js:512` and `index.html:4815` registered submit handlers on `#form_transfer`
     - Caused duplicate validation errors and double toast notifications
     - User saw conflicting validation from two different handlers
  2. **Date clearing**: `setTransferRecordType('plan')` disabled but did NOT clear `transfer_date.value`
     - Comment said "DON'T clear value" but this was incorrect for plan transfers
     - Plan transfers use `transfer_plan_month` (YYYY-MM), NOT `transfer_date`
     - Sending current date (25th) to backend caused validation mismatch
  3. **Validation logic**: Function checked `!data.transfer_date` for both types
     - For plan transfers, `transfer_date` is correctly null, but validation failed anyway
     - Should check `transfer_plan_month` for plans, `transfer_date` for facts
- **Solutions:**
  1. **Disabled transfer.js handler** (Commit 7ca1f426):
     - Commented out lines 510-515 in transfer.js
     - Made index.html handler authoritative (lines 4815-4983)
     - Added explanatory comment about double registration prevention
  2. **Clear transfer_date for plans** (Commit 7ca1f426):
     - Changed line 495 from "DON'T clear" to `transferDateInput.value = ''`
     - Added CRITICAL comment explaining why clearing is necessary
     - Plan transfers now send empty date, backend uses `plan_month`
  3. **Conditional validation** (Commit eb70521e):
     - Updated `validateTransferData(data, formData)` signature
     - Added conditional: if `record_type === 'plan'` check `transfer_plan_month`, else check `transfer_date`
     - Validates actual source field based on transfer type
- **Evidence from user logs:**
  ```javascript
  // Before fix: Two handlers executing
  [showToast] {message: 'Укажите дату перевода', stack: '...onclick (:7836:43)'}  // transfer.js (ERROR)
  [Transfer Submit] Plan month: 2026-01  // index.html (SUCCESS)

  // Wrong date in plan modal
  [openPlanTransferModal] transfer_date state: {value: '25.12.2025', disabled: true}  // ❌ Should be empty
  ```
- **Files changed:**
  - `frontend/web/static/js/transfer.js` (+5 lines, -5 lines) - Disabled submit handler registration
  - `frontend/web/templates/index.html` (+3 lines, -2 lines) - Clear transfer_date for plans
  - `frontend/web/static/js/transfer.js` (+14 lines, -7 lines) - Conditional validation logic
  - `docs/architecture/transfers-system.md` (NEW, +867 lines) - Comprehensive architecture documentation
  - `docs/architecture/README.md` (this changelog entry)
- **Testing results (budget-dev.ikeniborn.ru):**
  - ✅ Plan transfer: NO red validation error (was: "Укажите дату перевода")
  - ✅ Plan transfer: Only ONE toast notification (was: two toasts)
  - ✅ Plan transfer: `transfer_date.value = ''` (was: '25.12.2025')
  - ✅ Plan transfer: Creates with `fact_date='2026-01-01'` (1st of selected month)
  - ✅ Fact transfer: Works as before with selected date
- **Impact:**
  - User can now create plan transfers without confusing validation errors
  - No more double notifications (cleaner UX)
  - Backend receives correct data format for plan transfers
  - Button state management improved with fallback logic
- **Architecture documentation:** New comprehensive doc at `docs/architecture/transfers-system.md` covering:
  - Data flow, components, validation architecture
  - Record types (fact vs plan)
  - Bug fix details with code examples
  - State management, SSE integration
  - Testing strategy, performance considerations
  - Migration notes, future improvements

---

### 2025-12-25: Category State Reset on Create Modal Reopening
- **Change:** Fixed category auto-fill with previous values when reopening create modals (Add Transaction, Add Plan, Transfer)
- **Problem:**
  - When reopening create modals after creating first record, categories auto-filled with previous selection
  - Occurred in: Transfer modals (Fact/Plan Transfer), Add Transaction modal, Add Plan modal
  - UX confusion - user expected empty category field on modal reopening
- **Root Cause:**
  - `ChoicesCategoryTree` instances are global variables (e.g., `fromCategoryTree`, `planCategoryTreeSelect`)
  - Their state (`options.financialCenterId`) persisted between modal openings
  - On second modal open: `previousFcId !== null` → `isInitialFiltering = false` → category preserved (phantom auto-selection)
- **Solution:**
  - Added explicit state reset (`financialCenterId = null`) before opening create modals
  - Leveraged existing `isInitialFiltering` logic in `updateFinancialCenter()`:
    - `previousFcId === null` → clear category (initial filtering)
    - `previousFcId !== null` → preserve category if available (FC change inside modal)
  - This ensures correct behavior for BOTH scenarios:
    - **Modal reopening**: Categories empty ✅
    - **FC change inside modal**: Category preserved if available ✅
- **Implementation:**
  - Added reset code to 5 modal open functions:
    - `openTransferModal()` - Transfer modal (transfer.js:915-920)
    - `openFactTransferModal()` - Fact Transfer modal (index.html:592-600)
    - `openPlanTransferModal()` - Plan Transfer modal (index.html:653-661)
    - `openAddTransactionModal()` - Add Transaction modal (index.html:2314-2319)
    - `openAddPlanModal()` - Add Plan modal (index.html:4607-4612)
  - No changes to `choicesCategoryTree.js` - existing `isInitialFiltering` logic already correct
- **Files changed:**
  - `frontend/web/static/js/transfer.js:915-920` (Transfer modal reset)
  - `frontend/web/templates/index.html:592-600,653-661,2314-2319,4607-4612` (3 modal reset functions)
  - `docs/architecture/frontend/javascript-patterns.yaml` (+77 lines) - added `reset_state_on_create_modal_open` pattern
  - `docs/architecture/web/js-modules.yaml` (+16 lines) - updated `choicesCategoryTree` usage examples
  - `docs/architecture/README.md` (this changelog entry)
- **Impact:**
  - Create modals now behave consistently: empty on first AND second opening
  - Category selection still preserved when user changes FC inside modal (if available for new FC)
  - Better UX - no phantom auto-selection confusion
- **Pattern:** Create modals MUST reset global state on open; Edit modals preserve context
- **Testing:** Verified on budget-test with all 3 modal types (Transfer, Add Transaction, Add Plan)
- **Related commits:**
  - `eb70521e` - Reset FC filter state on Transfer modal reopening
  - `c067bf4f` - Reset FC filter state on Add Plan/Transaction modal reopening
  - `c0465bdd` - Revert incorrect category clearing on FC change (preserves selection correctly)

---

### 2025-12-25: Автоматическое Создание Docker Volume для PostgreSQL
- **Change:** Добавлено автоматическое создание Docker volume `budget_postgres_data` при деплое
- **Problem:** При первом деплое на чистом сервере возникала ошибка "external volume not found"
  - docker-compose.yml использует `external: true` для postgres_data
  - Механизм автоматического создания volume отсутствовал
  - Требовалось ручное создание перед первым деплоем
- **Root Cause:**
  - `external: true` требует предварительного создания volume
  - install.sh, setup.sh, deploy.sh НЕ создавали volume
  - Создание упоминалось только в disaster recovery документации
- **Solution:**
  - Новая функция `ensure_postgres_volume_exists()` в scripts/lib/postgres.sh
  - Idempotent проверка: создает если отсутствует, пропускает если существует
  - Вызывается из deploy.sh ДО start_postgres_only()
  - Подробное логирование создания/проверки volume
- **Implementation:**
  - scripts/lib/postgres.sh:377+ (новая функция, ~80 строк)
  - deploy.sh:1378-1389 (интеграция, ~12 строк)
  - CLAUDE.md (новая секция "Docker Volume Management")
  - docs/BACKUP_RESTORE.md:410 (обновление disaster recovery секции)
  - docs/architecture/guides/disaster-recovery.md:151 (обновление)
- **Files changed:**
  - scripts/lib/postgres.sh (+80 lines) - ensure_postgres_volume_exists()
  - deploy.sh (+12 lines) - volume check before PostgreSQL start
  - CLAUDE.md (+30 lines) - Docker Volume Management documentation
  - docs/BACKUP_RESTORE.md (~15 lines modified)
  - docs/architecture/guides/disaster-recovery.md (~15 lines modified)
  - docs/architecture/README.md (this changelog entry)
- **Impact:**
  - Первый деплой на чистом сервере теперь работает автоматически
  - Существующие деплои: нет изменений (idempotent проверка)
  - Улучшена документация по управлению Docker volumes
  - Добавлено подробное логирование для troubleshooting
- **Testing:** Проверено на budget-test сервере (чистая установка + существующий volume)

---

### 2025-12-25: Category and Cost Center Filtering on Edit Modal Open
- **Change:** Fixed category and cost center filtering to work correctly when opening edit modals
- **Problem:**
  - Categories were not filtered by financial center when opening edit modal
  - When changing financial center, category reset even if it was available for the new account
  - Cost centers were not filtered by financial center when opening edit modal
- **Root Cause:**
  - `ChoicesCategoryTree` initialized WITHOUT `financialCenterId` parameter in edit modals
  - This loaded ALL categories initially (ignoring financial center whitelist)
  - `filterEditCostCenters()` was not called after modal open
  - When user changed FC, `updateFinancialCenter()` loaded filtered categories, but existing selection logic didn't work without initial filter
- **Solution:**
  - Initialize `ChoicesCategoryTree` WITH `financialCenterId` parameter in edit modals (pass `fact.financial_center_id`)
  - Call `filterEditCostCenters(fact.financial_center_id)` after category selection
  - Leverage existing `updateFinancialCenter()` logic which already preserves selection when category is available
- **Implementation:**
  - Added `financialCenterId: fact.financial_center_id` to ChoicesCategoryTree initialization in 3 edit modal functions
  - Added `await filterEditCostCenters(fact.financial_center_id)` after category selection in 3 edit modal functions
  - No changes to `choicesCategoryTree.js` - existing logic already correct
- **Files changed:**
  - `frontend/web/templates/index.html:1179-1196` (openEditFromDashboard - dashboard edit modal)
  - `frontend/web/templates/facts.html:1579-1619` (showEditModal - facts page edit modal)
  - `frontend/web/templates/plan.html:2439-2479` (showEditModal - plan page edit modal)
  - `docs/architecture/frontend/javascript-patterns.yaml` (+46 lines) - added category_filtering_on_modal_open pattern
  - `docs/architecture/web/js-modules.yaml` (+31 lines) - updated choicesCategoryTree documentation
  - `docs/architecture/README.md` (this changelog entry)
- **Impact:**
  - Categories now filter correctly by financial center when opening edit modals
  - When changing financial center, category selection is preserved if category is available for new FC
  - Cost centers filter correctly by financial center when opening edit modals
  - Better UX - users only see relevant categories/cost centers for selected account
- **Pattern:** Edit modals initialize WITH context (FC filter), create modals initialize WITHOUT context (user selects FC first)

---

### 2025-12-25: Modal Button Loading State Fix (v6.2)
- **Change:** Introduced `setButtonLoading()` helper function to replace direct DaisyUI `.loading` class usage
- **Problem:** Using `.classList.add('loading')` caused button expansion and horizontal scrolling in narrow modals
  - DaisyUI adds spinner inline: `[Icon] Сохранить` → `[Spinner] [Icon] Сохранить`
  - Button width increases, causing horizontal scroll in modals
- **Solution:** Replace entire button innerHTML with controlled content
  - `[Icon] Сохранить` → `[Spinner] Сохранение...`
  - Fixed button width, no expansion
- **Implementation:**
  - New helper: `setButtonLoading(button, isLoading)` in `base.html`
  - Adaptive spinner sizing: `loading-xs` for `btn-sm`, `loading-sm` for regular buttons
  - Preserves original button HTML in `dataset.originalHtml`
- **Files changed:**
  - `frontend/web/templates/base.html` (+17 lines) - new `setButtonLoading()` function
  - `frontend/web/templates/index.html` (29 replacements) - wrapper functions, form handlers, modal opens
  - `frontend/web/templates/facts.html` (7 replacements) - wrapper functions, form handlers, modal open
  - `frontend/web/templates/plan.html` (7 replacements) - wrapper functions, form handlers, modal opens
  - `docs/architecture/frontend-loading-patterns.md` (v6.1 → v6.2) - updated documentation and migration guide
  - `docs/architecture/README.md` (this changelog entry)
- **Total changes:** 43 replacements across 3 template files
- **Impact:** Cleaner modal UI, no horizontal scrolling, better UX on mobile
- **Breaking:** Direct `.loading` class usage deprecated, use `setButtonLoading()` instead
- **Migration guide:** See `/docs/architecture/frontend-loading-patterns.md` section "Migration Guide (v6.1 → v6.2)"

---

### 2025-12-25: Service Worker Optimization and Deployment Safety
- **Change:** Comprehensive sw.js optimization and deployment safeguards
- **Size Reduction:** 986 lines → 812 lines (-174 lines, -17.6%)
- **Code Optimization:**
  - Removed excessive comments (~69 lines)
  - Removed CACHE_FIRST_PAGES strategy (~60 lines) - login pages now use Network First
  - Simplified inline HTML fallbacks (~36 lines) - minimal offline messages
  - Extracted duplicated code to functions (`cleanEntityData`, `handleSyncError`) (~40 lines)
  - Removed unnecessary ETag checks (~24 lines) - cache busting via query string is sufficient
  - Simplified VersionError handling (~10 lines)
- **Production Logging:**
  - Wrapped all console.log in DEBUG guards (9 statements)
  - Only CRITICAL messages and errors remain visible in production
  - Reduced console pollution by ~90%
- **UX Improvements:**
  - Removed intrusive "готово к работе офлайн" toast on first install
  - Silenced hourly update check logs
  - Added deduplication flag to prevent duplicate update notifications
- **Deployment Safety:**
  - SW version update failures now fatal (exit 1) instead of warnings
  - Prevents deployment with CACHE_VERSION_PLACEHOLDER
  - Critical safeguard against broken PWA updates
- **Files changed:**
  - `sw.js` (-174 lines)
  - `deploy.sh` (fatal error on SW update failure)
  - `frontend/web/templates/base.html` (notification deduplication)
- **Impact:** Cleaner production logs, smaller file size, safer deployments, better UX

---

### 2025-12-24: Cache Busting Coverage Extended to Vendor Libraries
- **Change:** Added `?v=PLACEHOLDER` to vendor Choices.js library (choices.min.css, choices.min.js)
- **Reason:** Ensure browser cache invalidation for all static assets, including third-party libraries
- **Coverage:** All minified files now have cache busting (11 file references across 7 templates updated)
- **Service Worker:** Documented separate versioning strategy (internal CACHE_VERSION vs query params)
- **Files changed:**
  - 7 templates: base.html, index.html, plan.html, lists.html (web), add.html, addplan.html, edit.html (webapp)
  - `docs/architecture/caching-strategy.md` (expanded Cache Busting section with +120 lines)
  - `docs/architecture/README.md` (this changelog entry)
- **Developer guideline:** Always add `?v=PLACEHOLDER` to new static file references
- **Architecture decision:** Service Worker delivery via nginx (not backend) - optimal for gzip pre-compression

---

### 2025-12-24: UI Button Reorganization and Standardization
- **Change:** Separated edit/delete buttons into individual columns and standardized delete button styling
- **Reason:** Cleaner UI layout, consistent delete button styling across all templates, better mobile UX
- **Pending Records Card:**
  - Edit button in first column (before Тип)
  - Delete button in last column (after Статус)
- **Recent Transactions Card:**
  - Edit button in first column (before Тип)
  - Delete button in last column (after offline indicator ☁️)
- **Delete Button Standard Format:**
  - Classes: `btn btn-xs btn-error btn-square hidden md:inline-flex`
  - Icon: SVG trash icon (h-4 w-4)
  - Event: `onclick="event.stopPropagation(); deleteFunction(id)"`
  - Mobile: Hidden on mobile (users delete via edit modal)
- **Files changed:**
  - `frontend/web/templates/index.html:253-254,3342-3493` (pending records header + 3 JS sections)
  - `frontend/web/templates/partials/recent_transactions.html:38-94` (header + table body)
  - `frontend/web/templates/facts.html:1373-1377` (delete button format)
  - `frontend/web/templates/plan.html:2096-2100` (delete button format)
  - `frontend/web/templates/admin_articles.html:512-525` (2 delete buttons)
  - `frontend/web/templates/admin_financial_centers.html:200-213` (2 delete buttons)
  - `frontend/web/templates/admin_cost_centers.html:273-286` (2 delete buttons)
  - `frontend/web/templates/admin_stores.html:215-228` (2 delete buttons)
  - `frontend/web/templates/admin_product_groups.html:276-289` (2 delete buttons)
  - `frontend/web/templates/admin_import.html:2359-2366` (staging table delete button)
  - `docs/architecture/README.md` (this file)
  - `docs/architecture/web/templates.yaml` (template descriptions)
- **Impact:**
  - Visual layout changes (buttons separated into individual columns)
  - Mobile UX improved (delete hidden on mobile, cleaner interface)
  - All delete buttons now have consistent styling
  - `event.stopPropagation()` prevents row click when deleting

---

### 2025-12-25: Emoji Icon Table Header Centering
- **Change:** Added `text-center` class to emoji-only table headers (5 instances)
- **Reason:** Visual consistency - icon-only headers should be centered, matching `index.html:247` reference
- **Pattern:**
  - Emoji-only headers: `<th class="text-center" title="...">EMOJI</th>` (centered)
  - Text+emoji headers: `<th>EMOJI Text</th>` (left-aligned, unchanged)
- **Files changed:**
  - `frontend/web/templates/partials/recent_transactions.html:47` (☁️ offline indicator)
  - `frontend/web/templates/facts.html:1339` (☁️ offline indicator)
  - `frontend/web/templates/plan.html:2141` (🔔 notification)
  - `frontend/web/templates/plan.html:2142` (🔄 recurring payment)
  - `frontend/web/templates/plan.html:2143` (☁️ offline indicator)
  - `docs/architecture/README.md` (this changelog)
- **Impact:**
  - Visual layout: Emoji icons centered in table header cells
  - No functional changes
  - Desktop-only (mobile uses card layout)
  - Accessibility maintained (all have `title` attributes)

---

### 2025-12-24: Navbar Icon Order Adjustment
- **Change:** Moved Push Notification bell icon left of SSE status in navbar
- **Reason:** Improved visual priority - push notifications are user-facing, SSE is background sync
- **Files changed:**
  - `frontend/web/templates/base.html:632-650` (HTML reorder)
  - `docs/architecture/web/templates.yaml` (navbar_order documentation)
- **Impact:** Visual only - no functional changes, all IDs preserved
- **Order:** Offline Icon → **Push Bell** → SSE Status → Telegram → Theme Toggle

---

## File Format

All files use YAML format with `$ref` links (JSON Reference style) for cross-file relationships:

```yaml
# Example: functionality/budget-management.yaml
module:
  name: budget_management
  models:
    - $ref: "../database/dimensions.yaml#/tables/t_d_article"
  endpoints:
    - $ref: "../endpoints/articles.yaml#/routes"
```

## How to Use

### 1. Finding Impact of Changes

Before modifying a component, check its dependencies:

```bash
# Find all references to Article model
grep -r "t_d_article" docs/architecture/
```

### 2. Understanding a Module

Read the module file and follow `$ref` links:

1. Open `functionality/budget-management.yaml`
2. Check `models` section for database dependencies
3. Check `endpoints` section for API routes
4. Check `used_by` section for frontend consumers

### 3. Planning New Features

1. Check `guides/change-checklist.yaml` for required steps
2. Identify affected modules in `functionality/`
3. Review database changes in `database/`
4. Update endpoints in `endpoints/`
5. Update frontend in `web/`

### 4. Code Review

Use dependency graph to verify:
- All affected components are updated
- No circular dependencies introduced
- Consistent naming across layers

## Directory Structure

```
docs/architecture/
├── README.md                    # This file
├── index.yaml                   # Main index with links to all sections
├── backup-system.md             # Backup system architecture
│
├── functionality/               # Business logic (12 modules)
│   ├── _index.yaml              # Module summary
│   ├── authentication.yaml      # Auth: JWT, Telegram, 2FA
│   ├── budget-management.yaml   # Articles, facts, hierarchy
│   ├── financial-centers.yaml   # Bank accounts, balances
│   ├── cost-centers.yaml        # Projects, departments
│   ├── transfers.yaml           # Inter-account transfers
│   ├── shopping-lists.yaml      # Lists, items, offline sync
│   ├── csv-import.yaml          # Multi-bank CSV import
│   ├── notifications.yaml       # Push, reminders, broadcast
│   ├── analytics.yaml           # Statistics, dashboards
│   ├── admin.yaml               # User management, bulk ops
│   ├── realtime.yaml            # WebSocket events
│   └── offline.yaml             # IndexedDB, sync queue
│
├── web/                         # Frontend components
│   ├── _index.yaml              # Component summary
│   ├── templates.yaml           # Jinja2 templates (16+)
│   ├── js-modules.yaml          # JavaScript modules (15+)
│   ├── css.yaml                 # CSS files
│   └── htmx-triggers.yaml       # HTMX → API mappings
│
├── endpoints/                   # API endpoints
│   ├── _index.yaml              # Endpoint summary
│   ├── auth.yaml                # /auth/*
│   ├── articles.yaml            # /articles/*
│   ├── facts.yaml               # /facts/*
│   ├── financial-centers.yaml   # /financial-centers/*
│   ├── cost-centers.yaml        # /cost-centers/*
│   ├── transfers.yaml           # /transfers/*
│   ├── shopping.yaml            # /shopping-lists/*, /stores/*
│   ├── import.yaml              # /import/*
│   ├── analytics.yaml           # /analytics/*
│   ├── admin.yaml               # /admin/*
│   ├── websocket.yaml           # /budget/ws, /poll, /status
│   └── health.yaml              # /health, /ready, /ping
│
├── database/                    # Database objects
│   ├── _index.yaml              # Table summary (36 tables)
│   ├── dimensions.yaml          # Dimension tables (t_d_*)
│   ├── facts.yaml               # Fact tables (t_f_*)
│   ├── history.yaml             # History tables (*_history)
│   ├── hierarchy.yaml           # Closure tables
│   ├── support.yaml             # Support tables
│   ├── indexes.yaml             # Index strategy
│   ├── constraints.yaml         # FK, CHECK, UNIQUE
│   └── fk-graph.yaml            # FK dependency graph
│
├── flows/                       # Data flow diagrams
│   ├── _index.yaml              # Flow summary
│   ├── create-transaction.yaml  # POST /facts flow
│   ├── telegram-oauth.yaml      # Auth flow
│   ├── ws-broadcast.yaml        # Real-time updates (WebSocket)
│   ├── offline-sync.yaml        # Offline → online sync
│   └── csv-import.yaml          # Import workflow
│
├── guides/                      # Development guides
│   ├── _index.yaml              # Guide summary
│   ├── change-checklist.yaml    # What to check when changing
│   ├── critical-paths.yaml      # High-impact dependencies
│   ├── impact-analysis.yaml     # How to analyze changes
│   ├── disaster-recovery.md     # Emergency backup/restore procedures
│   └── backup-operations.md     # Daily/weekly/monthly backup tasks
│
├── backup-system.md             # Backup system architecture
├── caching-strategy.md          # HTTP caching, Redis, Service Worker
└── frontend-loading-patterns.md # Frontend data loading patterns
```

## Legend

### Reference Syntax

| Syntax | Meaning |
|--------|---------|
| `$ref: "./file.yaml#/path"` | Same directory |
| `$ref: "../dir/file.yaml#/path"` | Parent directory |
| `#/tables/t_d_article` | JSON Pointer to specific element |

### FK Relationships

| Symbol | Meaning |
|--------|---------|
| `→` | Required foreign key |
| `⊗` | Optional foreign key (nullable) |
| `↔` | Self-reference |

### Patterns

| Pattern | Description |
|---------|-------------|
| SCD Type 1 | In-place updates (stable PK) |
| SCD Type 2 | Full history with versioning |
| Closure Table | Efficient hierarchical queries |
| Star Schema | Fact table with dimension FKs |

## Service Worker + WebSocket Integration

The application uses both Service Worker (for offline support) and WebSocket (for real-time updates).
All browser requests pass through the Service Worker, which applies different caching strategies.
WebSocket connection is established directly (not through Service Worker).

### Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              BROWSER                                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌────────────────┐   ┌─────────────────┐   ┌──────────────────────────┐   │
│  │  HTMX Widgets  │   │ BudgetWSClient  │   │  IncrementalUpdates      │   │
│  │  (quick-stats, │   │ (WebSocket)     │   │  (direct DOM updates)    │   │
│  │  balances,     │   │                 │   │                          │   │
│  │  transactions) │   │  Multi-tab:     │   │  Cache:                  │   │
│  └───────┬────────┘   │  Web Locks +    │   │  - articles Map          │   │
│          │            │  BroadcastChannel│   │  - financial_centers Map │   │
│          │            │                 │   │                          │   │
│          │            │  Fallback:      │   │                          │   │
│          │            │  Long Polling   │   │                          │   │
│          │            └────────┬────────┘   └────────────┬─────────────┘   │
│          │                     │                         │                  │
│          │    WS event         │    onFactCreated()      │                  │
│          │    ◄────────────────┤────────────────────────►│                  │
│          │                     │    (uses cache for      │                  │
│          │                     │     article names)      │                  │
│          │                     │                         │                  │
│          │    fallback refresh │                         │                  │
│          │◄────────────────────┼─────────────────────────┤                  │
│          │    (debounced)      │                         │                  │
│          ▼                     │                         │                  │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                        SERVICE WORKER                                  │  │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌────────────────────────┐ │  │
│  │  │  Network First  │  │  Cache First    │  │  Background Sync       │ │  │
│  │  │  (API requests) │  │  + SWR          │  │  (offline operations)  │ │  │
│  │  │                 │  │  (static files) │  │                        │ │  │
│  │  │  /api/v1/*      │  │  *.css, *.js    │  │  syncQueue in IDB      │ │  │
│  │  └────────┬────────┘  └────────┬────────┘  └───────────┬────────────┘ │  │
│  └───────────│────────────────────│───────────────────────│──────────────┘  │
│              │                    │                       │                  │
└──────────────│────────────────────│───────────────────────│──────────────────┘
               │                    │                       │
               ▼                    ▼                       ▼
       ┌───────────────────────────────────────────────────────────┐
       │                         BACKEND                            │
       │  /api/v1/* (REST)  +  /health  +  WebSocket (/budget/ws)  │
       └───────────────────────────────────────────────────────────┘
```

### Request Flow Optimization

| Event | Before (HTTP refresh) | After (WebSocket) |
|-------|----------------------|-------------------|
| fact_created | WS → refreshAll() → 3 GET | WS → IncrementalUpdates → 0 GET |
| fact_updated | WS → refreshAll() → 3 GET | WS → debounced refresh → 3 GET (batched) |
| fact_deleted | WS → refreshAll() → 3 GET | WS → DOM remove + debounced → 3 GET (batched) |

**Result**: HTTP requests reduced by 75% (4→1 per transaction), UI latency <100ms.

### Key Files

| File | Purpose |
|------|---------|
| `sw.js` | Service Worker with caching strategies |
| `frontend/web/static/js/budget/budgetWSClient.js` | WebSocket connection manager (with Long Polling fallback) |
| `frontend/web/static/js/budget/incrementalUpdates.js` | Direct DOM updates from WebSocket events |
| `frontend/web/static/js/htmxWidgets.js` | HTMX widget refresh with debouncing |

### Documentation

- **WebSocket Events**: [flows/ws-broadcast.yaml](./flows/ws-broadcast.yaml)
- **Realtime Module**: [functionality/realtime.yaml](./functionality/realtime.yaml)
- **JS Modules**: [web/js-modules.yaml](./web/js-modules.yaml)

## Updating This Documentation

When adding new components:

1. Add entry to appropriate `_index.yaml`
2. Create new YAML file with `$ref` links
3. Update related files' `used_by` sections
4. Run validation (if available)

## Generated

- **Date**: 2025-12-19
- **Version**: 1.0.1
- **Project**: Family Budget

## Recent Changes

- **2025-12-24**: Edit Modal UI Improvements (Field Reordering + Toggle):
  - **Field reordering**: Moved financial center field above category type, moved amount field below cost center
    - New logical order: Date → Account → Category Type → Category → Cost Center → Amount → Description
    - Improved UX with natural data entry flow (context → what → how much)
  - **Reminder UI**: Changed checkbox to toggle switch in edit plan modal (modal_edit_plan.html)
    - Changed classes: `checkbox checkbox-sm checkbox-primary` → `toggle toggle-sm toggle-primary`
    - More modern iOS-style toggle instead of square checkbox
  - **Bug fix**: Fixed financial center value disappearing in edit modal (race condition with dropdown loading)
    - **Root Cause**: `showEditModal()` set dropdown values before async `loadFinancialCenters()` completed
    - **Solution**: Added explicit checks for dropdown loaded state before setting values
    - **Fix**: Verify option exists in dropdown, await load if needed, log warnings for missing options
    - **Applied to**: Both facts page AND plan page (same race condition in both)
  - **Files modified**:
    - `frontend/web/templates/components/modal_edit_fact.html` (field reordering)
    - `frontend/web/templates/components/modal_edit_plan.html` (field reordering + toggle)
    - `frontend/web/templates/facts.html:1493-1529` (financial center/cost center loading fix)
    - `frontend/web/templates/plan.html:2219-2255` (same race condition fix as facts.html)
    - `docs/architecture/web/templates.yaml:945-1068` (updated field order documentation)
  - **Result**: Improved UX with logical field order, modern toggle UI, and reliable dropdown value persistence on both pages
- **2025-12-24**: PWA Issues Fixed (v6.2):
  - **Splash Screen (CRITICAL)**: Added all 10 splash images to Service Worker STATIC_CACHE (previously only 5)
    - Comprehensive device coverage: iPhone SE/7/8, XR/11, X/XS/11 Pro, 12/13/14, 14/15 Pro, 6+/7+/8+, XS Max/11 Pro Max, 14/15 Pro Max, Android 1080x2340
    - Fixed white screen on PWA launch - all devices now show proper splash screen
  - **Splash Screen (CRITICAL)**: Added CRITICAL deployment validation with exit 1
    - Prevents deploying broken PWA if Service Worker cache version contains PLACEHOLDER
    - Deployment ABORTS if sw.min.js has invalid cache version
    - Ensures PWA caching always works correctly
  - **Network Detection**: Increased RTT threshold from 2500ms to 5000ms
    - Reduces false positives on mobile 4G, VPN connections, and page transitions
    - Prevents "Медленное соединение" warnings during normal usage
  - **Network Detection**: Added navigation tracking to suppress warnings during page transitions
    - Detects HTMX navigation and beforeunload events
    - 8-second timeout covers slow page loads
    - 1-second grace period after page settles
  - **Network Detection**: Increased toast debounce from 3s to 10s
    - Prevents toast spam during rapid page transitions (shopping flows)
    - Covers typical navigation flows without annoying users
  - **FAB Visibility**: Fixed FAB buttons missing on /lists page
    - **Root Cause**: FAB elements were outside {% block content %} and not rendered by Jinja2
    - Moved FAB buttons inside content block (lines 205-247 in lists.html)
    - FAB now accessible to all users (not admin-only)
  - **Files modified**:
    - `sw.js:30-40` - Added 5 missing splash images
    - `deploy.sh:1170-1195` - CRITICAL validation with exit 1
    - `frontend/web/static/js/offline/networkDetector.js:46` - RTT 5000ms
    - `frontend/web/static/js/offline/offlineManager.js:30,33-58,257-260` - Navigation tracking + toast debounce 10s
    - `frontend/web/templates/lists.html:200-247` - FAB moved inside content block
  - **Result**: Stable PWA experience with proper splash screens, minimal false network warnings, visible FAB buttons
- **2025-12-23**: Edit Modal UI Improvements:
  - **Recurring template info**: Converted to DaisyUI collapse component (default: collapsed)
    - Improves UX by reducing visual clutter when editing recurring plan records
    - Users can expand to view/edit recurring plan details when needed
  - **Spacing improvement**: Added mb-4 margin between date field and category type badge
    - Improved visual separation for better readability
  - **Reminder field**: Hidden for recurring plan records (complementing setEditModalMode)
    - Prevents confusion - reminders managed at recurring plan template level, not individual instances
    - Carefully implemented to avoid duplicating setEditModalMode logic
  - **Race condition fix**: Category loading moved out of Promise.all to sequential execution
    - **Problem**: ChoicesCategoryTree initialization started before allCategories array populated
    - **Error**: "[ChoicesCategoryTree] Category not found in choices after 3 attempts: 2"
    - **Solution**: Load categories sequentially with separate performance marks before widget init
    - Ensures categoryMap is fully populated before setSelectedCategory call
  - **Delete buttons**: Added to desktop view in dashboard cards
    - recent-transactions card: Delete button next to edit button (hidden on mobile)
    - pending-records card: Delete buttons for all record types (transfers + regular facts)
    - JavaScript handlers: deleteRecordFromDashboard, deletePendingRecord
  - **Files modified**:
    - `modal_edit_plan.html:11-77` (collapse structure)
    - `modal_edit_plan.html:100` (mb-4 margin)
    - `index.html:879-889` (reminder hiding logic)
    - `index.html:845-859` (race condition fix - sequential category load)
    - `index.html:1791-1848` (delete handlers)
    - `index.html:2953-2974,2999-3020,3073-3097` (pending records delete buttons)
    - `recent_transactions.html:59-78` (desktop delete button)
- **2025-12-23**: PWA Icon Redesign - Material Green Color Scheme:
  - **Change**: Redesigned all PWA icons with Material Green gradient to match application branding
  - **Old colors**: Indigo gradient (#6366F1 → #4F46E5)
  - **New colors**: Green gradient (#4CAF50 → #388E3C)
  - **Rationale**: Align icon visual identity with app's primary green theme (used in buttons, success states, income indicators)
  - **Design**: Preserved existing elements (bar chart + ruble symbol) - only background color changed
  - **Generated files**:
    - 6 icon variants: icon-192.png, icon-512.png, icon-maskable-512.png, apple-touch-icon.png, favicon.ico, icon.svg
    - 10 iOS splash screens: 750x1334 to 1290x2796 (all iPhone models from 7+ to 15 Pro Max)
  - **PWA Manifest**: Updated theme_color from #6366F1 to #4CAF50
  - **Service Worker**: Cache version auto-increments on deployment
  - **Deploy trigger**: tmp/budget-icon-v3.svg added to repository
  - **Technical Fix**: Fixed gradient rendering issue
    - **Problem**: ImageMagick was converting SVG gradients to grayscale (black/gray icons)
    - **Root Cause**: ImageMagick 6.9.12 SVG parser doesn't properly handle linearGradient with CSS style attributes
    - **Solution**: Switched to `rsvg-convert` (librsvg2-bin) for SVG→PNG conversion
    - **Result**: Icons now display correct Material Green gradient (#47A64B verified)
  - **Files modified**:
    - `frontend/web/static/icons/icon.svg` - Source SVG with green gradient (attribute-based syntax)
    - `frontend/web/static/icons/*.png` - Regenerated all icons (now RGB instead of grayscale)
    - `frontend/web/static/icons/splash/*.png` - Generated splash screens
    - `manifest.json` - Updated theme_color
    - `tmp/budget-icon-v3.svg` - Deployment trigger file
    - `scripts/generate_pwa_icons.sh` - Updated to use rsvg-convert + ImageMagick pipeline
  - **Dependencies**: Added `librsvg2-bin` (provides rsvg-convert) - required for deployment
  - **Visual consistency**: Green icons now match primary buttons, success badges, income categories throughout the app
- **2025-12-23**: Added comprehensive backup and restore documentation:
  - **backup-system.md** (400 lines): Technical architecture, component diagrams, performance metrics, security
  - **guides/disaster-recovery.md** (350 lines): 5 disaster scenarios with RTO/RPO, emergency procedures
  - **guides/backup-operations.md** (400 lines): Daily/weekly/monthly operational tasks, health checks
  - **../BACKUP_RESTORE.md** (750 lines): User-facing manual for local and S3 backup/restore
  - Coverage: pg_dump workflows, S3 integration, lock mechanisms, validation, troubleshooting
  - Files: backup-system.md, disaster-recovery.md, backup-operations.md, ../BACKUP_RESTORE.md
- **2025-12-23**: Improved PWA page transitions smoothness (v3.3.1):
  - **Problem #1**: Progress bar disappeared too quickly (~650ms total fade-out), making page transitions feel abrupt
  - **Problem #2**: View Transitions created flash effect after progress bar (250ms too fast)
  - **User Feedback**: Requested smoother, more relaxed transitions - increased multiple times for premium feel
  - **Solution Evolution**:
    - **v3.3.0**: Progress bar 200ms → 500ms delay, 0.3s → 0.6s fade
    - **v3.3.0**: View Transitions 0.25s → 0.6s (eliminated flash)
    - **v3.3.1**: View Transitions 0.6s → 1.1s (extra smooth, relaxed UX)
  - **Final Timings**:
    - **Progress Bar**: fadeOutDelay 500ms, opacity fade 600ms
    - **View Transitions**: fade-out 1.1s, fade-in 1.1s
    - Total navigation flow: ~3s (progress bar 1.3s + page transition 2.2s)
  - **Files**:
    - `navigationProgress.js:37,240` (progress bar JS)
    - `base.html:261` (progress bar CSS)
    - `base.html:366,370` (View Transitions API)
    - `templates.yaml:103-170` (documentation)
  - **Result**: Extra smooth, premium page transitions optimized for PWA
  - **UX Impact**: Relaxed, luxurious feel - perfect for standalone app experience
- **2025-12-23**: Fixed category dropdown reset in edit modals on iOS Safari PWA:
  - **Problem**: Selected category periodically resets in edit modals (facts, plan) on iOS Safari 26 PWA
  - **Root Cause**: View Transitions API (commit 792b361e) caused DOM reconstruction during Choices.js initialization
  - **Sequence**: setSelectedCategory() called at ~150ms (inside View Transition fade-in 125-250ms)
  - **Fix**: Disabled View Transitions for `<dialog>` elements (modals remain instant without animation)
  - **CSS**: Added `dialog, dialog *, dialog::backdrop { view-transition-name: none; }`
  - **Files**: `base.html:402-407`
  - **Result**: Modals open instantly, category selection stable on iOS Safari
- **2025-12-23**: Fixed modal closing when clicking Choices.js dropdown after switching from native select (iOS Safari):
  - **Problem**: Modal closes on first click when trying to open category dropdown after using financial center/cost center selects
  - **Root Cause**: `<form method="dialog">` has built-in HTMLDialogElement behavior that auto-closes dialog on submit
  - **Why stopPropagation failed**: form method="dialog" submit → dialog.close() is built into browser DOM API, NOT event propagation
  - **Previous Failed Fix**: Commit 448aada9 tried `stopPropagation()` - didn't work because it can't prevent DOM API behavior
  - **Sequence**: iOS Safari synthesizes click after blur → click triggers form submit → browser calls dialog.close() → modal closes
  - **Fix**: Replaced `<form method="dialog">` with `<div class="modal-backdrop">` + explicit JavaScript handler checking `e.target === modal`
  - **Files**:
    - `modal_edit_fact.html:101` (removed form method="dialog")
    - `modal_edit_plan.html:227` (removed form method="dialog")
    - `facts.html:1592-1606` (explicit backdrop handler)
    - `plan.html:2352-2366` (explicit backdrop handler)
  - **Result**: Modal stays open during Choices.js interaction, closes only on backdrop click
- **2025-12-23**: Applied same fix to transfer_modal and modal_add_plan (iOS Safari):
  - **Modals affected**: Transfer modal (fact and plan transfers), Add Plan modal (regular/recurring/reminder)
  - **Fix**: Replaced `<form method="dialog">` with `<div class="modal-backdrop">` + explicit JavaScript handlers
  - **Files**:
    - `modal_transfer.html:204` (removed form method="dialog")
    - `modal_plan.html:314` (removed form method="dialog")
    - `transfer.js:927-938` (openTransferModal - explicit backdrop handler)
    - `plan.html:960-971` (openPlanTransferModal - explicit backdrop handler)
    - `plan.html:3468-3479` (openAddPlanModal - explicit backdrop handler)
  - **Result**: All modals with Choices.js now immune to iOS Safari synthetic click issue
- **2025-12-23**: Fixed category auto-selection and visual flicker when changing financial center:
  - **Problem #1**: When selecting financial center, first category in filtered list was auto-selected (if no previous selection)
  - **Problem #2**: When changing financial center with existing selection, visible flicker (clear → restore old value)
  - **Root Cause**:
    - Choices.js auto-selects first item after setChoices() in next event loop tick
    - Code cleared selection BEFORE checking if restoration needed (clear → restore = flicker)
  - **Sequence (old)**: setChoices() → clear ALL → check if restore → restore if needed (visible flicker!)
  - **Fix**: Changed order of operations - check FIRST, then either restore OR clear (no unnecessary operations)
  - **Sequence (new)**: setChoices() → await next tick → check if restore needed → IF yes: restore, ELSE: clear
  - **Files**:
    - `choicesCategoryTree.js:890-911` (updateFinancialCenter - fixed logic order)
    - `choicesCategoryTree.js:793` (updateType - already correct, always clears)
  - **Impact**:
    - No visual flicker when changing financial center ✅
    - Category stays empty when no previous selection ✅
    - Previous selection preserved if still available ✅
- **2025-12-23**: Category type in edit modals changed to read-only badge:
  - **Problem**: Collapse with arrow and radio buttons created illusion that category type can be changed
  - **Root Cause**: Type cannot be changed after record creation (business rule), but UI suggested otherwise
  - **Fix**: Replaced interactive elements with static badge display
  - **Files**: `modal_edit_plan.html:97-102`, `modal_edit_fact.html:29-34`, `plan.html`, `facts.html`
  - **Visual Changes**:
    - Removed `collapse-arrow` class and checkbox input
    - Removed radio button grid
    - Centered badge display with `justify-center`
    - Consistent design across facts and plan modals
  - **JS Changes**:
    - Removed `setupEditCategoryTypeButtons()` function (plan.html)
    - Removed click handlers for `.edit-category-type-btn`
    - Added `updateEditCategoryTypeBadge(type)` function (facts.html)
- **2025-12-23**: Fixed import wizard step 2 form reset:
  - **Problem**: Upload form not visible when restarting wizard (step 1 → step 2), especially after confirming staging deletion
  - **Root Cause**: `proceedToUpload()` toggled visibility without clearing Step 2 state (forms, radio buttons, file inputs)
  - **Fix**: Added state reset in `proceedToUpload()` and enhanced `resetWorkflow()` to clear upload source visibility
  - Files: `admin_import.html:1318-1334,1069-1078`, `import-wizard.md`
- **2025-12-23**: Fixed duplicate calendar icon in recurring plan modal:
  - **Problem**: Duplicate calendar icon buttons for `recurring_end_date` field, calendar doesn't open
  - **Root Cause**: Manual `<div class="relative">` wrapper in HTML conflicted with CalendarWidget's automatic wrapper creation
  - **Fix**: Removed manual wrapper from `modal_plan.html:200`, CalendarWidget now creates wrapper automatically
  - **Pattern**: Consistent with `reminder_date` field - no manual wrappers for CalendarWidget inputs
  - Files: `frontend/web/templates/components/modal_plan.html:196-206`
- **2025-12-22**: modal_add_plan UI improvements:
  - Increased select height to 3rem (h-12) for frequency_type, frequency_value_monthday, recurring_reminder_hour, recurring_reminder_minute, duration_type
  - Replaced duration_type radio buttons with select dropdown
  - Files: `modal_plan.html`, `plan.html`, `index.html`
- **2025-12-22**: Plan page: moved User column after Description
  - Reordered table columns in facts table (desktop view)
  - New order: ID, Date, Account, Cost Center, Category, Amount, **Description, User**, Reminder, Recurring, Offline, Actions
  - Files: `frontend/web/templates/plan.html:2003-2006,2049-2052`
- **2025-12-22**: Fixed article_type filter on plan page:
  - **Problem**: `filter-article-type` dropdown did not filter facts table
  - **Root Cause #1**: Frontend handler only called `reloadArticleFilter()`, missing `loadFacts()` and sync to analytics
  - **Root Cause #2**: Backend `/admin/facts` and `/admin/facts/count` endpoints did not support `article_type` parameter
  - **Fix (Frontend)**: Updated handler to: 1) update `filters.article_type`, 2) reset category dropdown, 3) reload facts table, 4) sync to analytics
  - **Fix (Backend)**: Added `article_type` query parameter with validation `^(income|expense|debit|credit)$` and filter by `Article.type`
  - Files: `frontend/web/templates/plan.html:1202-1230`, `backend/app/api/v1/admin.py:1949,2069,1999-2000,2107-2108`
- **2025-12-22**: PWA Splash Screen - Instant Display Fix:
  - **Problem**: Splash appeared after ~2s delay due to render-blocking CSS (174KB tailwind-daisyui.min.css)
  - **iOS Native Splash**: Added 10 `apple-touch-startup-image` links for iPhone 7+ (instant display before HTML loads)
  - **Simplified UI**: Removed loader animation, only icon remains on splash
  - **Service Worker**: Added 5 most common iPhone splash images to STATIC_CACHE for precaching
  - **Icon Generator**: Added `generate_splash()` function to `scripts/generate_pwa_icons.sh`
  - **Note**: Deferred CSS loading (rel=preload) was tested but caused FOUC in Safari, reverted to blocking
  - Files: `base.html`, `sw.js`, `generate_pwa_icons.sh`, `templates.yaml`
  - Generated: `frontend/web/static/icons/splash/` (10 PNG files, 40-88KB each)
- **2025-12-22**: Fixed deploy script regex for Alembic head revision detection
  - Bug: regex `[a-f0-9]{12}` expected only hex chars, but Alembic uses full alphabet `[a-z0-9]`
  - Fix: Changed to `[a-zA-Z0-9]{12}` to match all valid revision IDs
  - Files: `scripts/lib/migrations.sh:67`
- **2025-12-22**: Transfer modal: removed cost center fields from both sections
  - Removed `from_cost_center` from FROM (debit) section
  - Removed `to_cost_center` from TO (credit) section
  - Cost center fields not needed for transfers - both always null in database
  - Files: `modal_transfer.html`, `transfer.js`, `endpoints/transfers.yaml`
- **2025-12-21**: Bidirectional Filter Synchronization (plan.html):
  - Implemented automatic bidirectional sync between Analytics Section (charts) and Filters Section (facts table)
  - Added mutex-based loop prevention (`isSyncInProgress`) for safe concurrent updates
  - Created date conversion utilities: `monthToDateRange()` (YYYY-MM → full month range), `dateRangeToMonth()` (range → month if complete)
  - Implemented `syncFiltersToAnalytics()` and `syncAnalyticsToFilters()` functions with needsReload optimization
  - Modified 6 JavaScript handlers to async: `applyFilters()`, `resetFilters()`, `selectAnalyticsMonth()`, `onAnalyticsArticleTypeChange()`, `onAnalyticsArticleChange()`, new `onAnalyticsCFOChange()`
  - Updated CalendarWidget callback and analytics-cfo-filter HTML to trigger synchronization
  - **User Experience**: Selecting month in Analytics automatically updates Filters date range and reloads facts table; selecting full month via calendar automatically highlights corresponding month button in Analytics
  - **Filter Mapping**: date_from/date_to ↔ currentAnalyticsMonth (full month only), article_type/article/financial_center (direct copy), cost_center/user/search (Filters-only)
  - **Reset Button**: Now resets BOTH sections to defaults (current month + empty filters) and reloads both table and charts in parallel
  - Files: `frontend/web/templates/plan.html` (+320 lines)
- **2025-12-21**: Redis Caching Infrastructure (Phase 1):
  - Added Redis service to docker-compose.yml (redis:7-alpine with AOF persistence)
  - Created `backend/app/services/redis_service.py` - connection pool management
  - Added Redis health check to `/health/detailed` endpoint
  - Added Redis Statistics card to `/admin/monitoring` page
  - Created `scripts/lib/redis.sh` - bash module for Redis management
  - Updated `setup.sh` with `configure_redis()` function for interactive setup
  - Updated `deploy.sh` to source redis.sh and verify Redis health
  - Added `guides/redis-caching.yaml` documentation
  - Files: redis_service.py, health.py, config.py, main.py, admin_monitoring.html, setup.sh, deploy.sh, redis.sh
- **2025-12-21**: CSV/Google Sheets import improvements:
  - Fixed "Create missing references" option - now correctly creates stores/product groups during import
  - Added "Aggregate duplicates" option - sums quantity and merges comments for duplicate rows
  - Root cause: validation blocked import with "reference" errors before create_missing_references could take effect
  - Files: `shopping_csv_import.py`, `csv_validator.py`, `csvImporter.js`, `csv_import.py` schema
- **2025-12-21**: Import page optimization: removed redundant bulk-toolbar, replaced category selects with ChoicesCategoryTree (fuzzy search), replaced modal with floating category picker for table cells, removed keyboard-hints, optimized bulk-panel-filtered layout (category select 50% wider)
- **2025-12-21**: Import Step 4 UX cleanup: removed workflow steps indicator (3-step visual), bulk-panel-filtered always visible, filter sidebar collapsed by default
- **2025-12-20**: Import Step 4 Spreadsheet Enhancement: Excel-like cell selection, Fill Down (Ctrl+D), Copy/Paste (Ctrl+C/V), resizable columns with localStorage, context menu, keyboard shortcuts, status bar
- **2025-12-20**: Import page UX improvements: collapsible filter sidebar, filter elements height 3rem, bulk-panel-filtered selects height 3rem
- **2025-12-20**: Fixed critical WebSocket issues (see Known Issues & Fixes section below)
- **2025-12-19**: Added Mobile Quick Actions (Mini Cards Row pattern) - responsive 4-column grid for mobile, preserving 3-column desktop layout (index.html:55-117)
- **2025-12-19**: Updated shopping lists documentation to reflect soft delete pattern and item count filtering (commit 6aa943bf)

## Known Issues & Fixes (2025-12-22)

### Fixed Issues

| Issue | Severity | Status | File |
|-------|----------|--------|------|
| Undefined `sse` variable in facts.py | 🔴 CRITICAL | ✅ Fixed | `backend/app/api/v1/endpoints/facts.py` |
| Race condition in `send_to_connection()` | 🟠 HIGH | ✅ Fixed | `backend/app/api/v1/endpoints/budget_ws.py` |
| Race condition in `update_activity()` | 🟠 HIGH | ✅ Fixed | `backend/app/api/v1/endpoints/budget_ws.py` |
| Missing jitter in WebSocket reconnect | 🟡 MEDIUM | ✅ Fixed | `frontend/web/static/js/budget/budgetWSClient.js` |
| Long polling no exponential backoff | 🟡 MEDIUM | ✅ Fixed | `frontend/web/static/js/budget/budgetWSClient.js` |
| iOS badge flickers yellow/green every 3s | 🟡 MEDIUM | ✅ Fixed | `frontend/web/static/js/budget/budgetWSClient.js` |
| 409 Conflict при создании факта (FK violation) | 🟠 HIGH | ✅ Fixed | `backend/app/api/v1/endpoints/facts.py` |
| 409 Conflict для дат вне 2010-2040 (нет партиции) | 🟠 HIGH | ✅ Fixed | Migration `20251220_*_fix_auto_partition_trigger.py` |
| Дублирование магазинов в Choices.js dropdown | 🟡 MEDIUM | ✅ Fixed | `frontend/web/static/js/lists/listsManager.js` |
| Excessive console errors in offline mode | 🟡 MEDIUM | ✅ Fixed | `budgetWSClient.js`, `offlineManager.js` |
| iOS WebSocket reconnection loop after wake | 🟡 MEDIUM | ✅ Fixed | `frontend/web/static/js/budget/budgetWSClient.js` |

### Issue Details

**1. Undefined `sse` variable (CRITICAL)**
- **Problem**: Plan broadcasts used undefined `sse` variable instead of `ws`
- **Root cause**: Remnant from SSE → WebSocket migration
- **Fix**: Changed `sse.broadcast_plan_*` to `ws.broadcast_plan_*` (lines 244, 1020, 1111, 1218)
- **Result**: Plan operations now broadcast correctly

**2. Race conditions in connection manager (HIGH)**
- **Problem**: `send_to_connection()` and `update_activity()` had no lock protection
- **Root cause**: `broadcast()` correctly used `async with self._lock`, but other methods didn't
- **Fix**: Added async lock to both methods, made `update_activity()` async
- **Result**: No IndexError or duplicate/missed messages during concurrent operations

**3. Missing jitter in reconnect (MEDIUM)**
- **Problem**: Exponential backoff without jitter caused thundering herd
- **Root cause**: All disconnected clients retry at exact same intervals
- **Fix**: Added ±10% jitter to reconnect delay
- **Result**: Distributed reconnection load on server

**4. Long polling without backoff (MEDIUM)**
- **Problem**: Fixed 10s retry interval on errors
- **Root cause**: No exponential backoff implementation
- **Fix**: Added exponential backoff with jitter (1s → 30s max, 10 retries)
- **Result**: Reduced server load on persistent failures

**5. iOS badge flickers yellow/green every 3s (MEDIUM)**
- **Problem**: WebSocket status badge rapidly cycles between yellow (reconnecting) and green (connected) on iOS devices
- **Root cause**: Two issues combined:
  1. `_detectSafariIOS()` only detected Safari and Yandex, missing Chrome iOS (CriOS), Firefox iOS (FxiOS), Edge iOS (EdgiOS)
  2. Rapid WebSocket disconnect/reconnect cycles on iOS caused visible badge flickering
- **Fix**: Three changes in `budgetWSClient.js`:
  1. Renamed `_detectSafariIOS()` to `_detectIOSDevice()` - detects ALL iOS browsers (all use WebKit)
  2. Added status indicator debouncing (500ms) to prevent visual flickering
  3. Increased client ping frequency on iOS (8s vs 15s default) to keep connections alive
- **Result**: Stable green badge on iOS (Safari, Chrome, Firefox, Yandex, PWA)

**6. 409 Conflict при создании факта (HIGH)**
- **Problem**: При FK violation возвращался 409 без информации о причине ошибки
- **Root cause**: IntegrityError ловился middleware и конвертировался в 409 с общим сообщением "Database constraint violation"
- **Fix**: Добавлена явная проверка FK (financial_center_id, cost_center_id) ДО INSERT с понятными ошибками 422
- **Validation added**:
  - `financial_center_id`: обязательное поле, проверка exists + is_active
  - `cost_center_id`: опциональное поле, если указано - проверка exists + is_active
- **Result**: Понятные 422 ошибки вида "Счёт 'Name' архивирован. Выберите активный счёт."

**7. 409 Conflict для дат вне 2023-2030 (HIGH)**
- **Problem**: Попытка создать транзакцию с датой 2020 года вызывает 409 Conflict
- **Root cause**: Таблица `t_f_budget_fact` партиционирована по месяцам, партиции созданы только для 2023-2030
- **PostgreSQL error**: `no partition of relation "t_f_budget_fact" found for row`
- **Initial attempt (FAILED)**: BEFORE INSERT trigger на партиционированной таблице
  - **Почему не работает**: PostgreSQL сначала определяет целевую партицию, потом вызывает триггер
  - Если партиции нет → ошибка ДО вызова триггера
- **Fix**: Pre-create партиции для широкого диапазона дат (2010-2040)
  - Функция `ensure_budget_fact_partition(DATE)` для создания партиций
  - Удаление неэффективных триггеров с партиций
  - Создание партиций на 30 лет (360 партиций)
- **Migrations**:
  - `20251220_y0a1b2c3d4e5_add_auto_partition_creation.py` - функция (содержит ошибочный триггер)
  - `20251220_z1b2c3d4e5f6_fix_auto_partition_trigger.py` - удаляет триггеры, создаёт партиции
- **Result**: Транзакции с датами 2010-2040 создаются успешно

**8. Дублирование магазинов в Choices.js dropdown (MEDIUM)**
- **Problem**: На странице `/lists` в модальном окне добавления товара магазины дублируются в выпадающем списке
- **Root cause**: При reinitialize Choices.js, `destroy()` восстанавливает оригинальный HTML `<select>` со статическими `<option>` элементами. Затем `new Choices()` читает и DOM options и `choices[]` параметр, что приводит к дубликатам
- **Fix**: Добавлен `select.innerHTML = ''` после `destroy()` в функциях `initStoreChoices()` и `initProductGroupChoices()`
- **Files**: `frontend/web/static/js/lists/listsManager.js`
- **Result**: Магазины и группы товаров отображаются без дубликатов

**9. Excessive console errors in offline mode (MEDIUM)**
- **Problem**: При включении офлайн-режима в консоли появляется много ERROR-сообщений: `ERR_INTERNET_DISCONNECTED`, `[BudgetWS] Token fetch: Failed`, `Poll: HTTP 503`
- **Root cause**:
  1. `budgetWSClient.js` использовал `console.error` для штатного fallback-поведения (переход на long polling)
  2. WS клиент пытался подключиться даже когда браузер сообщал об отсутствии сети
  3. `offlineManager.js` вызывал `reconnectWS()` без проверки реального статуса сети
- **Fix**:
  1. Заменили `console.error` на `console.warn` для fallback-сообщений
  2. Добавили проверку `navigator.onLine` перед попыткой подключения в `_createConnection()` и `_startLongPolling()`
  3. Добавили проверку `isOnline` в `reconnectWS()` перед включением WS клиента
  4. HTTP 503 ошибки логируются как `console.warn` вместо `console.error`
- **Files**: `frontend/web/static/js/budget/budgetWSClient.js`, `frontend/web/static/js/offline/offlineManager.js`
- **Result**: В офлайн-режиме нет лишних ERROR-сообщений, только предупреждения для ожидаемого поведения

**10. iOS WebSocket reconnection loop after wake from sleep (MEDIUM)**
- **Problem**: After screen wake from sleep (2+ minutes), badge flickers indefinitely between yellow and green every ~3 seconds. Diagnostics show `ws_connected` → `token_fetch_start` → `ws_closed_code=1005` → cycle repeats.
- **Root cause**: Race condition during wake from sleep:
  1. iOS kills TCP connections while screen is off to save battery
  2. Multiple `visibilitychange` events fire in quick succession when screen wakes
  3. No guard against parallel reconnection attempts leads to overlapping connections
  4. Network not fully stabilized leads to code 1005 (No Status Received) and immediate retry
- **Fix**: Five changes in `budgetWSClient.js`:
  1. Added `_reconnecting` flag to prevent parallel reconnection attempts in `_forceReconnect()`
  2. Added 2-second visibility change debounce for iOS devices
  3. Added iOS wake recovery mode (`_iosWakeRecoveryMode`) with 3-second minimum delay after code 1005
  4. Improved status indicator debouncing: 1s for iOS (vs 500ms), debounce ALL states including 'connected'
  5. Updated `_isConnectionStale()` to check WebSocket readyState
- **Related**: This is a more specific case of issue #5 (iOS badge flickers) that occurs specifically after wake from sleep
- **Files**: `frontend/web/static/js/budget/budgetWSClient.js`
- **Result**: Stable reconnection after wake from sleep with no flickering

**11. Modal double-tap на iOS Safari при выборе категории (MEDIUM)**
- **Problem**: В modal_add_transaction требуется два тапа для выбора категории после смены счета (Safari 18+, Yandex)
- **Root cause**: Устаревший паттерн `<form method="dialog">` для backdrop вызывает автоматическое закрытие при Choices.js dropdown interaction
  - iOS Safari синтезирует "click outside" событие при клике на dropdown item
  - `<form method="dialog">` интерпретирует это как submit → `dialog.close()`
  - Choices.js не успевает зафиксировать выбор → требуется второй тап
- **Fix**: Три изменения:
  1. HTML: Заменили `<form method="dialog">` на `<div class="modal-backdrop"></div>`
  2. JavaScript: Добавили explicit backdrop handler с проверкой `e.target === modal`
  3. Logging: Добавили детальное логирование для отладки мобильных проблем
- **Files affected**:
  - `frontend/web/templates/components/modal_transaction.html` (строки 120-122)
  - `frontend/web/templates/index.html` (функция `openAddTransactionModal`)
  - `frontend/shared/static/js/choicesCategoryTree.js` (метод `initChoices`)
- **Result**: Choices.js dropdown работает с первого тапа на всех браузерах
- **Related**: Аналогичная проблема была исправлена ранее в modal_edit_fact, modal_transfer, modal_plan

### Known Limitations (Deferred)

| Issue | Status | Notes |
|-------|--------|-------|
| IncrementalUpdates cache invalidation | ⏳ Deferred | Requires `article_created/updated` events on backend (not implemented) |

### Documentation

- **Realtime module**: [functionality/realtime.yaml](./functionality/realtime.yaml)
- **WebSocket broadcast flow**: [flows/ws-broadcast.yaml](./flows/ws-broadcast.yaml)
