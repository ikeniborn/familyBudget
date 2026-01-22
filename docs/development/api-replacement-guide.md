# API Replacement Developer Guide

**Version:** 1.0
**Date:** 2026-01-22
**Audience:** Frontend developers working with DataLayer and PGlite

---

## Quick Start

### Adding a New DataLayer Method

**Step 1:** Define the method signature in `DataLayer.ts`
```typescript
async getMyData(filters?: MyFilters): Promise<LocalMyData[]> {
  const startTime = performance.now();

  try {
    // PGlite-first
    if (isPGliteEnabled() && this.pglite.isReady()) {
      const result = await this.pglite.queryMyData(filters);
      performanceMonitor.trackPGliteCall('getMyData', performance.now() - startTime);
      return result;
    }

    // Fallback to API
    const result = await this.getMyDataFromAPI(filters);
    performanceMonitor.trackAPICall('getMyData', performance.now() - startTime);
    return result;
  } catch (error) {
    // Error fallback to API
    if (isPGliteEnabled()) {
      const result = await this.getMyDataFromAPI(filters);
      performanceMonitor.trackAPICall('getMyData', performance.now() - startTime);
      return result;
    }
    throw error;
  }
}
```

**Step 2:** Implement private API fallback method
```typescript
private async getMyDataFromAPI(filters?: MyFilters): Promise<LocalMyData[]> {
  const params = new URLSearchParams();
  if (filters?.field1) params.append('field1', String(filters.field1));

  const response = await fetch(`/api/v1/my-data?${params}`, {
    credentials: 'include'
  });

  if (!response.ok) {
    throw new Error(`Failed to load my data: ${response.status}`);
  }

  const data = await response.json();
  return data.map(convertToLocalMyData);
}
```

**Step 3:** Add type converter (if needed)
```typescript
function convertToLocalMyData(serverData: ServerMyData): LocalMyData {
  return {
    id: serverData.id,
    temp_id: serverData.temp_id,
    field1: serverData.field1,
    // ... other fields
  };
}
```

---

## DataLayer API Reference

### Pattern 1: Read-Only Reference Data

**Use Case:** Static data that rarely changes (articles, financial centers, cost centers).

**Example:**
```typescript
async getArticles(): Promise<LocalArticle[]> {
  const startTime = performance.now();

  try {
    if (isPGliteEnabled() && this.pglite.isReady()) {
      const result = await this.pglite.queryArticles();
      performanceMonitor.trackPGliteCall('getArticles', performance.now() - startTime);
      return result;
    }

    const result = await this.getArticlesFromAPI();
    performanceMonitor.trackAPICall('getArticles', performance.now() - startTime);
    return result;
  } catch (error) {
    if (isPGliteEnabled()) {
      const result = await this.getArticlesFromAPI();
      performanceMonitor.trackAPICall('getArticles', performance.now() - startTime);
      return result;
    }
    throw error;
  }
}
```

**Key Points:**
- No filters (returns all data)
- Cached in PGlite after initial sync
- API fallback for errors

---

### Pattern 2: Read with Filters

**Use Case:** Transactional data with client-side filtering (shopping lists, facts).

**Example:**
```typescript
async getShoppingLists(filters?: ShoppingListFilters): Promise<LocalShoppingList[]> {
  const startTime = performance.now();

  try {
    if (isPGliteEnabled() && this.pglite.isReady()) {
      const result = await this.pglite.queryShoppingLists(filters);
      performanceMonitor.trackPGliteCall('getShoppingLists', performance.now() - startTime);
      return result;
    }

    const result = await this.getShoppingListsFromAPI(filters);
    performanceMonitor.trackAPICall('getShoppingLists', performance.now() - startTime);
    return result;
  } catch (error) {
    if (isPGliteEnabled()) {
      const result = await this.getShoppingListsFromAPI(filters);
      performanceMonitor.trackAPICall('getShoppingLists', performance.now() - startTime);
      return result;
    }
    throw error;
  }
}
```

**Key Points:**
- Filters passed to PGlite query
- Server filters converted to client-side WHERE clauses
- API fallback includes filters in query params

---

### Pattern 3: Count Queries

**Use Case:** Get row count for pagination.

**Example:**
```typescript
async getFactsCount(filters: FactFilters): Promise<number> {
  const startTime = performance.now();

  try {
    if (isPGliteEnabled() && this.pglite.isReady()) {
      const result = await this.pglite.getFactsCount(filters);
      performanceMonitor.trackPGliteCall('getFactsCount', performance.now() - startTime);
      return result;
    }

    const result = await this.getFactsCountFromAPI(filters);
    performanceMonitor.trackAPICall('getFactsCount', performance.now() - startTime);
    return result;
  } catch (error) {
    if (isPGliteEnabled()) {
      const result = await this.getFactsCountFromAPI(filters);
      performanceMonitor.trackAPICall('getFactsCount', performance.now() - startTime);
      return result;
    }
    throw error;
  }
}
```

**Key Points:**
- Returns number (not array)
- Uses `COUNT(*)` in PGlite
- API fallback to `/count` endpoint

---

## Performance Tracking

### Tracking Method Calls

**Automatic Tracking:**
```typescript
performanceMonitor.trackPGliteCall('methodName', durationMs);
performanceMonitor.trackAPICall('methodName', durationMs);
```

**Module Classification:**
The PerformanceMonitor automatically classifies methods by module:
- **shoppingLists:** Methods containing "shopping", "store", "productgroup"
- **facts:** Methods containing "fact", "transfer"
- **recurringPlans:** Methods containing "recurring", "plan"
- **dashboard:** Methods containing "dashboard", "quickstat", "balance"
- **other:** Everything else

**Example:**
```typescript
// This will be classified as "shoppingLists"
performanceMonitor.trackPGliteCall('getShoppingLists', 15.2);

// This will be classified as "facts"
performanceMonitor.trackPGliteCall('getFacts', 23.8);
```

### Getting Performance Stats

**Basic Stats:**
```typescript
const stats = performanceMonitor.getStats();
console.log(`API reduction: ${stats.reductionPercent}%`);
console.log(`Speedup: ${stats.speedupFactor}×`);
```

**Detailed Stats with Breakdown:**
```typescript
const detailedStats = performanceMonitor.getDetailedStats();
console.log(`Shopping Lists: ${detailedStats.breakdown.shoppingLists.reductionPercent}%`);
console.log(`Facts: ${detailedStats.breakdown.facts.reductionPercent}%`);
console.log(`Bandwidth saved: ${detailedStats.totalBandwidthSaved} KB`);
```

**Per-Method Stats:**
```typescript
const methodStats = performanceMonitor.getMethodStats();
console.log(methodStats['getShoppingLists']); // { api: {...}, pglite: {...} }
```

---

## Error Handling

### Error Fallback Pattern

**Always implement 3-tier error handling:**
1. Try PGlite
2. On PGlite error, fallback to API
3. On API error, throw

```typescript
try {
  // Tier 1: PGlite
  if (isPGliteEnabled() && this.pglite.isReady()) {
    return await this.pglite.queryData();
  }

  // Tier 2: API fallback (PGlite not ready)
  return await this.getDataFromAPI();
} catch (error) {
  // Tier 3: Error fallback to API
  if (isPGliteEnabled()) {
    return await this.getDataFromAPI();
  }
  throw error; // Re-throw if API also fails
}
```

### Common Error Scenarios

**PGlite not initialized:**
```typescript
if (!this.pglite.isReady()) {
  // Falls through to API fallback
}
```

**PGlite query error:**
```typescript
try {
  return await this.pglite.queryData();
} catch (error) {
  // Logged automatically, falls to API fallback
}
```

**API error:**
```typescript
const response = await fetch('/api/v1/data');
if (!response.ok) {
  throw new Error(`API error: ${response.status}`);
}
```

---

## Testing Strategies

### Unit Tests

**Test PGlite-first logic:**
```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { dataLayer } from './DataLayer';
import { performanceMonitor } from '../monitoring/PerformanceMonitor';

describe('DataLayer - getShoppingLists', () => {
  beforeEach(() => {
    performanceMonitor.reset();
  });

  it('should use PGlite when available', async () => {
    // Act
    const lists = await dataLayer.getShoppingLists({ is_active: true });

    // Assert
    expect(lists).toBeDefined();
    const stats = performanceMonitor.getStats();
    expect(stats.pglite.count).toBeGreaterThan(0);
    expect(stats.api.count).toBe(0);
  });

  it('should fallback to API when PGlite not ready', async () => {
    // Arrange: Mock PGlite as not ready
    const pglite = getPGliteManager();
    const originalIsReady = pglite.isReady;
    pglite.isReady = () => false;

    // Act
    const lists = await dataLayer.getShoppingLists({ is_active: true });

    // Assert
    expect(lists).toBeDefined();
    const stats = performanceMonitor.getStats();
    expect(stats.api.count).toBeGreaterThan(0);

    // Cleanup
    pglite.isReady = originalIsReady;
  });
});
```

### Integration Tests

**Test full workflow:**
```typescript
describe('Shopping Lists Workflow', () => {
  it('should achieve 80%+ API reduction', async () => {
    // Simulate user session
    await dataLayer.getShoppingLists({ is_active: true });
    await dataLayer.getStores();
    await dataLayer.getProductGroups();

    const stats = performanceMonitor.getStats();
    expect(stats.reductionPercent).toBeGreaterThanOrEqual(80);
  });
});
```

### Manual Testing

**Use PGlite Diagnostic Modal:**
1. Open modal (click PGlite icon)
2. Check "API Calls Reduction" section
3. Verify module breakdown
4. Check bandwidth saved

---

## Adding New PGlite Methods

### Step 1: Add PGliteManager Method

**In `PGliteManager.ts`:**
```typescript
async queryMyData(filters?: MyFilters): Promise<LocalMyData[]> {
  if (!this.db) {
    throw new Error('PGlite not initialized');
  }

  return await queryMyData(this.db, filters);
}
```

### Step 2: Implement Operation File

**Create `operations/myDataOperations.ts`:**
```typescript
import type { PGlite } from '@electric-sql/pglite';
import type { LocalMyData, MyFilters } from '../types/models';

export async function queryMyData(
  db: PGlite,
  filters?: MyFilters
): Promise<LocalMyData[]> {
  // Build WHERE clause
  const conditions: string[] = [];
  const params: any[] = [];

  if (filters?.field1) {
    conditions.push('field1 = $' + (params.length + 1));
    params.push(filters.field1);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // Execute query
  const result = await db.query(
    `SELECT * FROM local_my_data ${whereClause} ORDER BY created_at DESC`,
    params
  );

  return result.rows.map(row => ({
    id: row.id,
    temp_id: row.temp_id,
    field1: row.field1,
    // ... other fields
    created_at: new Date(row.created_at),
    updated_at: new Date(row.updated_at)
  }));
}
```

### Step 3: Export from PGliteManager

**In `PGliteManager.ts`:**
```typescript
import { queryMyData } from './operations/myDataOperations';

// ... in class

async queryMyData(filters?: MyFilters): Promise<LocalMyData[]> {
  if (!this.db) throw new Error('PGlite not initialized');
  return await queryMyData(this.db, filters);
}
```

---

## Best Practices

### 1. Always Track Performance
```typescript
const startTime = performance.now();
// ... operation
performanceMonitor.trackPGliteCall('method', performance.now() - startTime);
```

### 2. Use Type-Safe Interfaces
```typescript
// ✅ Good
async getShoppingLists(filters?: ShoppingListFilters): Promise<LocalShoppingList[]>

// ❌ Bad
async getShoppingLists(filters?: any): Promise<any>
```

### 3. Implement Graceful Fallback
```typescript
// ✅ Good
try {
  if (isPGliteEnabled() && this.pglite.isReady()) {
    return await this.pglite.queryData();
  }
  return await this.getDataFromAPI();
} catch (error) {
  if (isPGliteEnabled()) {
    return await this.getDataFromAPI();
  }
  throw error;
}

// ❌ Bad
return await this.pglite.queryData(); // No fallback!
```

### 4. Reset Performance Metrics in Tests
```typescript
beforeEach(() => {
  performanceMonitor.reset();
});
```

### 5. Validate Reduction Targets
```typescript
const stats = performanceMonitor.getStats();
expect(stats.reductionPercent).toBeGreaterThanOrEqual(80);
```

---

## Debugging

### Enable Debug Logging

**In browser console:**
```javascript
localStorage.setItem('DEBUG_DATA_LAYER', 'true');
location.reload();
```

**Output:**
```
[DATA_LAYER] getShoppingLists: 15.2ms (PGlite)
[DATA_LAYER] getFacts: 23.8ms (PGlite)
[PGLITE_PERF] API reduction: 92.3%
```

### Check PGlite Status

```javascript
const pglite = getPGliteManager();
console.log('PGlite ready:', pglite.isReady());
console.log('Diagnostic data:', await pglite.getDiagnosticData());
```

### Inspect Performance Metrics

```javascript
const stats = performanceMonitor.getDetailedStats();
console.table(stats.breakdown);
```

---

## Common Pitfalls

### ❌ Pitfall 1: Not Checking PGlite Readiness
```typescript
// Bad: Crashes if PGlite not ready
return await this.pglite.queryData();

// Good: Check first
if (isPGliteEnabled() && this.pglite.isReady()) {
  return await this.pglite.queryData();
}
```

### ❌ Pitfall 2: Missing Performance Tracking
```typescript
// Bad: No tracking
return await this.pglite.queryData();

// Good: Track all calls
const startTime = performance.now();
const result = await this.pglite.queryData();
performanceMonitor.trackPGliteCall('method', performance.now() - startTime);
return result;
```

### ❌ Pitfall 3: No API Fallback on Error
```typescript
// Bad: Throws on PGlite error
return await this.pglite.queryData();

// Good: Fallback to API
try {
  return await this.pglite.queryData();
} catch (error) {
  return await this.getDataFromAPI();
}
```

### ❌ Pitfall 4: Hardcoded Method Names
```typescript
// Bad: Hardcoded string
performanceMonitor.trackPGliteCall('getShoppingLists', duration);

// Good: Use variable (easier to refactor)
const methodName = 'getShoppingLists';
performanceMonitor.trackPGliteCall(methodName, duration);
```

---

## Related Documentation

- [API Replacement Architecture](../architecture/api-replacement.md)
- [PGlite Integration Guide](../architecture/pglite-integration.md)
- [Testing Checklist](../testing/task-015-validation.md)
- [Performance Optimization](../architecture/performance-optimization.md)

---

**Last Updated:** 2026-01-22
**Maintainer:** Development Team
**Questions:** See [CLAUDE.md](../../CLAUDE.md)
