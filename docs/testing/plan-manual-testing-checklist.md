# Plan.html Manual Testing Checklist (Phase 5)

**Version:** 1.0.0
**Date:** 2026-01-20
**Bundle:** plan.bundle.js (66 KB uncompressed, 18.20 KB gzipped)

---

## Automated Checks ✅ PASSED

### Technical
- [x] **No TypeScript compilation errors** - `tsc --noEmit` passed
- [x] **Build succeeds** - `npm run bundle` completed successfully
- [x] **Bundle size acceptable (<100KB)** - 66 KB uncompressed ✅

---

## Manual Testing Checklist

### Filters Section

- [ ] All filters work correctly:
  - [ ] Date range (from/to) filter
  - [ ] Article type filter (expense/income/debit/credit)
  - [ ] Article (category) filter
  - [ ] Financial Center (CFO) filter
  - [ ] Cost Center (CC) filter
  - [ ] User filter
  - [ ] Search filter
- [ ] Filter indicator badge shows/hides correctly
- [ ] "Reset Filters" button clears all filters
- [ ] Filter collapse/expand works smoothly

**Test Steps:**
1. Open /plan page
2. Expand filters section
3. Apply each filter individually and verify table updates
4. Verify filter indicator appears when filters active
5. Click "Reset Filters" and verify all cleared
6. Collapse/expand section multiple times

---

### Analytics Section

- [ ] Analytics charts load and render correctly
- [ ] Month button selection works (previous/current/next months)
- [ ] Analytics CFO (Financial Center) filter works
- [ ] Analytics article type filter works (expense/income/debit/credit)
- [ ] Analytics article filter works (cascading with article type)
- [ ] Charts update on filter change

**Test Steps:**
1. Expand analytics section
2. Verify 2 charts render: "По типам операций" and "По категориям"
3. Click different month buttons and verify data updates
4. Apply CFO filter and verify charts reflect filtered data
5. Select article type and verify article dropdown reloads
6. Select specific article and verify chart focuses on that category

---

### Filter-Analytics Synchronization

- [ ] Analytics month → filters date sync works
- [ ] Filters date (full month) → analytics month sync works
- [ ] Analytics CFO → filters CFO sync works
- [ ] Filters article type → analytics article filter reload works
- [ ] Debouncing prevents cascading reloads (check console for API call count)

**Test Steps:**
1. Change analytics month to February → verify filter dates update to 01.02-28.02
2. Change filter dates to 01.03-31.03 → verify March button selected in analytics
3. Change analytics CFO to specific account → verify filter CFO updates
4. Change filter article type to "Расходы" → verify analytics article filter reloads with expenses only
5. Monitor browser console - should see debouncing messages, not cascading API calls

---

### Facts Table

- [ ] Table renders correctly on desktop (columns visible)
- [ ] Table pagination works (prev/next buttons)
- [ ] Page info displays correctly (e.g., "Страница 1 из 5")
- [ ] Selection state preserved across page changes
- [ ] "Select all" checkbox works (selects all on current page)
- [ ] Selected count updates correctly
- [ ] Responsive switch (desktop ↔ mobile) works when resizing window

**Test Steps:**
1. Load table with 50+ records
2. Navigate between pages and verify data loads
3. Select 2-3 records on page 1
4. Navigate to page 2, then back to page 1
5. Verify selections preserved
6. Click "Select all" checkbox and verify all current page items selected
7. Resize browser window to mobile width and verify layout switches

---

### Mobile View

- [ ] Mobile list renders correctly (card layout)
- [ ] Swipe/touch events work smoothly
- [ ] All sections (filters, stats, analytics, table) responsive
- [ ] Modals work correctly on mobile
- [ ] No horizontal scrolling issues

**Test Steps:**
1. Set browser to mobile viewport (375px width)
2. Verify facts display as cards (not table)
3. Test touch scrolling in all sections
4. Open/close modals and verify behavior
5. Check all interactive elements are accessible

---

### CRUD Operations

#### Plan Creation
- [ ] Regular plan creation works
- [ ] Recurring plan creation works
- [ ] Plan with reminder creation works
- [ ] Form validation works (required fields, amount > 0, etc.)
- [ ] Success notification appears after creation
- [ ] Table refreshes with new record

**Test Steps:**
1. Click "Добавить план" button
2. Fill form with valid data (regular plan)
3. Submit and verify success notification
4. Verify new record appears in table
5. Repeat for recurring plan (set frequency/duration)
6. Repeat for plan with reminder (set remind_at datetime)

#### Plan Editing
- [ ] Edit modal opens with existing data populated
- [ ] All fields editable
- [ ] Changes save correctly
- [ ] Table updates with edited data

**Test Steps:**
1. Click edit icon on existing plan
2. Verify all fields populated with current values
3. Modify amount and description
4. Submit and verify success notification
5. Verify table shows updated values

#### Plan Deletion
- [ ] Single delete works (with confirmation)
- [ ] Recurring plan deletion shows "single vs all" dialog
- [ ] Batch delete works (multiple selection)
- [ ] Confirmation dialog shows correct count

**Test Steps:**
1. Click delete icon on regular plan → verify confirmation dialog
2. Confirm deletion → verify record removed
3. Click delete on recurring plan → verify "Delete single or all occurrences?" dialog
4. Select 3+ records → verify batch delete button appears
5. Click batch delete → verify confirmation with count
6. Confirm → verify all selected records deleted

---

### Recurring Plans

- [ ] Recurring plans table loads
- [ ] Frequency preview displays correctly (e.g., "Каждый месяц")
- [ ] "Select all recurring plans" checkbox works
- [ ] Batch delete recurring plans works
- [ ] Editing recurring plan updates all future occurrences (if applicable)

**Test Steps:**
1. Navigate to recurring plans section
2. Verify table displays frequency and duration
3. Select multiple recurring plans
4. Click batch delete → verify confirmation with count
5. Edit recurring plan → verify changes apply correctly

---

### Modals

- [ ] Create plan modal opens/closes correctly
- [ ] Edit plan modal opens/closes correctly
- [ ] Modal state resets on close (no stale data)
- [ ] Calendar widgets initialize and work
- [ ] Recurring frequency preview updates dynamically
- [ ] Reminder datetime selection works

**Test Steps:**
1. Open create modal → close → reopen → verify form is empty
2. Open edit modal → close → open different record → verify data switches
3. In create modal, open calendar widget → select date → verify input updates
4. Switch to recurring mode → change frequency → verify preview text updates
5. Enable reminder → select datetime → verify remind_at field populated

---

### Stats Widget

- [ ] Stats cards display correctly (Расходы/Доходы/Списания/Пополнения)
- [ ] Stats update when filters applied
- [ ] Stats update when new plan created/edited/deleted
- [ ] Values formatted correctly (with currency symbol)

**Test Steps:**
1. Note initial stats values
2. Apply filter (e.g., only expenses) → verify stats reflect filtered data
3. Create new plan → verify stats increment
4. Delete plan → verify stats decrement

---

### Performance

- [ ] Table renders <500ms with 100+ plans
- [ ] Filter changes trigger <1 second delay before API call (debouncing)
- [ ] Analytics charts render <1 second
- [ ] No memory leaks (check DevTools Memory tab after navigating away)

**Test Steps:**
1. Load page with 100+ plans → measure time to first render (F12 Performance tab)
2. Rapidly change filters → verify debouncing prevents API spam (check Network tab)
3. Monitor memory usage → navigate to different page → return to /plan → check for leaks

---

## Console Checks

- [ ] No JavaScript errors in browser console
- [ ] No 404 errors in Network tab
- [ ] WebSocket connects successfully (if applicable)
- [ ] No excessive console.log spam (production should be clean)

**Test Steps:**
1. Open DevTools Console tab
2. Reload page and perform all actions above
3. Verify no red error messages
4. Check Network tab for failed requests

---

## Deployment Testing

**Note:** These tests require deployment to test server.

### Deploy to Test Server
```bash
# Use deploy-test skill
@skill:deploy-test
```

### Post-Deployment Checks
- [ ] Service Worker updates correctly
- [ ] Bundle loads without 404 errors
- [ ] All functionality works same as local
- [ ] No CORS errors with API
- [ ] WebSocket connections stable

---

## Test Results Summary

**Tester:** _________________
**Date:** _________________
**Environment:** [ ] Local [ ] Test Server [ ] Production

**Overall Status:** [ ] PASS [ ] FAIL [ ] PARTIAL

**Blocking Issues Found:**

**Non-Blocking Issues Found:**

**Notes:**

---

## Rollback Criteria

If ANY of these occur, consider rollback:
- ❌ Plan creation fails
- ❌ Data loss on deletion
- ❌ Critical console errors
- ❌ Performance regression >30%
- ❌ Mobile layout completely broken

**Rollback Command:**
```bash
git revert <commit-hash>
git push origin test
```

---

**End of Checklist**
