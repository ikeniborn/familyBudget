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
| [guides/](./guides/) | Development guides | 4 |

**Total: 52 files**

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
│   ├── realtime.yaml            # SSE events
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
│   ├── sse.yaml                 # /budget/events/*
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
│   ├── sse-broadcast.yaml       # Real-time updates
│   ├── offline-sync.yaml        # Offline → online sync
│   └── csv-import.yaml          # Import workflow
│
└── guides/                      # Development guides
    ├── _index.yaml              # Guide summary
    ├── change-checklist.yaml    # What to check when changing
    ├── critical-paths.yaml      # High-impact dependencies
    └── impact-analysis.yaml     # How to analyze changes
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

## Service Worker + SSE Integration

The application uses both Service Worker (for offline support) and Server-Sent Events (for real-time updates).
All browser requests pass through the Service Worker, which applies different caching strategies.

### Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              BROWSER                                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌────────────────┐   ┌─────────────────┐   ┌──────────────────────────┐   │
│  │  HTMX Widgets  │   │ BudgetSSEClient │   │  IncrementalUpdates      │   │
│  │  (quick-stats, │   │ (EventSource)   │   │  (direct DOM updates)    │   │
│  │  balances,     │   │                 │   │                          │   │
│  │  transactions) │   │  Multi-tab:     │   │  Cache:                  │   │
│  └───────┬────────┘   │  Web Locks +    │   │  - articles Map          │   │
│          │            │  BroadcastChannel│   │  - financial_centers Map │   │
│          │            └────────┬────────┘   └────────────┬─────────────┘   │
│          │                     │                         │                  │
│          │    SSE event        │    onFactCreated()      │                  │
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
       │  /api/v1/* (REST)  +  /health  +  SSE (/budget/events)    │
       └───────────────────────────────────────────────────────────┘
```

### Request Flow Optimization

| Event | Before (v1) | After (v2) |
|-------|-------------|------------|
| fact_created | SSE → refreshAll() → 3 GET | SSE → IncrementalUpdates → 0 GET |
| fact_updated | SSE → refreshAll() → 3 GET | SSE → debounced refresh → 3 GET (batched) |
| fact_deleted | SSE → refreshAll() → 3 GET | SSE → DOM remove + debounced → 3 GET (batched) |

**Result**: HTTP requests reduced by 75% (4→1 per transaction), UI latency <100ms.

### Key Files

| File | Purpose |
|------|---------|
| `sw.js` | Service Worker with caching strategies |
| `frontend/web/static/js/budget/budgetSSEClient.js` | SSE connection manager |
| `frontend/web/static/js/budget/incrementalUpdates.js` | Direct DOM updates from SSE |
| `frontend/web/static/js/htmxWidgets.js` | HTMX widget refresh with debouncing |

### Documentation

- **SSE Events**: [flows/sse-broadcast.yaml](./flows/sse-broadcast.yaml)
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

- **2025-12-19**: Added Mobile Quick Actions (Mini Cards Row pattern) - responsive 4-column grid for mobile, preserving 3-column desktop layout (index.html:55-117)
- **2025-12-19**: Updated shopping lists documentation to reflect soft delete pattern and item count filtering (commit 6aa943bf)
