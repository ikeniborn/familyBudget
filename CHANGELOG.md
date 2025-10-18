# Changelog

All notable changes to the Family Budget project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [5.2.0] - 2025-10-18

### 🔴 Critical Fixes

#### Missing Database Table (CRITICAL)
- **Issue:** Application failing with `relation "t_f_refresh_token" does not exist`
- **Impact:** Telegram Bot and Web authentication completely broken (500 errors)
- **Root Cause:** Migration `013_create_refresh_tokens_table.sql` exists but not applied to production
- **Why it happened:** Migration added after initial deployment, PostgreSQL only runs migrations on first container creation
- **Resolution:** Created comprehensive deployment fix guide in `docs/deployment/DEPLOYMENT_FIX_CRITICAL_ISSUES.md`

#### Nginx Healthcheck Failing
- **Issue:** Nginx container marked as `unhealthy` despite working correctly
- **Root Cause:** Healthcheck tests `http://localhost/health` but HTTP server block missing `/health` location
- **Fix:** Added `/health` location to `nginx/conf.d/app.conf.template` HTTP server block

### Added

#### Improved Migration System (deploy.sh)
- **New Functions:**
  - `run_migrations()` - Completely rewritten to support SQL migrations (was only checking for Alembic)
  - `apply_migrations_directly()` - Applies all `.sql` files in order with idempotency
  - `verify_database_schema()` - Validates 7 critical tables exist after migrations
- **Features:**
  - ✅ Checks migrations directory exists (`/opt/budget/backend/db/migrations/`)
  - ✅ Counts and lists all SQL migration files
  - ✅ Waits for PostgreSQL to be fully ready (30s timeout with pg_isready)
  - ✅ Applies migrations in order (001, 002, 003, ...) using sorted file list
  - ✅ Skips README.md and test files automatically
  - ✅ Reports applied vs failed migrations with detailed logging
  - ✅ Verifies critical tables after deployment:
    - `t_d_user`, `t_d_article`, `t_d_article_hierarchy`
    - `t_f_budget_fact`, `t_f_refresh_token` ← NEW!
    - `t_d_cost_center`, `t_d_financial_center`
- **Error Handling:**
  - Returns meaningful errors if PostgreSQL not healthy
  - Warns about missing migrations directory (suggests running setup.sh)
  - Gracefully handles already-applied migrations (idempotent SQL with IF NOT EXISTS)
  - Shows clear error messages for missing critical tables

#### Comprehensive Documentation
- **docs/deployment/DEPLOYMENT_FIX_CRITICAL_ISSUES.md** (NEW)
  - Complete step-by-step fix guide for critical deployment issues
  - Immediate fixes for production (copy-paste commands)
  - Permanent fixes for future deployments
  - Verification checklist
  - Known remaining issues documentation
- **docs/PROJECT_STATUS_REPORT.md** (NEW)
  - Complete project status analysis
  - All working features documented
  - All known issues catalogued with severity levels
  - Action plan with timelines
  - Statistics (code metrics, git stats)
  - Readiness assessment (75% production-ready)

### Changed

#### Nginx Configuration Template
- Added health check endpoint to HTTP server block:
  ```nginx
  # Health check endpoint (for Docker healthcheck)
  location /health {
      proxy_pass http://backend;
      proxy_set_header Host $host;
      access_log off;
  }
  ```
- Fixed HTTP/2 deprecation warnings (already done in 5.1.0)
- Fixed conflicting server name warnings (already done in 5.1.0)

### Fixed

#### Authentication Flow
- Documented Telegram OAuth vs Bot Webhook distinction
- Clarified that Telegram Login Widget doesn't require webhook
- Identified missing components for Web UI login:
  - Missing: GET endpoint `/api/v1/auth/telegram-login`
  - Missing: Telegram Login Widget JavaScript integration
  - Missing: Callback endpoint `/api/v1/auth/telegram-callback`
  - Solution: Use official Telegram Login Widget (documented)

#### Deployment Process
- Fixed migration application for new deployments
- Fixed migration application for updates (migrations now applied on every deploy)
- Added comprehensive error checking and validation
- Improved logging for troubleshooting

### Known Issues

#### PostgreSQL External Access (Medium Priority)
- **Status:** Configured but UFW firewall blocking connections
- **Configuration:** `POSTGRES_EXTERNAL_ACCESS=true`, `POSTGRES_ALLOWED_IP=78.107.114.37`
- **Issue:** UFW rule not created automatically
- **Workaround:** `sudo ufw allow from 78.107.114.37 to any port 5432 proto tcp`
- **Planned Fix:** Auto-configure UFW in deploy.sh when `POSTGRES_EXTERNAL_ACCESS=true`

#### SSL Auto-Renewal (Medium Priority - Future Issue)
- **Status:** ⚠️ Will break in 60-90 days if port 80 closed in UFW
- **Current:** Certbot uses `--standalone` mode (requires nginx stop + port 80 open)
- **Issue:** If admin closes port 80 for security → renewal fails → site goes down
- **Solution:** Migrate to `webroot` mode (allows renewal with closed port 80)
- **Planned:** Full webroot migration guide in future release

#### Web UI Login Incomplete (Medium Priority)
- **Status:** UI exists but not functional
- **Current:**
  - ✅ HTML templates have "Login with Telegram" buttons
  - ✅ Backend has POST `/api/v1/auth/telegram` endpoint
  - ❌ No GET `/api/v1/auth/telegram-login` endpoint (404)
  - ❌ No Telegram Login Widget integration
- **Impact:** Users cannot login via Web UI (only Bot works)
- **Solution:** Add Telegram Login Widget page (documented in PROJECT_STATUS_REPORT.md)

### Technical Debt

#### Migration Strategy
- Current: SQL files in `/docker-entrypoint-initdb.d/` (only runs on first container start)
- Issue: New migrations require manual application on existing deployments
- Improvement: deploy.sh now applies missing migrations automatically
- Future: Consider migration tracking table to avoid re-running migrations

#### Telegram Bot Mode
- Current: Polling mode (`USE_WEBHOOK=false`)
- Works: ✅ Yes, perfectly fine for current traffic
- Alternative: Webhook mode for instant delivery (optional optimization)
- Decision: Keep polling (no webhook needed for OAuth either)

### Deployment Notes

#### For Existing Deployments
If you're upgrading from v5.1.0 or earlier:

1. **Apply missing migration 013** (CRITICAL):
   ```bash
   cd ~/Documents/Project/familyBudget
   ./setup.sh  # Update deployment files
   cd /opt/budget
   sudo docker compose exec -T postgres psql -U familybudget familybudget < backend/db/migrations/013_create_refresh_tokens_table.sql
   ```

2. **Update nginx config** (fix healthcheck):
   ```bash
   cd ~/Documents/Project/familyBudget
   ./setup.sh  # Copies updated template
   cd /opt/budget
   sudo docker compose exec nginx nginx -s reload
   ```

3. **Configure UFW for PostgreSQL** (if using external access):
   ```bash
   sudo ufw allow from <YOUR_IP> to any port 5432 proto tcp
   ```

4. **Restart services**:
   ```bash
   sudo docker compose restart backend bot
   ```

#### For Fresh Deployments
New deployments using v5.2.0 will:
- ✅ Apply all migrations automatically (including 013)
- ✅ Have working nginx healthcheck
- ✅ Validate critical tables exist
- ⚠️ Still need manual UFW configuration for PostgreSQL external access
- ⚠️ Still need Telegram Login Widget implementation for Web UI login

### Security

#### Firewall Configuration
- Documented proper UFW setup for PostgreSQL external access
- Recommended: Restrict to specific IP only (not 0.0.0.0)
- Warning: Port 80 should remain open if using Let's Encrypt SSL (until webroot migration)

#### Authentication
- Telegram OAuth works correctly (Bot login)
- JWT refresh tokens functional (after migration 013 applied)
- Web UI login pending Telegram Widget integration

### Documentation Updates

- Added comprehensive deployment fix guide
- Added complete project status report
- Updated troubleshooting documentation
- Documented Telegram OAuth vs Webhook distinction
- Added migration best practices

## [5.1.0] - 2025-10-15

### Added

#### Admin Dashboard Analytics (TASK-021)
- 6 new admin analytics endpoints for system-wide monitoring
- `/api/v1/admin/analytics/overview` - Overall system statistics
- `/api/v1/admin/analytics/users/growth` - User growth trends
- `/api/v1/admin/analytics/transactions/trends` - Transaction trends
- `/api/v1/admin/analytics/users/top` - Top users by transactions/amount
- `/api/v1/admin/analytics/categories/breakdown` - Category breakdown by type
- `/api/v1/admin/analytics/centers/usage` - ЦФО/МВЗ usage statistics
- Admin analytics dashboard UI with 6 interactive charts
- Integration tests for all admin analytics endpoints

#### Export Functionality (TASK-022)
- **User Export Endpoints** (5 endpoints)
  - `/api/v1/export/facts/{format}` - Personal facts export (CSV, Excel, PDF)
  - `/api/v1/export/analytics/trends/{format}` - Analytics trends export (CSV, Excel)
  - Date range filtering support
  - Data isolation enforced (users only export own data)
- **Admin Export Endpoints** (3 endpoints)
  - `/api/v1/admin/export/all-facts/{format}` - System-wide facts export (CSV, Excel, PDF)
  - Advanced filtering: user_id, article_id, start_date, end_date
  - Includes "User" column to identify data sources
- **Export Utilities** (`backend/app/utils/export.py`)
  - `export_to_csv()` - CSV generation with streaming response
  - `export_to_excel()` - Excel (XLSX) generation with openpyxl
  - `export_to_pdf()` - PDF generation with reportlab
  - `generate_filename()` - Timestamp-based filename generation
- **UI Integration**
  - Export buttons on analytics.html (3 formats × 2 charts)
  - Export buttons on admin_facts.html with filter support
  - Export buttons on admin_analytics.html
  - Window.open() based download mechanism
- **Testing**
  - 28 integration tests covering all export endpoints
  - Tests verify: authentication, data isolation, file formats, filtering, filenames

#### JWT Refresh Token (TASK-020)
- Refresh token mechanism for extended sessions
- `/api/v1/auth/refresh` endpoint
- `t_d_refresh_token` table for token storage
- HTTP-only cookie support for refresh tokens
- Token rotation on refresh
- Automatic cleanup of expired tokens

### Changed

#### Database Performance Tuning (TASK-015)
- Optimized 9 critical queries from 50-300ms → <2ms average
- Added strategic indexes for fact queries
- Query plan analysis and optimization
- Performance test suite with load testing
- Documented results in `PERFORMANCE_ANALYSIS_REPORT.md`

#### Dependencies
- Added `openpyxl==3.1.2` for Excel export
- Added `reportlab==4.0.9` for PDF export

#### API Structure
- Backend API expanded to 66+ endpoints (from 58)
- New `/admin/export` prefix for admin-scoped exports
- Enhanced filtering capabilities on admin endpoints

### Fixed
- Export utilities module import error (added `__init__.py`)
- Content-Type header handling in export tests
- Error message format in admin access tests

### Performance
- Query performance improvements: 9/9 critical queries now <2ms
- Database indexes optimized for fact filtering
- Efficient JOIN queries for admin exports

---

## [5.0.0-beta] - 2025-10-15

### Added

#### Telegram Bot (EPIC-001)
- Full-featured Telegram bot with 8 commands
- `/start` - Telegram OAuth authentication with JWT tokens
- `/add` - Add transaction (expense/income) via multi-step conversation
- `/addplan` - Add budget plan for future periods
- `/summary` - View plan vs fact comparison with period selection
- `/edit` - Edit or delete last 10 transactions
- `/today` - Today's statistics
- `/stats` - All-time statistics with category breakdown
- `/settings` - Configure notifications and weekly reports
- ConversationHandler for multi-step workflows
- Inline keyboards for article/ЦФО/МВЗ selection
- Russian language interface
- Weekly budget reports (automated, every Sunday 20:00)
- Budget threshold notifications (90% plan exceeded)
- ЦФО/МВЗ integration in transaction creation

#### Financial/Cost Centers (EPIC-002)
- ЦФО (Financial Centers) - Track accounts, wallets, cash
- МВЗ (Cost Centers) - Track projects, departments, budget groups
- 10 new REST API endpoints for ЦФО/МВЗ CRUD
- SCD Type 2 support for ЦФО/МВЗ (historical tracking)
- Admin panel UI for managing ЦФО/МВЗ
- Integration in fact creation forms (Web + Telegram Bot)
- Optional fields - backward compatible

#### Advanced Analytics (EPIC-003)
- Waterfall Chart with drill-down functionality
  - Period selection: month, quarter, year
  - Cumulative cash flow visualization
  - Click to drill down by category
  - Color-coded bars (positive/negative/total)
- Heatmap for spending patterns
  - Day of week × Week of period grid
  - Color scale visualization
  - Period selection: month, quarter, year
  - Dynamic height based on data

#### Database
- Migration 010: Add `record_type` field to facts (fact/plan)
- Migration 011: Create notifications table
- Migration 012: Add ЦФО/МВЗ foreign keys to facts
- Migration 013: Create refresh tokens table (prepared for TASK-020)

#### Testing
- E2E tests for Telegram Bot (15+ tests)
- Integration tests for ЦФО/МВЗ endpoints
- Test coverage: 450+ tests (estimate)

### Changed
- `t_f_budget_fact` table: Added `financial_center_id` and `cost_center_id` columns
- Analytics page: Added 2 new chart types (waterfall, heatmap)
- Backend API: Expanded from 43 to 58+ endpoints
- Fact schema: Added optional ЦФО/МВЗ fields

### Fixed
- StructuredLogger correlation_id parameter error in middleware
- Deployment configuration issues

### Security
- Telegram OAuth authentication with HMAC-SHA256 validation
- JWT tokens stored in HTTP-only cookies
- User isolation enforced at query level
- ЦФО/МВЗ access control per user

---

## [4.4.0] - 2025-10-09

### Added
- Comprehensive E2E tests for user and admin workflows
- Complete API documentation (40+ endpoints)
- Modular PRD structure in docs/prd/
- System Architecture documentation
- Deployment scripts (install.sh, setup.sh, deploy.sh)
- Health check endpoints (/health, /health/detailed, /ready)

### Changed
- Organized all documentation into structured docs/ directory
- Refactored PRD into modular components

### Fixed
- Character encoding in CLAUDE.md
- Deployment workflow issues

---

## [4.3.0] - 2025-10-08

### Added
- Plan vs Fact comparison endpoints
- Waterfall chart backend endpoint
- Heatmap backend endpoint
- Category breakdown analytics
- Trends analysis endpoint

---

## [4.2.0] - 2025-10-07

### Added
- Article hierarchy with Closure Table pattern
- SCD Type 2 triggers for automatic versioning
- Performance indexes for fact queries

---

## [4.1.0] - 2025-10-06

### Added
- Admin panel CRUD for Facts
- Admin panel CRUD for Articles
- HTMX integration for dynamic updates

---

## [4.0.0] - 2025-10-05

### Added
- FastAPI backend (initial release)
- PostgreSQL database with SCD Type 2
- User authentication (Telegram OAuth)
- Article management
- Fact management
- Basic analytics endpoints
- Web admin panel (HTMX + ECharts)

---

## Upcoming Features

### v5.2.0 (Planned)
- Multi-currency support (TASK-023)
- Alembic migration framework (TASK-024)
- Mobile app (React Native)

### v6.0.0 (Future)
- Machine learning budget predictions
- Automatic expense categorization
- OCR receipt scanning
- Multi-user family budgets

---

## Version History

- **5.1.0** (2025-10-15) - Performance + JWT Refresh + Admin Analytics + Export
- **5.0.0-beta** (2025-10-15) - Telegram Bot + ЦФО/МВЗ + Advanced Analytics
- **4.4.0** (2025-10-09) - Documentation + E2E Tests
- **4.3.0** (2025-10-08) - Advanced Analytics Backend
- **4.2.0** (2025-10-07) - Article Hierarchy
- **4.1.0** (2025-10-06) - Admin Panel
- **4.0.0** (2025-10-05) - Initial Release

---

**Note:** This project follows semantic versioning. Major version bumps indicate breaking changes, minor version bumps add new features, and patch versions fix bugs.
