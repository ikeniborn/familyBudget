# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Family Budget is a web-based budget management system built with SvelteKit and Node.js using Docker. It provides multi-user budget tracking with Telegram authentication, separating planned vs actual expenses.

## ⚠️ CRITICAL DEVELOPMENT RULES

**ALL DEVELOPMENT AND TESTING MUST BE DONE THROUGH DOCKER CONTAINERS ONLY**

- ❌ **NEVER** run `npm`, `node`, or any package manager commands directly on the host machine
- ❌ **NEVER** install Node.js or npm packages outside of Docker containers
- ✅ **ALWAYS** use `docker exec` commands to run development tasks
- ✅ **ALWAYS** use the development containers for all operations

**Why this is critical:**
- Ensures consistent environment across all developers
- Prevents version conflicts and "works on my machine" issues
- Maintains dependency isolation and reproducible builds
- Matches production environment exactly

**Container names for development:**
- Frontend: `frontend-svelte-dev` or `frontend-svelte`
- Backend API: `frontend-api-dev` or `frontend-api`

## Architecture

- **Frontend**: SvelteKit 2 + Svelte 5 + TypeScript + Vite at `frontend-svelte/` - Modern SPA with SSR support
- **Backend API**: Node.js/Express + Prisma at `frontend-api/` - Unified API with type safety
- **Database**: PostgreSQL 13 (partitioned tables)
- **Cache**: Redis for performance optimization
- **Reverse Proxy**: Traefik for SSL/routing
- **Deployment**: Docker Compose orchestration

Services run on Docker network:
- postgres: 10.5.0.2:5432
- redis: Internal network
- frontend-svelte: Internal network  
- frontend-api: Internal network
- traefik: Public-facing

## Common Development Commands

### Start Development Environment

```bash
# Quick start with Docker (includes DB initialization)
./scripts/dev.sh -d          # Detached mode
./scripts/dev.sh --init-db    # Force DB reinitialization

# ⚠️ DEPRECATED: Do not use direct npm commands
# Use Docker containers only (see Critical Development Rules above)

# Stop services  
docker-compose -f docker-compose.dev.yaml down

# Access points:
# Frontend: http://localhost:5173 (dev) or http://localhost:3000 (production)
# API: http://localhost:4000
```

### Frontend Commands

**⚠️ WARNING: ALL commands must run through Docker containers - NEVER use npm directly on host**

```bash
# Development (containers must be running via ./scripts/dev.sh)
docker exec -it frontend-svelte-dev npm run dev     # Start SvelteKit dev server (port 5173)
docker exec -it frontend-svelte-dev npm run build   # Production build
docker exec -it frontend-svelte-dev npm run preview # Preview production build

# Testing
docker exec -it frontend-svelte-dev npm run test            # Run Vitest unit tests
docker exec -it frontend-svelte-dev npm run test:run        # Single test run (CI mode)
docker exec -it frontend-svelte-dev npm run test:watch      # Watch mode  
docker exec -it frontend-svelte-dev npm run test:coverage   # Generate coverage report
docker exec -it frontend-svelte-dev npm run test:ui         # Interactive UI for tests

# Code Quality & Type Checking
docker exec -it frontend-svelte-dev npm run lint            # ESLint check
docker exec -it frontend-svelte-dev npm run check           # Svelte type checking
docker exec -it frontend-svelte-dev npm run check:watch     # Type checking in watch mode
docker exec -it frontend-svelte-dev npm run format          # Prettier formatting

# Performance
docker exec -it frontend-svelte-dev npm run lighthouse      # Run Lighthouse audit
docker exec -it frontend-svelte-dev npm run perf:analyze    # Build + Lighthouse analysis

# Package Management (when needed)
docker exec -it frontend-svelte-dev npm install             # Install dependencies
docker exec -it frontend-svelte-dev npm install <package>   # Add new package
docker exec -it frontend-svelte-dev npm uninstall <package> # Remove package
```

### Backend API Commands

**⚠️ WARNING: ALL commands must run through Docker containers - NEVER use npm directly on host**

```bash
# Development (containers must be running via ./scripts/dev.sh)
docker exec -it frontend-api-dev npm run dev             # Run with nodemon (index-simple.ts)
docker exec -it frontend-api-dev npm run dev:full        # Run full version with nodemon
docker exec -it frontend-api-dev npm run build           # TypeScript build
docker exec -it frontend-api-dev npm run start           # Production start

# Testing  
docker exec -it frontend-api-dev npm run test            # Run Jest tests
docker exec -it frontend-api-dev npm run test:watch      # Jest watch mode
docker exec -it frontend-api-dev npm run test:coverage   # Generate coverage report

# Type Checking & Database
docker exec -it frontend-api-dev npm run type-check      # TypeScript type checking
docker exec -it frontend-api-dev npm run prisma:generate # Generate Prisma client
docker exec -it frontend-api-dev npm run prisma:migrate  # Run Prisma migrations
docker exec -it frontend-api-dev npm run prisma:studio   # Open Prisma Studio GUI

# Package Management (when needed)
docker exec -it frontend-api-dev npm install             # Install dependencies
docker exec -it frontend-api-dev npm install <package>   # Add new package
docker exec -it frontend-api-dev npm uninstall <package> # Remove package
```

### Container Management
```bash
# View logs
docker logs -f frontend-svelte   # SvelteKit frontend  
docker logs -f frontend-api
docker logs -f postgres
docker logs -f redis

# Access container
docker exec -it frontend-api bash
docker exec -it frontend-svelte bash
docker exec -it postgres psql -U budget -d budgetdb

# Restart service
docker restart frontend-svelte   # SvelteKit
docker restart frontend-api

# Rebuild specific service
docker-compose -f docker-compose.dev.yaml build frontend-svelte
docker-compose -f docker-compose.dev.yaml build frontend-api
```

### Testing in Containers

**All testing must be performed through Docker containers to ensure environment consistency**

```bash
# Frontend Testing
docker exec -it frontend-svelte-dev npm run test                    # Run all tests
docker exec -it frontend-svelte-dev npm run test:coverage           # Generate coverage report
docker exec -it frontend-svelte-dev npm run test:watch              # Watch mode for development
docker exec -it frontend-svelte-dev npm run test:ui                 # Interactive test UI
docker exec -it frontend-svelte-dev npm test -- --reporter=verbose  # Verbose test output

# Backend Testing
docker exec -it frontend-api-dev npm run test                       # Run Jest tests
docker exec -it frontend-api-dev npm run test:coverage              # Generate coverage report
docker exec -it frontend-api-dev npm run test:watch                 # Watch mode for development
docker exec -it frontend-api-dev npm test -- --detectOpenHandles    # Debug hanging tests

# Debug Tests in Container
docker exec -it frontend-svelte-dev bash    # Access container shell for debugging
docker exec -it frontend-api-dev bash       # Access container shell for debugging

# View Test Results
docker exec -it frontend-svelte-dev cat coverage/lcov-report/index.html  # Coverage report
docker exec -it frontend-api-dev cat coverage/lcov-report/index.html     # Coverage report

# Run Specific Test Files
docker exec -it frontend-svelte-dev npm test -- src/lib/components/Button.test.ts
docker exec -it frontend-api-dev npm test -- src/routes/auth.test.ts
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
- `t_d_period` - Time periods (format: YYYY.MM for monthly)
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

**Key Relationships:**
- All fact data is isolated by `user_id`
- Registry entries link to period, financial_center, cost_center, nomenclature
- Row type 1 = Plan, Row type 2 = Fact

## Frontend Architecture

### SvelteKit Frontend Structure
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
- `/auth/*` - Telegram authentication (POST /telegram for OAuth)
- `/users` - User management (GET/POST/PUT/DELETE)
- `/periods` - Period operations (CRUD + GET /current)
- `/financial_centers` - ЦФО management (CRUD)
- `/cost_centers` - МВЗ management (CRUD + GET by financial_center)
- `/nomenclatures` - Category management (CRUD)
- `/registry` - Transaction operations (CRUD + bulk operations)
- `/products` - Product management (CRUD + price history)
- `/reports/*` - Analytics and reporting (various aggregations)

**Authentication Flow:**
1. Frontend calls `/api/auth/telegram` with Telegram data
2. Backend validates hash and creates/updates user
3. Session is established via express-session
4. All subsequent requests use session cookie

**Data Isolation:**
- All endpoints automatically filter by authenticated `user_id`
- No cross-user data access possible
- User context extracted from session middleware

## Key Project Files

### SvelteKit Frontend
- `frontend-svelte/src/routes/+layout.svelte` - Root layout
- `frontend-svelte/src/app.html` - HTML template
- `frontend-svelte/svelte.config.js` - SvelteKit configuration
- `frontend-svelte/vite.config.ts` - Vite configuration
- `frontend-svelte/package.json` - Dependencies and scripts

### Backend API
- `frontend-api/src/index.ts` - Express server entry
- `frontend-api/prisma/schema.prisma` - Database schema
- `postgresql/ddl/budgetdb.sql` - SQL schema definition

### Docker Configurations
- `docker-compose.yaml` - Production config
- `docker-compose.dev.yaml` - Development config

### Environment & Scripts
- `.env.dev` / `.env.prod` - Environment templates
- `scripts/dev.sh` - Development script with DB initialization
- `scripts/prod.sh` - Production deployment script

## Key Architectural Patterns

### Frontend State Management
- **Auth State**: Managed in `$lib/stores/auth.ts` with user session
- **Toast Notifications**: Global toast store for user feedback
- **API Client**: Axios instance with interceptors in `$lib/services/api.ts`
- **Error Handling**: Centralized error handling with toast notifications

### API Patterns
- **Middleware Stack**: cors → helmet → compression → session → auth → routes
- **Prisma Client**: Singleton pattern in `frontend-api/src/database/client.ts`
- **Error Responses**: Standardized format `{ error: string, details?: any }`
- **Session Management**: Redis-backed sessions with 24h TTL

### Data Flow
1. User action in Svelte component
2. Call service function (`$lib/services/*.ts`)
3. Service makes API call via axios
4. API validates session and user context
5. Prisma query with automatic user_id filtering
6. Response transformation and return to frontend
7. Update Svelte stores and UI reactively

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
- **SvelteKit Frontend**: ESLint + Prettier + Svelte plugin
- **Backend**: ESLint for TypeScript

### SvelteKit Specific Guidelines
- **Components**: Use .svelte extension with TypeScript lang="ts"
- **Stores**: Prefer Svelte stores over complex state management
- **Reactivity**: Use $: reactive statements for derived data
- **Forms**: Integrate with svelte-forms-lib for validation
- **Routing**: Leverage file-based routing with proper +page.svelte structure
- **SSR**: Design components to work with server-side rendering

### Testing Strategy

**⚠️ CRITICAL: All testing must be performed in Docker containers only**

- **Frontend (SvelteKit)**: Vitest + @testing-library/svelte, 50% coverage threshold
  ```bash
  # Run via container only
  docker exec -it frontend-svelte-dev npm run test:coverage
  ```
- **Backend (Node.js)**: Jest + ts-jest, 70-80% coverage threshold
  ```bash
  # Run via container only
  docker exec -it frontend-api-dev npm run test:coverage
  ```
- **E2E Tests**: Playwright (configuration needed)
  ```bash
  # Will run via container when configured
  docker exec -it frontend-svelte-dev npm run test:e2e
  ```
- **Performance**: Lighthouse CI for performance audits
  ```bash
  # Run via container only
  docker exec -it frontend-svelte-dev npm run lighthouse
  ```
- **Component Tests**: @testing-library/svelte for isolated component testing
  ```bash
  # Run via container only
  docker exec -it frontend-svelte-dev npm run test -- --ui
  ```

**Testing Environment Requirements:**
- Tests must pass in containerized environment
- No host-machine dependencies allowed
- Use container networking for API tests
- Coverage reports generated inside containers

### Performance Optimizations
- SvelteKit code splitting and lazy loading
- Virtualized scrolling for large lists  
- Debounced search and API calls
- Optimistic UI updates
- Redis caching layer
- Prisma query optimization
- Server-side rendering (SSR) support

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

### Completed Migration (August 2025)
- Frontend: React → SvelteKit for better performance and developer experience
- Unified API: Python + Node.js → Node.js only with Prisma ORM
- Performance: 20-40% faster response times, 30-50% memory reduction
- Architecture: Simplified from dual-stack to unified SvelteKit + Node.js

## CI/CD Pipeline

GitHub Actions workflow (`.github/workflows/ci-cd.yml`) runs on:
- Push to `master` or `develop` branches
- Pull requests to `master`

**Pipeline Steps:**
1. Frontend tests (lint, test, build)
2. Backend API tests (lint, test, build)
3. Docker image build and push to GitHub Container Registry
4. Coverage reports upload

**Note**: CI/CD configuration needs updating for SvelteKit migration (currently references old React frontend paths)

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

## Important Conventions

### Data Formatting
- **Periods**: Format as "YYYY.MM" (e.g., "2025.01")
- **Money Values**: Store as decimal(10,2) in database
- **User IDs**: Always use authenticated user_id from session
- **Row Types**: 1 = Plan (budget), 2 = Fact (actual)

### Frontend Conventions
- **Component Imports**: Use `$lib/` aliases for absolute imports
- **API Calls**: Always use service layer, never direct axios in components
- **Forms**: Use Yup or Zod for validation schemas
- **Tables**: Use @tanstack/svelte-table for data grids
- **Charts**: Use Chart.js via svelte-chartjs wrapper

### Backend Conventions  
- **Route Handlers**: Always check `req.session.userId` first
- **Prisma Queries**: Include `where: { user_id }` in all queries
- **Error Handling**: Use try-catch with standardized error responses
- **Transactions**: Use Prisma transactions for multi-table operations

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