# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Family Budget is a web-based budget management system built with a microservices architecture using Docker. It provides multi-user budget tracking with Telegram authentication, separating planned vs actual expenses.

## Architecture

- **Frontend (React)**: React 19 + TypeScript + Vite at `frontend/` - Stable SPA with Telegram auth  
- **Frontend (SvelteKit)**: SvelteKit 2 + Svelte 5 + TypeScript + Vite at `frontend-svelte/` - New version in migration
- **Frontend-API**: Node.js/Express + Prisma at `frontend-api/` - Unified API (shared by both frontends)
- **Database**: PostgreSQL 13 (partitioned tables)
- **Cache**: Redis for performance optimization
- **Reverse Proxy**: Traefik for SSL/routing
- **Deployment**: Docker Compose orchestration

Services run on Docker network:
- postgres: 10.5.0.2:5432
- redis: Internal network
- frontend (React): Internal network
- frontend-svelte: Internal network  
- frontend-api: Internal network
- traefik: Public-facing

## Common Development Commands

### Start Development Environment

#### React Frontend (Stable)
```bash
# Full stack development (recommended)
./scripts/dev.sh -d

# Or manually:
docker-compose -f docker-compose.dev.yaml up -d

# Frontend only with hot reload
cd frontend && npm run dev

# Stop services
docker-compose down
```

#### SvelteKit Frontend (New Version)
```bash
# SvelteKit development
./scripts/dev-svelte.sh

# Or via Docker:
docker-compose -f docker-compose.svelte-dev.yaml up -d

# Frontend only with hot reload
cd frontend-svelte && npm run dev

# Stop services  
docker-compose -f docker-compose.svelte-dev.yaml down
```

#### Both Frontends Simultaneously
```bash
# Run both for comparison/testing
./scripts/dev.sh -d
./scripts/dev-svelte.sh

# Access points:
# React: http://localhost:3000
# Svelte: http://localhost:5173
# API: http://localhost:4000
```

### Frontend Commands

#### React Frontend
```bash
cd frontend

# Development
npm run dev              # Start Vite dev server
npm run build           # Production build
npm run preview         # Preview production build

# Testing
npm run test            # Run unit tests
npm run test:watch      # Watch mode
npm run test:coverage   # Coverage report
npm run test:e2e        # Playwright E2E tests
npm run test:all        # All tests

# Code Quality
npm run lint            # ESLint check
npm run type-check      # TypeScript check
```

#### SvelteKit Frontend
```bash
cd frontend-svelte

# Development
npm run dev              # Start SvelteKit dev server (port 5173)
npm run build           # Production build
npm run preview         # Preview production build

# Testing
npm run test            # Run Vitest unit tests
npm run test:watch      # Watch mode  
npm run test:e2e        # Playwright E2E tests

# Code Quality & Type Checking
npm run lint            # ESLint check
npm run check           # Svelte type checking
npm run format          # Prettier formatting
```

### Container Management
```bash
# View logs
docker logs -f frontend          # React frontend
docker logs -f frontend-svelte   # SvelteKit frontend  
docker logs -f frontend-api
docker logs -f postgres

# Access container
docker exec -it frontend-api bash
docker exec -it frontend bash
docker exec -it frontend-svelte bash
docker exec -it postgres psql -U budget -d budgetdb

# Restart service
docker restart frontend          # React
docker restart frontend-svelte   # SvelteKit
docker restart frontend-api

# Rebuild specific service
docker-compose -f docker-compose.dev.yaml build frontend
docker-compose -f docker-compose.svelte-dev.yaml build frontend-svelte
docker-compose -f docker-compose.dev.yaml build frontend-api
```

### Database Operations
```bash
# Connect to database
docker exec -it postgres psql -U budget -d budgetdb

# Manual backup
./postgresql/backup/postgres-backup.sh

# Apply schema changes
docker exec -it postgres psql -U budget -d budgetdb -f /docker-entrypoint-initdb.d/02-schema.sql

# Prisma operations
docker exec -it frontend-api npm run prisma:generate
docker exec -it frontend-api npm run prisma:migrate
```

## Database Schema

PostgreSQL database `budgetdb` with partitioned tables:

**Dimensions (Reference Data):**
- `t_d_user` - Users with Telegram integration
- `t_d_period` - Time periods
- `t_d_financial_center` - Financial responsibility centers (ЦФО)
- `t_d_cost_center` - Cost centers (МВЗ)
- `t_d_nomenclature` - Budget categories
- `t_d_row_type` - Operation types (plan/fact)

**Fact Table:**
- `t_f_registry` - Main transactions (partitioned by year 2023-2030)

**Product Tables:**
- `t_d_product` - Product catalog
- `t_f_product_price` - Price history
- `t_l_product_nomenclature` - Product-category mapping

## Frontend Architecture

### React Frontend Structure (Stable)
```
frontend/src/
├── components/
│   ├── common/         # Shared UI components (Layout, ErrorBoundary, DataTable)
│   ├── ui/            # shadcn/ui components
│   ├── budget/        # Budget-specific components
│   ├── fact/          # Fact-specific components
│   ├── products/      # Product management components
│   ├── reports/       # Reports and analytics components
│   └── reference/     # Reference data management (Enhanced*Manager)
├── pages/             # Route components (centralized Layout in App.tsx)
├── services/          # API services and data transformers
├── stores/           # Zustand state management
├── hooks/            # Custom React hooks
└── types/            # TypeScript type definitions
```

#### React State Management
- **Zustand** for global state (authStore, toastStore, referenceDataStore)
- **React Hook Form** for form state
- **TanStack Table** for table state
- **Custom hooks** for local state patterns

#### React Routing
- React Router v7 with centralized Layout in App.tsx
- AuthGuard wrapper for protected routes
- Lazy loading for code splitting

### SvelteKit Frontend Structure (New Version)
```
frontend-svelte/src/
├── lib/
│   ├── components/
│   │   ├── auth/       # Authentication components
│   │   ├── common/     # Shared UI components (Layout, Toast, DataTable)
│   │   ├── ui/         # Base UI components (Button, Card, Input, Table)
│   │   ├── budget/     # Budget-specific components
│   │   ├── fact/       # Fact-specific components
│   │   ├── reference/  # Reference data management
│   │   └── reports/    # Reports and analytics
│   ├── stores/         # Svelte stores for state management
│   ├── services/       # API services and data transformers
│   ├── types/          # TypeScript type definitions
│   └── utils/          # Utility functions
├── routes/
│   ├── (protected)/    # Protected route group
│   │   ├── dashboard/  # Dashboard page
│   │   ├── budget/     # Budget management
│   │   ├── fact/       # Fact management
│   │   ├── reports/    # Reports and analytics
│   │   ├── products/   # Product management
│   │   ├── reference/  # Reference data pages
│   │   └── settings/   # Settings
│   ├── login/          # Login page
│   ├── +layout.svelte  # Root layout
│   └── +page.svelte    # Home/redirect page
├── app.html            # HTML template
└── app.css             # Global styles
```

#### SvelteKit State Management
- **Svelte stores** for reactive global state
- **authStore** - user authentication and session
- **toastStore** - notification system
- **errorStore** - global error handling
- **referenceDataStore** - CRUD operations for reference data

#### SvelteKit Routing
- File-based routing with route groups
- `(protected)` group with AuthGuard via +layout.svelte
- SSR-ready page components
- Automatic code splitting and lazy loading

#### SvelteKit Features
- **Type Safety**: Full TypeScript integration with Svelte
- **Reactivity**: Built-in reactive statements and stores
- **Performance**: Compilation-based approach, smaller bundles
- **SSR/SSG**: Server-side rendering and static generation support
- **Hot Reload**: Fast development experience with Vite

## API Structure

Frontend-API endpoints at `/api/`:
- `/auth/*` - Telegram authentication
- `/users` - User management
- `/periods` - Period operations
- `/financial_centers` - ЦФО management
- `/cost_centers` - МВЗ management
- `/nomenclatures` - Category management
- `/registry` - Transaction operations
- `/products` - Product management
- `/reports/*` - Analytics and reporting

All endpoints require user context for data isolation.

## Key Project Files

### React Frontend (Stable)
- `frontend/src/App.tsx` - Main React app with routing
- `frontend/src/main.tsx` - Entry point
- `frontend/vite.config.ts` - Vite configuration
- `frontend/package.json` - Dependencies and scripts

### SvelteKit Frontend (New Version)
- `frontend-svelte/src/routes/+layout.svelte` - Root layout
- `frontend-svelte/src/app.html` - HTML template
- `frontend-svelte/svelte.config.js` - SvelteKit configuration
- `frontend-svelte/vite.config.ts` - Vite configuration
- `frontend-svelte/package.json` - Dependencies and scripts

### Shared Backend
- `frontend-api/src/index.ts` - Express server entry
- `frontend-api/prisma/schema.prisma` - Database schema
- `postgresql/ddl/budgetdb.sql` - SQL schema definition

### Docker Configurations
- `docker-compose.yaml` - Production config (React)
- `docker-compose.dev.yaml` - React development config
- `docker-compose.svelte.yaml` - Production config (SvelteKit)
- `docker-compose.svelte-dev.yaml` - SvelteKit development config

### Environment & Scripts
- `.env.dev` / `.env.prod` - Environment templates
- `scripts/dev.sh` - React development script
- `scripts/dev-svelte.sh` - SvelteKit development script
- `scripts/prod.sh` - Production deployment script

## Development Guidelines

### UI/UX Design System (APPROVED)
- **Reference Design**: Dashboard page (`/dashboard`)
- **Layout**: Gradient backgrounds `bg-gradient-to-br from-slate-50 to-slate-100`
- **Cards**: Colored left borders (border-l-4)
  - Blue (border-l-blue-500): Budget/primary metrics
  - Red (border-l-red-500): Expenses/warnings
  - Green (border-l-green-500): Income/positive metrics
  - Purple (border-l-purple-500): Savings/secondary metrics
- **Icons**: Lucide React in colored circles
- **Spacing**: gap-6 for grids, space-y-6 for vertical
- **Typography**: Bold numbers for metrics, subtle labels

### Data Visualization
- **Library**: Recharts (adopted 13.07.2025)
- **Chart Types**: Bar, Line, Pie/Donut, Gauge, Waterfall
- **Design**: Consistent colors, interactive tooltips, responsive
- **Export**: PNG/SVG functionality

### Code Style
- **React Frontend**: ESLint + Prettier (see `.eslintrc`)
- **SvelteKit Frontend**: ESLint + Prettier + Svelte plugin
- **Backend**: ESLint for TypeScript
- **Python**: Black (180 chars) + Flake8 (legacy API)

### SvelteKit Specific Guidelines
- **Components**: Use .svelte extension with TypeScript lang="ts"
- **Stores**: Prefer Svelte stores over complex state management
- **Reactivity**: Use $: reactive statements for derived data
- **Forms**: Integrate with svelte-forms-lib for validation
- **Routing**: Leverage file-based routing with proper +page.svelte structure
- **SSR**: Design components to work with server-side rendering

### Testing Strategy

#### React Testing
- **Unit Tests**: Jest + React Testing Library
- **E2E Tests**: Playwright
- **Performance**: Playwright performance tests
- **Accessibility**: axe-playwright for a11y

#### SvelteKit Testing  
- **Unit Tests**: Vitest + @testing-library/svelte
- **E2E Tests**: Playwright (shared with React)
- **Performance**: Playwright performance tests
- **Accessibility**: axe-playwright for a11y
- **Component Tests**: @testing-library/svelte for isolated component testing

### Performance Optimizations
- React.lazy() for code splitting
- Virtualized scrolling for large lists
- Debounced search and API calls
- Optimistic UI updates
- Redis caching layer
- Prisma query optimization

### Security Practices
- Telegram OAuth authentication
- User data isolation via user_id
- Prisma ORM (SQL injection protection)
- Environment-based secrets
- Session management with express-session

## Recent Architectural Changes

### UI/UX Improvements (13.07.2025)
- Centralized Layout management in App.tsx routing
- Fixed double Layout rendering issues
- Implemented consistent card-based UI design
- Added keyboard shortcuts system
- Enhanced accessibility with ARIA support

### Advanced Features (13.07.2025)
- Bulk operations with Excel/CSV import/export
- Audit trail with version history
- Advanced search with saved filters
- Real-time cross-tab synchronization
- Undo/Redo functionality

### Migration from Dual-Stack (January 2025)
- Unified API: Python + Node.js → Node.js only
- ORM: Raw SQL → Prisma
- Performance: 20-40% faster response times
- Memory: 30-50% reduction
- Services: 4 → 3 (simplified architecture)

## Deployment

### Production
```bash
# Use production script
./scripts/prod.sh

# Or manually
cp .env.prod .env
docker-compose up -d --build
```

### Environment Variables
Key variables in `.env`:
- `POSTGRES_PASSWORD` - PostgreSQL root password
- `BUDGET_DB_PASSWORD` - Application database password
- `SESSION_SECRET` - Express session secret
- `TELEGRAM_BOT_TOKEN` - Telegram bot token
- `DOMAIN` - Domain for SSL certificates
- `REDIS_URL` - Redis connection string

### Backup Strategy
- PostgreSQL: Daily at midnight via cron
- Destination: Yandex Object Storage via MinIO
- Script: `postgresql/backup/postgres-backup.sh`

## Troubleshooting

### Common Issues
1. **Container startup**: Check `docker logs <container>`
2. **Database connection**: Verify credentials in `.env`
3. **Frontend blank page**: Check browser console, verify API connection
4. **SSL issues**: Check Traefik logs, domain DNS
5. **Memory issues**: `docker system prune -a`

### Debug Commands
```bash
# Check container status
docker ps -a

# View detailed logs
docker logs --tail 100 -f <container>

# Database connectivity
docker exec -it postgres psql -U budget -d budgetdb -c "SELECT 1"

# API health check
curl http://localhost:4000/health

# Clear all containers and volumes (CAUTION)
docker-compose down -v
```