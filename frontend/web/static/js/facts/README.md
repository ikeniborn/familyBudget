# Facts Manager Module

TypeScript ES Modules для управления фактами (транзакциями).

**Status:** Phase 1 Complete (Partial Integration)
**Bundle:** `facts.min.js` (14 KB, gzip: 2.89 KB)
**Global:** `window.FactsManager`

## Architecture

```
frontend/web/static/js/facts/
├── types/           # TypeScript interfaces and type definitions
├── core/            # State management (singleton pattern)
├── operations/      # Business logic (filter, pagination, selection)
├── integration/     # API clients (facts, dropdowns, analytics)
├── rendering/       # Client-side rendering (temporary - Phase 2 will replace)
├── adapters/        # Window exports for onclick compatibility
└── index.ts         # Barrel export and auto-initialization
```

## Features

### State Management
- **FactsState**: Centralized state (filters, pagination, selection, cache)
- **stateManager**: 40+ getter/setter functions
- Singleton pattern with type-safe access

### Operations
- **Filter Operations**: Build queries, validate, count active filters
- **Pagination Operations**: Navigation, calculations, UI updates
- **Selection Operations**: Multi-select, batch operations, UI sync

### API Integration
- **Facts API**: CRUD operations (load, create, update, delete, batch delete)
- **Dropdown API**: Load users, articles, financial centers, cost centers
- **Analytics API**: Fact hints (plan/fact for current month)
- Offline support via `window.offlineManager`
- Parallel API calls optimization

### Rendering (Temporary - Phase 1)
- **Facts Table**: Desktop + mobile responsive rendering
- **Stats Widget**: Total count + page range display
- **Note:** Will be replaced by HTMX server-side rendering in Phase 2

## Usage

### Initialization

Auto-initializes on `DOMContentLoaded`:

```javascript
// Automatically called when facts.min.js loads
FactsManager.initialize();
```

### Window Exports (onclick compatibility)

Available globally for HTML onclick handlers:

```javascript
// Filters
window.applyFilters()
window.resetFilters()
window.collapseFilters()

// Pagination
window.previousPage()
window.nextPage()

// Selection
window.toggleSelectAll(checkbox)
window.updateBatchDeleteButton()

// Placeholders (TODO in full integration)
window.batchDelete()
window.showEditModal(factId)
window.deleteFact(factId)
// ... and more
```

### API Usage

```typescript
import { loadFacts, createFact, updateFact, deleteFact } from './integration/factsAPI';
import { loadUsers, loadArticles } from './integration/dropdownAPI';
import { loadFactHints } from './integration/analyticsAPI';

// Load facts with current filters
const { facts, total } = await loadFacts();

// Create new fact
const newFact = await createFact({
    record_type: 'fact',
    fact_type: 'expense',
    amount: 1000,
    article_id: 123,
    financial_center_id: 1,
    cost_center_id: null,
    fact_date: '2026-01-19',
    description: 'Test fact'
});

// Load fact hints
const hints = await loadFactHints({
    fact_date: '2026-01-19',
    article_type: 'expense',
    article_id: 123,
    financial_center_id: 1
});
```

### State Access

```typescript
import { getFilters, updateFilters, getSelectedIds } from './core/stateManager';

// Get current filters
const filters = getFilters();

// Update filters
updateFilters({ article_type: 'expense' });

// Get selected fact IDs
const selectedIds = getSelectedIds();
```

## Build

```bash
# Development build
npm run build

# Production build
NODE_ENV=production npm run build

# Watch mode (auto-rebuild on changes)
npm run watch
```

Output: `frontend/web/static/js/facts.min.js`

## Integration Status

### ✅ Phase 1 Complete (Current)

- [x] TypeScript infrastructure (types, core, operations)
- [x] API integration (facts, dropdowns, analytics)
- [x] Client-side rendering (temporary)
- [x] Window exports adapter
- [x] Build configuration
- [x] Basic integration in facts.html

### 🔄 Phase 1 Continuation (TODO)

- [ ] Full CRUD integration (replace inline JavaScript)
- [ ] Modal operations (showEditModal, closeEditModal)
- [ ] Transfer operations (createTransfer)
- [ ] Cost center filtering (filterEditCostCenters)
- [ ] Fact hints integration (loadFactHints with UI update)
- [ ] Export functionality (exportFilteredFacts)

### 📋 Phase 2: HTMX Partials (Future)

- [ ] Backend HTMX endpoints (`/facts/table`, `/facts/stats`, `/facts/pagination`)
- [ ] Jinja2 macros (`fact_row_desktop`, `fact_row_mobile`)
- [ ] Replace client-side rendering with server-side
- [ ] Remove `rendering/` modules

### 🔌 Phase 3: WebSocket Integration (Future)

- [ ] Register WebSocket handlers (`fact_created`, `fact_updated`, `fact_deleted`)
- [ ] Real-time table updates
- [ ] Multi-tab synchronization
- [ ] Debounced updates

### 🧹 Phase 4: Cleanup & Optimization (Future)

- [ ] Remove all inline JavaScript from facts.html
- [ ] Replace onclick with event delegation
- [ ] Enable TypeScript strict mode
- [ ] Bundle size optimization (<50KB)

## File Structure

```
facts/
├── types/
│   ├── models.ts (200 lines)       # Domain models, interfaces
│   ├── dependencies.ts (160 lines) # External dependencies
│   └── globals.d.ts (60 lines)     # Window namespace
├── core/
│   ├── FactsState.ts (185 lines)   # Centralized state
│   └── stateManager.ts (390 lines) # State operations
├── operations/
│   ├── filterOperations.ts (290 lines)    # Filter logic
│   ├── paginationOperations.ts (140 lines)# Pagination
│   └── selectionOperations.ts (175 lines) # Selection
├── integration/
│   ├── factsAPI.ts (260 lines)      # CRUD API
│   ├── dropdownAPI.ts (230 lines)   # Dropdowns API
│   └── analyticsAPI.ts (105 lines)  # Analytics API
├── rendering/
│   ├── factsTable.ts (190 lines)    # Table rendering
│   └── statsRenderer.ts (40 lines)  # Stats rendering
├── adapters/
│   └── windowExports.ts (175 lines) # Window exports
└── index.ts (85 lines)              # Barrel export
```

**Total:** 15 files, 2,791 lines

## Dependencies

### External

- `BudgetShared.DateFormatter` - Date formatting utilities
- `BudgetShared.MoneyFormatter` - Money formatting utilities
- `window.offlineManager` - Offline support (optional)
- `window.budgetWSManager` - WebSocket manager (optional)
- `htmx` - HTMX library (Phase 2)

### Internal

- `admin-facts-common.js` - Shared admin utilities
- `transfers.min.js` - Transfers module
- `confirm-dialog.min.js` - Confirmation dialogs

## Type Safety

All modules use TypeScript with full type coverage:

```bash
npm run type-check
# Expected: "Found 0 errors"
```

## Testing

```bash
# Run all tests
npm test

# Type check
npm run type-check

# Lint
npm run lint
```

## Migration Path (Gradual)

### Current (Phase 1 - Hybrid)

- ✅ facts.min.js loads and initializes
- ✅ Window exports available for onclick
- ⚠️ Inline JavaScript still active (backward compatibility)

### Next (Full Integration)

1. Replace inline functions with FactsManager calls
2. Remove duplicate code from facts.html
3. Migrate to event delegation (remove onclick)

### Future (Phase 2+)

1. HTMX server-side rendering
2. WebSocket real-time updates
3. Complete removal of inline JavaScript

## Performance

- **Bundle size:** 14 KB minified, 2.89 KB gzipped
- **Load time:** <100ms (cached)
- **Type-safe:** 100% TypeScript coverage
- **Tree-shaking:** Enabled via Vite

## Related Documentation

- [Architecture Plan](../../../../../docs/architecture/facts-decomposition-plan.md) (if exists)
- [API Endpoints](../../../../../docs/architecture/endpoints/facts.md) (if exists)
- [Build System](../../../../../docs/architecture/build-system.md)

## Changelog

### Phase 1 (2026-01-19)

- Initial TypeScript module structure
- State management (filters, pagination, selection)
- API integration (CRUD, dropdowns, analytics)
- Client-side rendering (temporary)
- Window exports adapter
- Build configuration
- Basic integration in facts.html

**Commits:** 5
**Files:** 15
**Lines:** 2,791
