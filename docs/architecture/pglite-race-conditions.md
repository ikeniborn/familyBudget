# PGlite Race Conditions - Resolution Strategy

## Problem Statement

PGlite инициализация асинхронная. Компоненты, которые зависят от данных PGlite, могут загружаться ДО завершения инициализации, что приводит к пустым datasets.

## Affected Components

1. **Modal Fact** - Загрузка financial centers при открытии формы создания транзакции
2. **Modal Plan** - Загрузка financial centers при открытии формы создания плана
3. **Category Loader** - Общая утилита для загрузки справочников

## Root Cause

**Sequence of Events:**
```
Page Load
├─ Dashboard init() → PGlite.init() starts (ASYNC)
├─ WebSocket connects
├─ WebSocket requests sync_initial
│
├─ User clicks "Add Transaction" ← CAN HAPPEN BEFORE sync_initial!
│  └─ openModalFact()
│     └─ loadFinancialCenters()
│        └─ dataLayer.getFinancialCenters()
│           └─ pglite.isReady() = false ❌
│              └─ Returns empty array []
│
└─ sync_initial arrives (too late)
   └─ bulkInsertFinancialCenters() ← Data loaded NOW
```

## Solution Architecture

### 1. PGlite Readiness Polling (DataLayer)

**Location:** `frontend/web/static/js/data/DataLayer.ts:198-235`

**Strategy:**
- Check if PGlite is ready
- If not ready, poll every 100ms for up to 5 seconds
- If timeout expires, fall back to REST API
- If ready during wait, proceed with PGlite query

**Code:**
```typescript
if (!pglite.isReady()) {
  const waitStartTime = Date.now();
  const MAX_WAIT_MS = 5000;

  while (!pglite.isReady() && (Date.now() - waitStartTime) < MAX_WAIT_MS) {
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  if (!pglite.isReady()) {
    // Timeout → Fallback to API
    return await this.getFinancialCentersFromAPI(includeGlobal);
  }
}
```

### 2. Retry Logic (Component Level)

**Location:** `frontend/web/static/js/dashboard/features/addTransaction/categoryLoader.ts:94-155`

**Strategy:**
- Attempt 1: Immediate load
- Attempt 2: +500ms delay (exponential backoff)
- Attempt 3: +1000ms delay (exponential backoff)
- After 3 attempts: Show error toast and exit

**Retry scenarios:**
| Scenario | Attempt 1 | Attempt 2 | Attempt 3 | Result |
|----------|-----------|-----------|-----------|--------|
| PGlite ready immediately | ✅ Success | - | - | Data loaded |
| PGlite ready after 2s | ⏳ Wait → ✅ Success | - | - | Data loaded |
| PGlite timeout, API succeeds | ⏳ Timeout → ✅ API | - | - | Data loaded from API |
| Complete failure | ❌ Empty | ❌ Empty | ❌ Empty | Error toast |

### 3. Fallback Strategy

**Priority order:**
1. **PGlite (with readiness wait)** - Fastest, offline-capable
2. **REST API** - Reliable fallback when PGlite unavailable
3. **Error toast** - User notification after all retries exhausted

## Testing Race Conditions

### Test 1: Immediate modal open (reproduce race condition)
```
1. Open dashboard
2. IMMEDIATELY click "Add Transaction" (< 1 second after page load)
3. Expected: Modal opens, retry logic kicks in, data loads within 1-2 seconds
4. Check console: Should see "Attempt 1/3", "Attempt 2/3", then success
```

### Test 2: Slow network (3G throttling)
```
1. Chrome DevTools → Network → Slow 3G
2. Disable cache
3. Reload dashboard
4. Wait 2 seconds, then open modal
5. Expected: PGlite polling waits, then loads data successfully
6. Check console: "[DATA_LAYER] PGlite not ready, waiting..."
```

### Test 3: PGlite disabled
```
1. localStorage.setItem('pglite_enabled', 'false')
2. Reload dashboard
3. Open modal
4. Expected: Direct fallback to API, no retries needed
5. Check console: Should NOT see PGlite logs
```

### Test 4: Complete offline (PGlite cached)
```
1. Load dashboard online (cache PGlite data)
2. Disconnect network
3. Reload dashboard
4. Open modal
5. Expected: Data loads from cached PGlite immediately
```

## Monitoring

### Success Metrics
- **Financial center load success rate:** Should be > 99.5%
- **Retry rate:** < 5% of loads should require retry
- **API fallback rate:** < 1% of loads should fall back to API

### Logging Queries

Search application logs for:

```bash
# Count retry attempts
grep "loadFinancialCenters.*Attempt" logs/frontend.log | wc -l

# Count PGlite wait events
grep "PGlite not ready, waiting" logs/frontend.log | wc -l

# Count failures
grep "All retry attempts exhausted" logs/frontend.log | wc -l

# Success rate
grep "Successfully populated.*selects" logs/frontend.log | wc -l
```

## Future Improvements

- [ ] Global PGlite readiness event (`pglite:ready` custom event)
- [ ] Component suspension API (wait for PGlite before rendering modal)
- [ ] Service Worker preloading of PGlite WASM bundle
- [ ] IndexedDB warm cache for financial centers (pre-populate on login)
