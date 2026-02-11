# TODO: Remaining Unit Tests

**Status:** PHASE 6.3 (Partial Complete)
**Date:** 2026-02-10
**Priority:** P2 (Can be implemented incrementally)

## Completed Tests ✅

- [x] `tableFormatters.test.ts` - **184 lines, 60 test cases**
  - XSS protection tests (critical security)
  - Color mapping tests
  - Amount formatting tests
  - Text truncation tests
  - Date formatting tests

## Remaining Tests (TODO)

### 1. tableRenderer.test.ts

**Priority:** P1
**Estimated effort:** 2 hours
**Description:** Test TableRenderer component

```typescript
describe('TableRenderer', () => {
  describe('renderDesktopTable', () => {
    it('renders table with custom columns');
    it('escapes HTML in column headers');
    it('renders empty tbody when data is empty');
    it('applies DaisyUI table classes');
    it('handles hidden on mobile (md:block)');
  });

  describe('renderMobileCard', () => {
    it('renders mobile cards with custom fields');
    it('applies DaisyUI card classes');
    it('handles hidden on desktop (block md:hidden)');
  });

  describe('renderEmptyState', () => {
    it('renders icon, title, and subtitle');
    it('escapes HTML in title and subtitle');
    it('omits subtitle when not provided');
  });
});
```

**Why important:**
- TableRenderer generates HTML strings (XSS risk)
- Used across Dashboard, Facts, Plans pages
- Critical for responsive design

---

### 2. paginationManager.test.ts

**Priority:** P2
**Estimated effort:** 1 hour
**Description:** Test PaginationManager state management

```typescript
describe('PaginationManager', () => {
  describe('constructor', () => {
    it('initializes with default pageSize=20');
    it('initializes with custom pageSize');
  });

  describe('getTotalPages', () => {
    it('calculates total pages correctly');
    it('rounds up for partial pages');
    it('returns 0 when totalRecords=0');
  });

  describe('getOffset', () => {
    it('calculates offset for currentPage');
    it('returns 0 for first page');
  });

  describe('nextPage', () => {
    it('increments currentPage when within bounds');
    it('returns false when at last page');
  });

  describe('previousPage', () => {
    it('decrements currentPage when within bounds');
    it('returns false when at first page');
  });

  describe('setPage', () => {
    it('sets currentPage to valid index');
    it('clamps to valid range');
  });

  describe('setState', () => {
    it('updates totalRecords and recalculates pages');
  });
});
```

**Why important:**
- Used in Facts and Plans pages (50 items/page)
- Pagination logic must be accurate (off-by-one errors common)

---

### 3. selectionManager.test.ts

**Priority:** P2
**Estimated effort:** 1 hour
**Description:** Test SelectionManager for batch operations

```typescript
describe('SelectionManager', () => {
  describe('toggleSelection', () => {
    it('adds id when not selected');
    it('removes id when already selected');
  });

  describe('selectAll', () => {
    it('selects all provided ids');
    it('handles empty array');
  });

  describe('clearSelection', () => {
    it('removes all selected ids');
  });

  describe('getSelectedIds', () => {
    it('returns array of selected ids');
    it('returns empty array when none selected');
  });

  describe('getSelectionCount', () => {
    it('returns count of selected items');
  });

  describe('isSelected', () => {
    it('returns true for selected id');
    it('returns false for unselected id');
  });
});
```

**Why important:**
- Used for batch delete operations
- Set-based logic (duplicates, order independence)
- Critical for data integrity (don't delete wrong records)

---

### 4. htmlSanitizer.test.ts

**Priority:** P1 (Security Critical)
**Estimated effort:** 1 hour
**Description:** Test XSS protection in escapeHtml

```typescript
describe('escapeHtml', () => {
  describe('XSS protection', () => {
    it('escapes <script> tags');
    it('escapes HTML entities (&, <, >, ", \')');
    it('escapes event handlers (onclick, onload, onerror)');
    it('prevents javascript: URLs');
    it('escapes data: URLs');
    it('handles nested HTML tags');
    it('escapes Unicode characters');
    it('handles double encoding attempts');
  });

  describe('edge cases', () => {
    it('returns empty string for null');
    it('returns empty string for undefined');
    it('preserves newlines');
    it('preserves whitespace');
  });
});
```

**Why important:**
- Core security function (prevents XSS)
- Used by TableFormatters.truncateText and TableRenderer
- Must be bulletproof against all XSS vectors

---

## Integration Tests (E2E)

**Note:** E2E tests already exist and cover XSS protection:

```
tests/e2e/webapp/test_form_submission.spec.ts
  ✅ "Recent transactions XSS protection"
  ✅ Form input validation with malicious payloads
```

---

## Running Tests

When tests are implemented, run with:

```bash
# All tests
npm test

# Specific file
npm test tableFormatters.test.ts

# Watch mode
npm test -- --watch

# Coverage report
npm test -- --coverage
```

---

## Test Framework Setup

**Required dependencies:**

```json
{
  "devDependencies": {
    "@types/jest": "^29.5.0",
    "jest": "^29.5.0",
    "ts-jest": "^29.1.0"
  }
}
```

**Jest configuration (jest.config.js):**

```javascript
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  roots: ['<rootDir>/frontend/web/static/js'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  collectCoverageFrom: [
    'frontend/web/static/js/shared/*.ts',
    '!**/__tests__/**',
    '!**/node_modules/**'
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  }
};
```

---

## Coverage Goals

| File | Target Coverage | Priority |
|------|----------------|----------|
| tableFormatters.ts | ✅ 100% | P1 (Critical) |
| htmlSanitizer.ts | 100% | P1 (Security) |
| tableRenderer.ts | 90% | P1 |
| paginationManager.ts | 85% | P2 |
| selectionManager.ts | 85% | P2 |

**Current:** 1/5 files tested (20%)
**Goal:** 5/5 files tested (100%) with >85% coverage

---

## Timeline

| Task | Estimated | When |
|------|-----------|------|
| TableRenderer tests | 2 hours | Week 1 |
| HtmlSanitizer tests | 1 hour | Week 1 |
| PaginationManager tests | 1 hour | Week 2 |
| SelectionManager tests | 1 hour | Week 2 |
| CI/CD integration | 30 min | Week 2 |

**Total effort:** 5.5 hours

---

**References:**
- Jest documentation: https://jestjs.io/docs/getting-started
- Testing Library: https://testing-library.com/docs/dom-testing-library/intro
- OWASP XSS Prevention: https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html

**Author:** ikeniborn + Claude
**Last Updated:** 2026-02-10
