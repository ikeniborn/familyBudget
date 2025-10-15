# Changelog

All notable changes to the Family Budget project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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

### v5.1.0 (Planned)
- Performance optimizations (TASK-015, TASK-016, TASK-017)
- JWT Refresh Token mechanism (TASK-020)
- Admin Dashboard Analytics (TASK-021)
- Export functionality (CSV/Excel/PDF) (TASK-022)

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

- **5.0.0-beta** (2025-10-15) - Telegram Bot + ЦФО/МВЗ + Advanced Analytics
- **4.4.0** (2025-10-09) - Documentation + E2E Tests
- **4.3.0** (2025-10-08) - Advanced Analytics Backend
- **4.2.0** (2025-10-07) - Article Hierarchy
- **4.1.0** (2025-10-06) - Admin Panel
- **4.0.0** (2025-10-05) - Initial Release

---

**Note:** This project follows semantic versioning. Major version bumps indicate breaking changes, minor version bumps add new features, and patch versions fix bugs.
