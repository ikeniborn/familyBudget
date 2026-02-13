# Offline Mode для Family Budget PWA

## 🔄 Migration to Dexie.js Complete (v11.1.40)

**Migration Date**: 2026-02-03
**Status**: ✅ COMPLETE - PGlite Legacy Fully Removed
**Architecture**: Dexie.js IndexedDB + Service Worker

---

## 📦 Architecture Overview

### Dexie.js Structure (Replaces offlineManager/)

```
frontend/shared/db/dexie/
├── index.ts                      # Public API
├── DexieManager.ts               # Main manager class
├── core/
│   └── database.ts               # Database schema + cents conversion
├── operations/
│   ├── factOperations.ts         # CRUD for budget facts
│   ├── recurringOperations.ts    # CRUD for recurring plans
│   ├── transferOperations.ts     # CRUD for transfers
│   └── conflictResolution.ts     # Conflict resolution (LWW)
├── sync/
│   └── factSync.ts               # Background sync queue
└── utils/
    └── hash.ts                   # SHA-256 hashing for deduplication

frontend/web/static/js/offline/
├── networkDetector.js            # Network status detection
└── offlineShoppingManager.js     # Shopping list offline support
```

---

## 🎯 Key Features

### 1. **Offline-First Operations**
- Create/Update/Delete budget facts offline
- Automatic background sync when online
- Conflict resolution via Last-Write-Wins (LWW)

### 2. **Data Layer Integration**
- DataLayer automatically routes to Dexie when offline
- Fallback to API when online
- Transparent for application code

### 3. **Cents Conversion**
- All amounts stored in **cents** (integer) in IndexedDB
- Conversion via `toCents()` / `fromCents()` utilities
- Prevents floating-point precision errors

### 4. **Deduplication**
- SHA-256 content hashing for transfers
- Prevents duplicate submissions
- Backend validation

---

## 🚀 Usage

### Initialize Dexie (Automatic)

Dexie is **active by default** (v11.1.40+):

```typescript
import { isDexieActive } from '@db/dexie';

// Returns true by default
const isActive = isDexieActive();
```

### Create Offline Transaction

```typescript
import { dataLayer } from '@web/data/DataLayer';

// DataLayer automatically uses Dexie when offline
const fact = await dataLayer.createFact({
  record_type: 'expense',
  amount: 1500.50,        // Will be converted to cents: 150050
  article_id: 42,
  financial_center_id: 1,
  fact_date: '2026-02-03'
});

// Returns: { id: -1, _pending: true } if offline
```

### Check Pending Operations

```typescript
import { getDexieManager } from '@db/dexie';

const dexie = await getDexieManager();
const pendingOps = await dexie.getPendingOperations();

console.log(`${pendingOps.length} operations pending sync`);
```

### Manual Sync

```typescript
import { getDexieManager } from '@db/dexie';

const dexie = await getDexieManager();
const result = await dexie.syncPendingOperations();

console.log(`Synced ${result.successCount} operations`);
```

---

## 📝 Migration Notes (v11.0 → v11.1.40)

### Removed Components

**Deleted:**
- `frontend/web/static/js/offline/offlineManager/` (21 files)
- `frontend/web/static/js/offline/conflictResolver.ts`
- `frontend/web/static/js/utils/feature-flag-migration.js`
- `frontend/web/templates/scripts/offline-manager-init.html`

**Moved:**
- `offlineManager/utils/userHelpers.ts` → `frontend/shared/static/js/utils/userHelpers.ts`

### Templates Migration

**Updated files:**
- `plan.html` - Replaced `window.offlineManager` with direct fetch + Dexie sync
- `navbar-sync-badge.html` - Replaced `window.offlineManager.getAllUnsyncedItems()` with Dexie API
- `base.html` - Removed `offline-manager-init.html` include

### Configuration Updates

**Updated:**
- `build-all.js` - Removed offlineManager/conflictResolver build entries
- `eslint.config.js` - Removed `pglite` global
- `sw.js` - Renamed "PGlite Cleanup" → "Data Cleanup"
- `logging.js` - Renamed `PGLITE` module → `DEXIE`

---

## 🔍 Debugging

### Check Dexie Status

```typescript
import { getDexieManager, isDexieActive } from '@db/dexie';

console.log('Dexie Active:', isDexieActive());

const dexie = await getDexieManager();
const stats = await dexie.getStats();

console.log('Pending operations:', stats.pendingCount);
console.log('Total facts:', stats.factCount);
```

### View IndexedDB

1. Open Chrome DevTools → Application → Storage → IndexedDB
2. Find `family_budget_offline` database
3. Inspect tables: `pendingOperations`, `facts`, `recurring_plans`

### Enable Dexie Logging

```javascript
// In browser console
window.Logger.config.modules.DEXIE = true;
```

---

## 🛠️ Technical Details

### Database Schema (IndexedDB)

```typescript
{
  facts: '++temp_id, amount_cents, fact_date, article_id',
  pendingOperations: '++id, operation, status, retryCount',
  recurring_plans: '++temp_id, frequency',
  conflicts: '++id, fact_id, resolved_at'
}
```

### Cents Conversion

```typescript
import { toCents, fromCents } from '@db/dexie';

// Store in DB
const amountCents = toCents(15.99);  // 1599

// Display to user
const amountFloat = fromCents(1599);  // 15.99
```

### Background Sync

Service Worker triggers sync every 30 seconds (configurable):

```javascript
// sw.js
self.addEventListener('sync', async (event) => {
  if (event.tag === 'sync-dexie') {
    const dexie = await getDexieManager();
    await dexie.syncPendingOperations();
  }
});
```

---

## 📚 Related Documentation

- [Dexie Integration Guide](../../../docs/architecture/core/dexie-integration.md)
- [Offline Sync Flow](../../../docs/architecture/flows/offline-sync.yaml)
- [PWA Architecture](../../../docs/architecture/core/pwa.md)

---

**Last Updated:** 2026-02-03
**Version:** v11.1.40
