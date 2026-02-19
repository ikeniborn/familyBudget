---
title: familyBudget Documentation
---

# familyBudget

Family Budget is a family budget management system with Telegram bot and web interface.
Built on FastAPI (backend), PostgreSQL (database), Docker deployment.

**Key Features:** Telegram OAuth · Email+Password · WebAuthn biometrics · Hierarchical budget categories ·
Transaction tracking with offline sync · Telegram bot with Web Apps · Progressive Web App (HTMX + Tailwind CSS + DaisyUI) ·
Real-time updates via WebSocket + Redis Pub/Sub

**Stack:** FastAPI 0.121.2 | PostgreSQL 16 | python-telegram-bot 21.10 | Docker Compose | Dexie.js 4.0+

---

```{toctree}
:maxdepth: 1
:caption: Guides & Testing

BACKUP_RESTORE
RUNNING_TESTS
TEST_COVERAGE_ANALYSIS
```

```{toctree}
:maxdepth: 2
:caption: Architecture Overview

architecture/README
```

```{toctree}
:maxdepth: 1
:caption: Core Architecture

architecture/core/authentication
architecture/core/pwa
architecture/core/dexie-integration
architecture/core/websocket
architecture/core/build-system
architecture/core/docker
```

```{toctree}
:maxdepth: 1
:caption: Features

architecture/features/transfers-system
architecture/features/recurring-plans
architecture/features/notifications
architecture/features/admin-setup
architecture/features/bulk-delete-optimization
architecture/features/backup-system
architecture/features/import-wizard
architecture/features/welcome-notification
```

```{toctree}
:maxdepth: 1
:caption: Frontend

architecture/frontend/responsive-design
architecture/frontend/z-index-layering
architecture/frontend/modal-architecture
architecture/frontend/modal-keyboard-adaptation
architecture/frontend/loading-patterns
architecture/frontend/template-components
architecture/frontend/header-standards
architecture/frontend/base-template-structure
architecture/frontend/speed-dial-unified
architecture/frontend/table-optimization
architecture/frontend/table-optimization-patterns
architecture/frontend/shopping-lists
```

```{toctree}
:maxdepth: 1
:caption: Operations

architecture/operations/ci-cd-build-deploy
architecture/operations/deployment-troubleshooting
architecture/operations/disaster-recovery
architecture/operations/backup-operations
architecture/operations/versioning
architecture/operations/ci-cd-setup
architecture/operations/ci-cd-optimization
architecture/operations/security-advisories
architecture/operations/browser-testing-workarounds
architecture/operations/testing-phases-summary
architecture/operations/redis-alternatives-comparison
```

```{toctree}
:maxdepth: 1
:caption: Optimization & Migrations

architecture/optimization/caching-strategy
architecture/optimization/cache-busting
architecture/optimization/installation-resilience
architecture/migrations/es-modules-migration
architecture/migrations/dexie-rollback
architecture/patterns/retry-pattern
architecture/security/logging-best-practices
```

```{toctree}
:maxdepth: 1
:caption: Product Requirements

prd/README
prd/01-executive-summary
prd/02-product-overview
prd/03-system-architecture
prd/04-functional-requirements
prd/05-non-functional-requirements
prd/06-database-design
prd/07-api-specification
prd/08-ui-design
prd/09-security-authentication
prd/10-deployment-operations
prd/11-testing-strategy
prd/13-appendices
prd/14-caching-strategy
prd/15-code-style-guidelines
prd/16-changelog-release-management
```

---

:::{note}
**For AI agents:** This documentation generates `llms.txt` and `llms-full.txt` at build time.
Use them for efficient navigation: `docs/sphinx/_build/html/llms.txt`
:::
