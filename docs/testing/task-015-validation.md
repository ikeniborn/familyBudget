# Task-015: API Replacement - Manual Testing Checklist

**Version:** 1.0
**Date:** 2026-01-22
**Target:** 80%+ API reduction, 50% faster dashboard, Zero breaking changes

---

## Testing Environment

- [ ] PGlite enabled in browser settings
- [ ] Chrome DevTools Network tab open
- [ ] PGlite Diagnostic Modal accessible
- [ ] Test user account with existing data

---

## 1. Shopping Lists Module

### 1.1 Load Operations
- [ ] **Load shopping lists** - Navigate to Shopping Lists page
  - ✓ Lists displayed correctly
  - ✓ No API calls for list loading (check Network tab)
  - ✓ PGlite query < 100ms (check Diagnostic Modal)

- [ ] **Load shopping list items** - Click on a shopping list
  - ✓ Items displayed correctly
  - ✓ No API calls for items loading
  - ✓ Completed items shown with strikethrough

- [ ] **Load stores** - Check store dropdown in item form
  - ✓ Stores loaded from PGlite
  - ✓ No API call to /api/v1/stores

- [ ] **Load product groups** - Check product group dropdown
  - ✓ Product groups loaded from PGlite
  - ✓ No API call to /api/v1/product-groups

### 1.2 Write Operations (Online)
- [ ] **Create item** - Add new item to shopping list
  - ✓ Item appears in UI immediately
  - ✓ Item has temp_id in PGlite
  - ✓ Sync icon visible (pending queue)
  - ✓ Item appears on server after sync

- [ ] **Update item** - Edit existing item
  - ✓ Changes visible in UI immediately
  - ✓ Updated in PGlite pending queue
  - ✓ Changes synced to server

- [ ] **Toggle completed** - Mark item as completed
  - ✓ Strikethrough applied immediately
  - ✓ is_completed updated in PGlite
  - ✓ Change synced to server

- [ ] **Delete item** - Delete item from list
  - ✓ Item removed from UI immediately
  - ✓ Soft delete in PGlite (sync_status = 'pending')
  - ✓ Deleted on server after sync

- [ ] **Bulk delete** - Select multiple items and delete
  - ✓ All items removed from UI
  - ✓ All deletions in pending queue
  - ✓ All deleted on server

### 1.3 Write Operations (Offline)
- [ ] **Create item offline** - Go offline (DevTools), add item
  - ✓ Item appears in UI with temp_id
  - ✓ Item in PGlite pending queue
  - ✓ After reconnection: item synced, assigned server ID

- [ ] **Update item offline** - Edit item while offline
  - ✓ Changes visible in UI
  - ✓ Update in pending queue
  - ✓ After reconnection: changes synced

- [ ] **Delete item offline** - Delete item while offline
  - ✓ Item removed from UI
  - ✓ Soft delete in pending queue
  - ✓ After reconnection: deleted on server

### 1.4 Search/Filter
- [ ] **Search by product name** - Type in search box
  - ✓ Results filtered client-side (no API call)
  - ✓ Instant filtering

- [ ] **Filter by store** - Select store filter
  - ✓ Items filtered client-side
  - ✓ No API call

- [ ] **Filter by product group** - Select product group
  - ✓ Items filtered client-side
  - ✓ No API call

---

## 2. Facts Module

### 2.1 Load Operations
- [ ] **Load facts** - Navigate to Facts page
  - ✓ Facts displayed in table
  - ✓ No API calls for facts loading
  - ✓ PGlite query < 100ms

- [ ] **Load facts count** - Check pagination
  - ✓ Total count displayed correctly
  - ✓ Count from PGlite (no API call)

- [ ] **Load with filters** - Apply date range filter
  - ✓ Facts filtered correctly
  - ✓ Filter applied client-side (no API call)

### 2.2 Write Operations (Online)
- [ ] **Create fact** - Add new transaction
  - ✓ Fact appears in UI immediately
  - ✓ Fact has temp_id in PGlite
  - ✓ Pending queue updated
  - ✓ Fact appears on server after sync

- [ ] **Update fact** - Edit existing fact
  - ✓ Changes visible in UI immediately
  - ✓ Update in pending queue
  - ✓ Changes synced to server

- [ ] **Delete fact** - Delete transaction
  - ✓ Fact removed from UI
  - ✓ Soft delete in PGlite
  - ✓ Deleted on server after sync

- [ ] **Batch delete** - Select multiple facts and delete
  - ✓ All facts removed from UI
  - ✓ All deletions in pending queue
  - ✓ All deleted on server

### 2.3 Write Operations (Offline)
- [ ] **Create fact offline** - Add fact while offline
  - ✓ Fact visible in UI with temp_id
  - ✓ In pending queue
  - ✓ After reconnection: synced to server

- [ ] **Update fact offline** - Edit fact while offline
  - ✓ Changes visible in UI
  - ✓ Update queued
  - ✓ After reconnection: synced

- [ ] **Delete fact offline** - Delete fact while offline
  - ✓ Fact removed from UI
  - ✓ Deletion queued
  - ✓ After reconnection: deleted on server

### 2.4 Filters
- [ ] **Date range filter** - Select custom date range
  - ✓ Facts filtered correctly
  - ✓ Client-side filtering (no API call)

- [ ] **Article filter** - Filter by category
  - ✓ Facts filtered correctly
  - ✓ No API call

- [ ] **Financial center filter** - Filter by account
  - ✓ Facts filtered correctly
  - ✓ No API call

---

## 3. Recurring Plans Module

### 3.1 Load Operations
- [ ] **Load recurring plans** - Navigate to Recurring Plans page
  - ✓ Plans displayed correctly
  - ✓ No API calls for loading (PGlite cache)
  - ✓ PGlite query < 100ms

- [ ] **Filter active plans** - Show only active plans
  - ✓ Filtered correctly
  - ✓ Client-side filter (no API call)

### 3.2 Write Operations
**Note:** Recurring Plans use API-only write operations (no offline queue)

- [ ] **Create plan** - Add new recurring payment
  - ✓ Plan created on server
  - ✓ Plan appears in UI after reload

- [ ] **Update plan** - Edit existing plan
  - ✓ Updated on server
  - ✓ Changes visible after reload

- [ ] **Delete plan** - Delete recurring plan
  - ✓ Deleted on server
  - ✓ Removed from UI after reload

---

## 4. Dashboard Module

### 4.1 Performance
- [ ] **Load dashboard** - Navigate to Dashboard
  - ✓ Load time < 250ms (50% faster than before)
  - ✓ Recent facts displayed
  - ✓ Quick stats calculated
  - ✓ Account balances shown

### 4.2 Data Accuracy
- [ ] **Recent facts** - Check recent transactions
  - ✓ Correct data displayed
  - ✓ Loaded from PGlite (no API call)

- [ ] **Quick stats** - Check statistics
  - ✓ Correct calculations
  - ✓ Loaded from PGlite

- [ ] **Account balances** - Check financial center balances
  - ✓ Correct balances
  - ✓ Loaded from PGlite

---

## 5. Performance Validation

### 5.1 API Reduction Target: ≥80%
- [ ] Open PGlite Diagnostic Modal
- [ ] Check "API Calls Reduction" section
- [ ] Verify:
  - ✓ Reduction ≥ 80% (green badge)
  - ✓ API calls saved > 0
  - ✓ Bandwidth saved > 0 KB

### 5.2 Module Breakdown
- [ ] **Shopping Lists breakdown**
  - ✓ PGlite calls > API calls
  - ✓ Reduction ≥ 80%

- [ ] **Facts breakdown**
  - ✓ PGlite calls > API calls
  - ✓ Reduction ≥ 80%

- [ ] **Recurring Plans breakdown**
  - ✓ PGlite calls > 0
  - ✓ Reduction % shown

- [ ] **Dashboard breakdown**
  - ✓ PGlite calls > API calls
  - ✓ Reduction ≥ 80%

### 5.3 Query Performance
- [ ] Check Performance Metrics in Diagnostic Modal
- [ ] Verify:
  - ✓ Average PGlite query time < 100ms
  - ✓ PGlite faster than API (speedup ≥ 2×)

---

## 6. Browser Compatibility

### 6.1 Desktop Browsers
- [ ] **Chrome 120+** - OPFS backend
  - ✓ PGlite initializes successfully
  - ✓ All features work

- [ ] **Edge 120+** - OPFS backend
  - ✓ PGlite initializes successfully
  - ✓ All features work

- [ ] **Firefox 115+** - IndexedDB backend
  - ✓ PGlite initializes successfully
  - ✓ All features work (may be slower)

- [ ] **Safari 16+** - IndexedDB backend
  - ✓ PGlite initializes successfully
  - ✓ All features work (may be slower)

### 6.2 Mobile Browsers
- [ ] **iOS Safari** - IndexedDB backend
  - ✓ PGlite initializes
  - ✓ Core features work

- [ ] **Chrome Mobile (Android)** - OPFS backend
  - ✓ PGlite initializes
  - ✓ All features work

---

## 7. Edge Cases

### 7.1 Large Datasets
- [ ] **1000+ facts** - Load facts page with many transactions
  - ✓ Table renders without lag
  - ✓ Pagination works correctly
  - ✓ Client-side filtering fast

- [ ] **100+ shopping lists** - Load shopping lists page
  - ✓ Lists render without lag
  - ✓ Search/filter fast

### 7.2 Slow Network
- [ ] **3G throttling** - Enable in DevTools
  - ✓ PGlite queries still fast
  - ✓ UI remains responsive
  - ✓ Sync works after delay

### 7.3 Concurrent Edits (Multiple Tabs)
- [ ] Open two tabs with same page
- [ ] Edit in Tab 1
- [ ] Check Tab 2 after sync
  - ✓ Changes reflected in both tabs
  - ✓ No data loss

### 7.4 Stale Data
- [ ] Go offline for 1 hour
- [ ] Make changes offline
- [ ] Reconnect
  - ✓ Sync completes successfully
  - ✓ No conflicts or data loss

---

## 8. Bundle Size

- [ ] Check bundle size after build
  - ✓ Total bundle < 3 MB
  - ✓ PGlite WASM + JS included
  - ✓ Tree-shaking applied

---

## 9. Error Handling

### 9.1 PGlite Init Failure
- [ ] Simulate init failure (disable IndexedDB)
  - ✓ Graceful fallback to API
  - ✓ User notification shown
  - ✓ All features still work (API mode)

### 9.2 Sync Failure
- [ ] Create item offline
- [ ] Simulate sync error (server 500)
  - ✓ Item stays in pending queue
  - ✓ Retry on next sync
  - ✓ No data loss

### 9.3 API Fallback
- [ ] Disable PGlite feature flag
  - ✓ All features still work (API mode)
  - ✓ No console errors
  - ✓ Performance metrics show 0% reduction

---

## 10. Regression Testing

### 10.1 Existing Features
- [ ] **Transfers** - Create transfer between accounts
  - ✓ Transfer created successfully
  - ✓ Both facts created (debit + credit)
  - ✓ No duplicate transfers

- [ ] **WebSocket updates** - Edit fact in another tab
  - ✓ Real-time update received
  - ✓ UI updated without refresh

- [ ] **CSV export** - Export facts to CSV
  - ✓ Export still works
  - ✓ Correct data exported

- [ ] **Bulk delete** - Delete multiple facts
  - ✓ Bulk delete still works
  - ✓ WebSocket summary event received

---

## Success Criteria

**All sections must pass:**
- ✓ Shopping Lists: 15/15 tests passed
- ✓ Facts: 13/13 tests passed
- ✓ Recurring Plans: 6/6 tests passed
- ✓ Dashboard: 3/3 tests passed
- ✓ Performance: 7/7 tests passed
- ✓ Browser Compatibility: 6/6 tests passed
- ✓ Edge Cases: 6/6 tests passed
- ✓ Bundle Size: 3/3 tests passed
- ✓ Error Handling: 3/3 tests passed
- ✓ Regression: 4/4 tests passed

**Total: 66/66 tests**

---

## Notes

- Run tests in clean browser profile to avoid cache interference
- Clear PGlite database before testing: `localStorage.clear()` + reload
- Check console for errors during testing
- Monitor Network tab to verify API reduction
- Use PGlite Diagnostic Modal for performance validation

---

**Validation Date:** _____________
**Tester:** _____________
**Result:** ✓ PASS / ✗ FAIL
**Notes:** _____________
