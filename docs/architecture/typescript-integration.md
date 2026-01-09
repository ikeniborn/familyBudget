# TypeScript Integration

**Version:** 7.1.0
**Migration Date:** 2026-01-05
**Commit:** fd8cf2484859691e8cbc9c176ac9550329ba9746

## Overview

Family Budget uses a **hybrid TypeScript/JavaScript approach** for gradual TypeScript adoption while maintaining backward compatibility.

**Key Principle:** Development in TypeScript, production in JavaScript.

---

## Hybrid Approach

### Architecture

```
Source Code (.ts files)
       ↓
Type Checking (tsc --noEmit)  ← Pre-commit hook
       ↓
Vite Build (.ts → .js)
       ↓
Minification (Terser)
       ↓
Production (.min.js files)
```

**Critical Benefits:**
- **Type Safety**: Catch errors at compile-time, not runtime
- **IDE Support**: IntelliSense, autocomplete, refactoring
- **Backward Compatible**: Production still uses .js files
- **Gradual Migration**: Migrate modules incrementally

---

## Migration Status

### Phase 3-4 Complete (v7.1.0)

**14 modules migrated** (~16,000 lines):

| Module | File | Lines | TS Errors |
|--------|------|-------|-----------|
| **offlineManager** | `frontend/web/static/js/offline/offlineManager.ts` | 1,436 | **0** ✅ |
| **budgetWSClient** | `frontend/web/static/js/budget/budgetWSClient.ts` | 2,693 | 12 |
| **listsManager** | `frontend/web/static/js/lists/listsManager.ts` | 3,809 | 188 |
| **csvImporter** | `frontend/web/static/js/lists/csvImporter.ts` | 1,722 | 67 |
| **budgetShared** | `frontend/shared/static/js/budgetShared.ts` | 2,919 | 206 |
| conflictResolver | `frontend/web/static/js/offline/conflictResolver.ts` | 474 | 0 |
| idb | `frontend/web/static/js/offline/idb.ts` | 1,121 | 0 |
| networkDetector | `frontend/web/static/js/offline/networkDetector.ts` | 652 | 0 |
| pushManager | `frontend/web/static/js/offline/pushManager.ts` | 516 | 0 |
| logger | `frontend/web/static/js/utils/logger.ts` | 244 | 0 |
| dateFormatter | `frontend/shared/static/js/dateFormatter.ts` | 661 | 0 |
| debugLog | `frontend/shared/static/js/debugLog.ts` | 178 | 0 |
| storage | `frontend/webapp/static/js/storage.ts` | 202 | 0 |
| **Total** | | **~16,000** | **473** |

**Error Breakdown:**
- **473 non-critical errors** (acceptable for gradual migration)
- **0 errors** in critical modules (offlineManager, idb, networkDetector, etc.)
- **Main error categories**: implicit any, missing null checks, type assertions

---

## Type Definition Files

### Global Types (types/ directory)

**6 comprehensive type definition files** provide type coverage for the entire application:

#### 1. api.d.ts (170 lines)

**Purpose:** API responses, network types

```typescript
// Generic API response wrapper
interface ApiResponse<T> {
    success: boolean;
    data: T;
    error?: string;
}

// Paginated responses
interface PaginatedResponse<T> {
    items: T[];
    total: number;
    page: number;
    pageSize: number;
}

// WebSocket message types
type WSMessageType =
    | 'fact_created'
    | 'fact_updated'
    | 'fact_deleted'
    | 'facts_batch_deleted'
    | 'article_updated'
    | 'transfer_created';

interface WSMessage {
    type: WSMessageType;
    payload: unknown;
}

// Network status
interface NetworkInfo {
    online: boolean;
    effectiveType?: string;
    downlink?: number;
    rtt?: number;
}
```

#### 2. models.d.ts (219 lines)

**Purpose:** Domain models (User, BudgetFact, Article, etc.)

```typescript
// User model
interface User {
    id: number;
    telegram_id?: number;
    username?: string;
    email?: string;
    is_admin: boolean;
    created_at: string;
}

// Budget fact (transaction)
interface BudgetFact {
    id: number;
    user_id: number;
    article_id: number;
    financial_center_id?: number;
    cost_center_id?: number;
    amount: number;
    record_date: string;
    record_type: 'income' | 'expense' | 'plan';
    description?: string;
    transfer_id?: number;
    sync_hash?: string;
    created_at: string;
    updated_at: string;
}

// Article (budget category)
interface Article {
    id: number;
    name: string;
    parent_id?: number;
    article_type: 'income' | 'expense';
    is_active: boolean;
    sort_order: number;
    created_at: string;
}

// Transfer (between accounts)
interface Transfer {
    id: number;
    from_financial_center_id: number;
    to_financial_center_id: number;
    amount: number;
    transfer_date: string;
    sync_hash: string;
    created_at: string;
}
```

#### 3. global.d.ts (144 lines)

**Purpose:** Window namespace extensions

```typescript
// Extend Window interface with our globals
interface Window {
    // Loggers
    logPWA: Logger;
    logSW: Logger;
    logDB: Logger;
    logSync: Logger;
    logAPI: Logger;
    logNav: Logger;

    // Core classes
    OfflineManager?: typeof OfflineManager;
    BudgetWSClient?: typeof BudgetWSClient;
    ListsManager?: typeof ListsManager;
    CSVImporter?: typeof CSVImporter;

    // Feature flags
    FEATURE_FLAGS: {
        ENABLE_WEB_WORKERS: boolean;
        ENABLE_PUSH_NOTIFICATIONS: boolean;
        ENABLE_OFFLINE_MODE: boolean;
    };

    // Configuration
    WORKER_VERSION: string;
    API_BASE_URL: string;
    WS_URL: string;
}
```

#### 4. indexeddb.d.ts (167 lines)

**Purpose:** IndexedDB schema

```typescript
// Database schema
interface BudgetDB extends DBSchema {
    facts: {
        key: number;
        value: BudgetFact;
        indexes: {
            'by-sync-hash': string;
            'by-date': string;
        };
    };
    transfers: {
        key: number;
        value: Transfer;
        indexes: {
            'by-sync-hash': string;
        };
    };
    pendingSync: {
        key: string;
        value: PendingSyncOperation;
    };
}
```

#### 5. navigator.d.ts (165 lines)

**Purpose:** Browser APIs (Network Information)

```typescript
// Network Information API
interface Navigator {
    connection?: NetworkInformation;
    mozConnection?: NetworkInformation;
    webkitConnection?: NetworkInformation;
}

interface NetworkInformation extends EventTarget {
    type: ConnectionType;
    effectiveType: EffectiveConnectionType;
    downlink: number;
    rtt: number;
    saveData: boolean;
    onchange: ((this: NetworkInformation, ev: Event) => any) | null;
}

type ConnectionType =
    | 'bluetooth'
    | 'cellular'
    | 'ethernet'
    | 'none'
    | 'wifi'
    | 'wimax'
    | 'other'
    | 'unknown';
```

#### 6. telegram.d.ts (246 lines)

**Purpose:** Telegram WebApp types

```typescript
interface TelegramWebApp {
    initData: string;
    initDataUnsafe: TelegramWebAppInitData;
    version: string;
    platform: string;
    colorScheme: 'light' | 'dark';
    themeParams: TelegramThemeParams;
    isExpanded: boolean;
    viewportHeight: number;
    viewportStableHeight: number;

    // Methods
    ready(): void;
    expand(): void;
    close(): void;
    MainButton: TelegramMainButton;
    BackButton: TelegramBackButton;
    showAlert(message: string): void;
    showConfirm(message: string): Promise<boolean>;
}

interface TelegramWebAppInitData {
    user?: TelegramUser;
    chat?: TelegramChat;
    auth_date: number;
    hash: string;
}
```

---

## TypeScript Configuration

### tsconfig.json

**File:** `tsconfig.json` (59 lines)

**Strict Mode Enabled:**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "node",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],

    // Strict mode
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "strictBindCallApply": true,
    "strictPropertyInitialization": true,
    "noImplicitThis": true,
    "alwaysStrict": true,

    // Additional checks
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedIndexedAccess": true,

    // Module resolution
    "baseUrl": ".",
    "paths": {
      "@web/*": ["frontend/web/static/js/*"],
      "@webapp/*": ["frontend/webapp/static/js/*"],
      "@shared/*": ["frontend/shared/static/js/*"]
    },

    // Interop
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "isolatedModules": true,
    "skipLibCheck": true,

    // Emit
    "declaration": false,
    "declarationMap": false,
    "sourceMap": false,
    "noEmit": true
  },
  "include": [
    "frontend/**/*.ts",
    "types/**/*.d.ts"
  ],
  "exclude": [
    "node_modules",
    "frontend/**/*.min.js",
    "frontend/**/*.js"
  ]
}
```

**Key Settings:**
- **noEmit: true** - Type-check only, Vite handles compilation
- **strict: true** - All strict mode checks enabled
- **paths** - Barrel imports support (@web, @shared, @webapp)
- **isolatedModules: true** - Each file can be transpiled independently

---

## Pre-commit Hook

### Automatic Type Validation

**File:** `.husky/pre-commit` (13 lines)

```bash
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

npm run type-check
```

**Workflow:**

```
Developer runs: git commit -m "feat: new feature"
       ↓
Pre-commit hook triggers
       ↓
Runs: npm run type-check (tsc --noEmit)
       ↓
TypeScript errors found?
       ↓
   YES → Commit BLOCKED ❌
   NO  → Commit proceeds ✅
```

**Example:**

```bash
# Edit TypeScript file
vim frontend/web/static/js/offline/offlineManager.ts

# Try to commit
git add . && git commit -m "feat: add feature"

# Pre-commit hook runs automatically
> npm run type-check

# If errors:
error TS2345: Argument of type 'string' is not assignable to parameter of type 'number'.
husky - pre-commit hook exited with code 1 (error)

# Fix errors in .ts files (NOT .js files)
vim frontend/web/static/js/offline/offlineManager.ts

# Retry commit
git commit -m "feat: add feature"

# Success! ✅
```

---

## Development Workflow

### Daily Development

**1. Edit TypeScript Files (.ts)**

```bash
# Always edit .ts files, NOT .js files
vim frontend/web/static/js/offline/offlineManager.ts
```

**Important:**
- ✅ Edit `.ts` files
- ❌ Do NOT edit `.js` files (they're for production)

**2. Type Check (Optional)**

```bash
# Check types manually (optional)
npm run type-check

# Watch mode (auto-check on save)
npm run type-check:watch
```

**3. Build (Compiles .ts → .js)**

```bash
# Vite compiles TypeScript automatically
npm run build
```

**4. Commit (Automatic Type-Check)**

```bash
git add .
git commit -m "feat: add feature"

# Pre-commit hook runs type-check automatically
# If errors → commit BLOCKED
# If success → commit proceeds
```

### Testing Workflow

```bash
# 1. Type check
npm run type-check

# 2. Build
npm run build

# 3. Run tests
pytest backend/tests/

# 4. Manual testing
uvicorn backend.app.main:app --reload
```

---

## Common Patterns

### Type Assertions

When you know the type better than TypeScript:

```typescript
// ✅ CORRECT: Type assertion with explanation
const data = JSON.parse(response) as ApiResponse<BudgetFact[]>;

// ❌ WRONG: Using 'any'
const data: any = JSON.parse(response);
```

### Null Checks

Strict null checks enabled - always check for null/undefined:

```typescript
// ✅ CORRECT: Null check before access
if (user && user.email) {
    sendEmail(user.email);
}

// ❌ WRONG: No null check (TypeScript error)
sendEmail(user.email);  // Error: user might be undefined
```

### Optional Chaining

Use optional chaining for nested properties:

```typescript
// ✅ CORRECT: Optional chaining
const email = user?.profile?.email;

// ❌ WRONG: Multiple null checks
const email = user && user.profile && user.profile.email;
```

### Type Guards

Create type guards for runtime type checking:

```typescript
// Type guard function
function isBudgetFact(obj: unknown): obj is BudgetFact {
    return (
        typeof obj === 'object' &&
        obj !== null &&
        'id' in obj &&
        'amount' in obj &&
        'record_type' in obj
    );
}

// Usage
if (isBudgetFact(data)) {
    // TypeScript knows data is BudgetFact here
    console.log(data.amount);
}
```

---

## Type Error Resolution

### Common Errors and Fixes

#### 1. Implicit 'any' Type

**Error:**
```
error TS7006: Parameter 'item' implicitly has an 'any' type.
```

**Fix:**
```typescript
// ❌ Before
function processItem(item) {
    return item.id;
}

// ✅ After
function processItem(item: BudgetFact) {
    return item.id;
}
```

#### 2. Property Does Not Exist

**Error:**
```
error TS2339: Property 'email' does not exist on type 'User'.
```

**Fix:**
```typescript
// Check type definition file (types/models.d.ts)
interface User {
    id: number;
    email?: string;  // Optional property
}

// Add null check
if (user.email) {
    sendEmail(user.email);
}
```

#### 3. Type 'null' is Not Assignable

**Error:**
```
error TS2322: Type 'null' is not assignable to type 'string'.
```

**Fix:**
```typescript
// ❌ Before
let name: string = null;

// ✅ After
let name: string | null = null;

// Or use optional
let name?: string;
```

#### 4. Cannot Find Module

**Error:**
```
error TS2307: Cannot find module '@web/lists/listsManager'.
```

**Fix:**
```typescript
// Check tsconfig.json paths configuration
"paths": {
  "@web/*": ["frontend/web/static/js/*"]
}

// Verify file exists
ls frontend/web/static/js/lists/listsManager.ts
```

---

## Migration Guidelines

### When to Migrate a Module

**Migrate when:**
- ✅ Module is actively developed
- ✅ Module has complex logic (easy to introduce bugs)
- ✅ Module has many dependencies
- ✅ You're refactoring anyway

**Don't migrate when:**
- ❌ Module is stable and rarely changed
- ❌ Module is simple (< 100 lines)
- ❌ Module is scheduled for removal

### Migration Steps

**1. Rename .js → .ts**
```bash
git mv frontend/web/static/js/offline/offlineManager.js \
       frontend/web/static/js/offline/offlineManager.ts
```

**2. Add Type Annotations**
```typescript
// Add function parameter types
function processData(data: BudgetFact[]): void {
    // ...
}

// Add variable types
const total: number = calculateTotal(facts);
```

**3. Fix Type Errors**
```bash
npm run type-check

# Fix errors one by one
# Target: 0 errors for critical modules
```

**4. Update Imports (if needed)**
```typescript
// Update imports to use .ts extension in Vite
import { someFunction } from './utils';  // Vite handles this
```

**5. Test Thoroughly**
```bash
# Type check
npm run type-check

# Build
npm run build

# Run tests
pytest

# Manual testing
```

**6. Commit**
```bash
git add .
git commit -m "feat: migrate offlineManager to TypeScript

- Add type annotations
- Fix all TypeScript errors (0 errors)
- Add to types/global.d.ts"
```

---

## Performance Impact

### Build Time

**Before TypeScript (v7.0.0):**
- Build time: 13-17 seconds (Vite only)

**After TypeScript (v7.1.0):**
- Build time: 13-17 seconds (same, Vite compiles TS efficiently)
- Type check time: +3-7 seconds (only on commit)

**Total Impact:** Minimal - type-check runs in parallel with development

### Runtime

**Zero runtime impact:**
- TypeScript is compile-time only
- Production uses same .js files
- No TypeScript runtime library needed
- Bundle size unchanged

---

## Troubleshooting

### Pre-commit Hook Fails

**Problem:** Hook can't find npm

**Fix:**
```bash
# Ensure npm in PATH
which npm

# Reinstall Husky
npm install
npx husky install
```

### Type Check Takes Too Long

**Problem:** Type-check > 10 seconds

**Fix:**
```bash
# Use incremental mode (tsconfig.json)
"incremental": true,
"tsBuildInfoFile": ".tsbuildinfo"

# Or skip type-check temporarily
git commit --no-verify -m "WIP: skip type-check"
```

### IDE Shows Different Errors

**Problem:** IDE shows errors, but type-check passes

**Fix:**
```bash
# Restart TypeScript server in IDE
# VS Code: Cmd+Shift+P → "TypeScript: Restart TS Server"

# Or reload IDE
```

---

## Future Improvements

### Phase 5: Remaining Modules

**Candidates for migration:**
- Service Worker
- Web Workers
- Admin panel scripts
- Legacy jQuery code

**Estimated:** 5,000+ additional lines

### Enhanced Type Coverage

**Improvements:**
- Reduce 473 errors to < 100
- Add stricter type checks
- Generate types from OpenAPI schema
- Add runtime validation (zod, io-ts)

### Tooling

**Potential additions:**
- `ts-node` for backend TypeScript
- `ts-jest` for TypeScript testing
- `eslint-plugin-typescript` for linting
- `type-coverage` for metrics

---

## Related Documentation

- `/docs/architecture/build-system.md` - Vite + TypeScript build configuration
- `/docs/architecture/es-modules-migration.md` - ES Modules migration (v7.0.0)
- `/CLAUDE.md` - TypeScript development workflow

---

## References

- [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/intro.html)
- [TypeScript Strict Mode](https://www.typescriptlang.org/tsconfig#strict)
- [Vite TypeScript Support](https://vitejs.dev/guide/features.html#typescript)
- [Husky Git Hooks](https://typicode.github.io/husky/)
