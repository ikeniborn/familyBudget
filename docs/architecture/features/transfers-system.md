# Transfer System Architecture

**Status**: ✅ Production (v5.3.0+)
**Last Updated**: 2025-12-25
**Owner**: Frontend Team

## Overview

Transfer system enables moving money between financial centers (accounts) while maintaining double-entry bookkeeping principles. Supports both fact (immediate) and plan (scheduled) transfers.

## Architecture

### Data Flow

```
User Interface (Modal)
    ↓
Form Validation (Client-side)
    ↓
Submit Handler (index.html)
    ↓
API Endpoint (/api/v1/transfers)
    ↓
Backend Validation
    ↓
Database (t_f_budget_fact)
    ↓
WebSocket Event (transfer_created)
    ↓
UI Update (IncrementalUpdates)
```

### Components

#### 1. Frontend Components

**File**: `frontend/web/templates/components/modal_transfer.html`
- Transfer modal UI
- Period selector for plan transfers (3 buttons)
- Date picker for fact transfers
- Hidden inputs: `transfer_record_type`, `transfer_plan_month`

**File**: `frontend/web/templates/index.html`
- `setTransferRecordType(type)` - Toggle between fact/plan modes (lines 454-501)
- `setupTransferPeriodButtons()` - Initialize period buttons (lines 503-577)
- `openFactTransferModal()` - Open fact transfer modal (lines 579-636)
- `openPlanTransferModal()` - Open plan transfer modal (lines 638-695)
- `saveTransfer(button)` - Submit handler wrapper (lines 6560-6640)
- Transfer form submit handler (lines 4815-4983)

**File**: `frontend/web/static/js/transfer.js`
- ~~`handleTransferSubmit()` - DISABLED (line 510-515)~~ - Submit handler (LEGACY, disabled to prevent double registration)
- `validateTransferData(data, formData)` - Client-side validation (lines 1174-1204)
- `initTransferModal()` - Modal initialization (lines 457-520)
- `openTransferModal()` - Generic modal opener (lines 880-1010)

#### 2. Backend Components

**File**: `backend/app/api/v1/endpoints/transfers.py`
- `POST /api/v1/transfers` - Create transfer
- `PUT /api/v1/transfers/{id}` - Update transfer
- `DELETE /api/v1/transfers/{id}` - Delete transfer
- Deduplication logic (sync_hash, content_hash)
- Record type validation (fact vs plan)

#### 3. Database Schema

**Table**: `t_f_budget_fact`

```sql
CREATE TABLE t_f_budget_fact (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    article_id INTEGER NOT NULL,
    financial_center_id INTEGER,
    cost_center_id INTEGER,
    amount NUMERIC(15,2) NOT NULL,
    fact_date DATE NOT NULL,
    description TEXT,
    record_type VARCHAR(20) DEFAULT 'fact',  -- 'fact' or 'plan'
    transfer_id INTEGER,  -- Links paired transfer records
    -- ...
);
```

**Transfer Logic**:
- Each transfer creates 2 records (withdrawal + deposit)
- Both records share same `transfer_id`
- Withdrawal: negative amount, `from_article_id`, `from_financial_center_id`
- Deposit: positive amount, `to_article_id`, `to_financial_center_id`

## Record Types

### Fact Transfers (Immediate)

**Trigger**: User clicks "Перевод" button
**Date Field**: `transfer_date` (DD.MM.YYYY format)
**Validation**:
- `transfer_date` must be present
- Date format validated by DateFormatter
- Amount > 0
- Different financial centers (from ≠ to)

**Database**:
```json
{
  "record_type": "fact",
  "fact_date": "2025-12-25",  // From transfer_date input
  "transfer_id": 123
}
```

### Plan Transfers (Scheduled)

**Trigger**: User clicks "Плановый перевод" button
**Date Field**: `transfer_plan_month` (YYYY-MM format, hidden)
**Validation**:
- `transfer_plan_month` must be present
- Format: YYYY-MM (e.g., "2026-01")
- Auto-converts to YYYY-MM-01 (1st of month)
- Amount > 0
- Different financial centers (from ≠ to)

**Database**:
```json
{
  "record_type": "plan",
  "fact_date": "2026-01-01",  // From transfer_plan_month + "-01"
  "transfer_id": 124
}
```

**UI**: Period buttons showing current, next, and +2 months

## Validation Architecture

### Two-Layer Validation Strategy

#### Layer 1: Client-side (transfer.js - DISABLED)

**Status**: ❌ DISABLED (commit 7ca1f426)
**Reason**: Prevented double registration with index.html handler

**Previous Implementation**:
```javascript
// transfer.js:510-515 (COMMENTED OUT)
// const form = document.querySelector('#form_transfer');
// if (form) {
//     form.addEventListener('submit', handleTransferSubmit);
// }
```

**Problem**: This handler was registered in addition to index.html handler, causing:
- Double validation errors
- Double toast notifications
- User confusion

**Solution**: Commented out registration, made index.html handler authoritative.

#### Layer 2: Client-side (index.html - ACTIVE)

**Location**: `frontend/web/templates/index.html:4815-4983`
**Status**: ✅ ACTIVE (authoritative)

**Validation Logic**:
```javascript
// Check record_type
const recordType = formData.get('transfer_record_type');

if (recordType === 'plan') {
    // Validate plan_month
    const planMonth = formData.get('transfer_plan_month');
    if (!planMonth) {
        showToast('Выберите период планирования', 'error');
        return;
    }
    // Construct transfer_date as YYYY-MM-01
    transferDate = `${planMonth}-01`;
} else {
    // Validate transfer_date
    const rawDate = formData.get('transfer_date');
    if (!rawDate) {
        showToast('Укажите дату перевода', 'error');
        return;
    }
    transferDate = BudgetShared.DateFormatter.formatForAPI(rawDate);
}
```

**Critical Features**:
1. Conditional validation based on `record_type`
2. Different source fields: `transfer_plan_month` vs `transfer_date`
3. Automatic date construction for plans (YYYY-MM-01)
4. Deduplication hashes (sync_hash, content_hash)
5. isSubmitting guard to prevent double-clicks

#### Layer 3: Server-side

**Location**: `backend/app/api/v1/endpoints/transfers.py`

**Validation**:
- Pydantic schema validation
- Business logic (different financial centers)
- Database constraints
- Deduplication (sync_hash uniqueness)

## Critical Bug Fixes (Dec 2025)

### Issue 1: Double Submit Handler Registration

**Problem**: Both `transfer.js` and `index.html` registered submit handlers on same form
**Symptom**:
- Red error "Укажите дату перевода" appeared even when period was selected
- Two toast notifications on success
- Confusing user experience

**Root Cause**:
```javascript
// transfer.js:512
form.addEventListener('submit', handleTransferSubmit);  // ❌ LEGACY

// index.html:4815
document.getElementById('form_transfer').addEventListener('submit', ...)  // ✅ ACTIVE
```

**Solution** (Commit 7ca1f426):
```javascript
// transfer.js:510-515
// DISABLED: Submit handler now registered in index.html (lines 4815+)
// This prevents double registration which causes duplicate validation errors
// const form = document.querySelector('#form_transfer');
// if (form) {
//     form.addEventListener('submit', handleTransferSubmit);
// }
```

**Evidence from logs**:
```javascript
// User logs showed TWO handlers executing:
[showToast] {message: 'Укажите дату перевода', type: 'error', stack: '...onclick (:7836:43)'}  // transfer.js
[Transfer Submit] ========== VALIDATION START ==========  // index.html (correct)
```

### Issue 2: Wrong Date in transfer_date for Plan Transfers

**Problem**: When opening plan transfer modal, `transfer_date` contained current date (e.g., "25.12.2025") instead of being empty
**Symptom**: Backend validation issues, wrong date sent to server

**Root Cause**:
```javascript
// index.html:493 (OLD)
// DON'T clear value - it may be needed when switching back to fact mode
console.log('[setTransferRecordType] Disabled transfer_date for plan transfer');
```

**Why This Was Wrong**:
- Plan transfers use `transfer_plan_month` (YYYY-MM), NOT `transfer_date`
- Backend constructs date as `${plan_month}-01` (1st of month)
- Sending current date (25th) caused validation mismatch

**Solution** (Commit 7ca1f426):
```javascript
// index.html:493-496
// CRITICAL: Clear value for plan transfers to prevent wrong date being sent to backend
// Plan transfers use transfer_plan_month (YYYY-MM-01), NOT transfer_date
transferDateInput.value = '';
console.log('[setTransferRecordType] Disabled and cleared transfer_date for plan transfer');
```

**Evidence from logs**:
```javascript
// User reported:
[openPlanTransferModal] transfer_date state: {
    value: '25.12.2025',  // ❌ WRONG! Should be empty
    disabled: true,
    required: false
}
```

### Issue 3: validateTransferData() Validation Logic

**Problem**: `validateTransferData()` checked `transfer_date` for BOTH fact and plan transfers
**Symptom**: "Укажите дату перевода" error even when `transfer_plan_month` was set

**Root Cause**:
```javascript
// transfer.js:1186-1190 (OLD)
if (!data.transfer_date) {
    return data.record_type === 'plan'
        ? 'Выберите период планирования'
        : 'Укажите дату перевода';
}
// Problem: For plan transfers, transfer_date is NULL (correct),
// but validation still failed!
```

**Solution** (Commit eb70521e):
```javascript
// transfer.js:1186-1197 (NEW)
if (data.record_type === 'plan') {
    // For plan transfers, check transfer_plan_month from form
    const planMonth = formData ? formData.get('transfer_plan_month') : null;
    if (!planMonth || planMonth === 'null' || planMonth === 'undefined') {
        return 'Выберите период планирования';
    }
} else {
    // For fact transfers, check transfer_date
    if (!data.transfer_date) {
        return 'Укажите дату перевода';
    }
}
```

**Why This Works**:
- Conditional validation based on `record_type`
- Checks actual source field: `transfer_plan_month` for plans, `transfer_date` for facts
- Validates before data is sent to backend

## State Management

### Modal Opening Flow

#### Fact Transfer Modal

```javascript
function openFactTransferModal() {
    // 1. Reset button state
    const submitBtn = modal.querySelector('.save-btn');
    if (submitBtn.dataset.originalHtml) {
        submitBtn.innerHTML = submitBtn.dataset.originalHtml;
        delete submitBtn.dataset.originalHtml;
    }
    submitBtn.disabled = false;

    // 2. Reset FC filter state (prevent phantom category selection)
    if (fromCategoryTree) {
        fromCategoryTree.options.financialCenterId = null;
    }
    if (toCategoryTree) {
        toCategoryTree.options.financialCenterId = null;
    }

    // 3. Set record type to 'fact'
    setTransferRecordType('fact');

    // 4. Open modal
    modal.showModal();
}
```

#### Plan Transfer Modal

```javascript
function openPlanTransferModal() {
    // 1. Reset button state (same as fact)
    // 2. Reset FC filter state (same as fact)

    // 3. Set record type to 'plan'
    setTransferRecordType('plan');

    // 4. Log transfer_date state for debugging
    const transferDateInput = document.getElementById('transfer_date');
    console.log('[openPlanTransferModal] transfer_date state:', {
        value: transferDateInput.value,  // Should be empty!
        disabled: transferDateInput.disabled,  // Should be true
        required: transferDateInput.required   // Should be false
    });

    // 5. Open modal
    modal.showModal();
}
```

### setTransferRecordType() Critical Logic

```javascript
function setTransferRecordType(type) {
    const recordTypeInput = document.getElementById('transfer_record_type');
    const factSection = document.getElementById('transfer-date-section-fact');
    const planSection = document.getElementById('transfer-period-section-plan');
    const transferDateInput = document.getElementById('transfer_date');

    recordTypeInput.value = type;

    if (type === 'fact') {
        // Show date picker, hide period buttons
        factSection?.classList.remove('hidden');
        planSection?.classList.add('hidden');

        // Enable and require transfer_date
        transferDateInput.disabled = false;
        transferDateInput.required = true;

        // Set default date if empty (prevents validation error)
        if (!transferDateInput.value || transferDateInput.value.trim() === '') {
            transferDateInput.value = BudgetShared.DateFormatter.today();
        }
    } else if (type === 'plan') {
        // Hide date picker, show period buttons
        factSection?.classList.add('hidden');
        planSection?.classList.remove('hidden');

        // Disable transfer_date (NOT used for plans)
        transferDateInput.disabled = true;
        transferDateInput.required = false;

        // CRITICAL: Clear value to prevent wrong date being sent
        transferDateInput.value = '';  // ← FIX for Issue 2

        // Initialize period buttons (deferred for DOM update)
        setTimeout(() => setupTransferPeriodButtons(), 0);
    }
}
```

## UI/UX Flow

### User Journey: Create Plan Transfer

1. **User clicks** "Плановый перевод" button
2. **Modal opens** with:
   - Period buttons visible (3 months)
   - Date picker hidden
   - `transfer_date` disabled and empty ✅
   - `transfer_record_type` = "plan"
3. **User selects** period (e.g., "Янв 2026")
   - Period button becomes active (btn-active class)
   - Hidden `transfer_plan_month` = "2026-01"
4. **User fills** financial centers, categories, amount
5. **User clicks** "Сохранить"
6. **Validation** (index.html handler):
   - ✅ Checks `transfer_plan_month` is present
   - ✅ Constructs `transfer_date = "2026-01-01"`
   - ✅ Validates amount, financial centers
7. **Submit** to `/api/v1/transfers`
   - Payload: `{record_type: "plan", fact_date: "2026-01-01", ...}`
8. **Backend** creates 2 records with `transfer_id`
9. **WebSocket event** `transfer_created` broadcasts
10. **UI updates** via IncrementalUpdates
11. **Toast** notification: "Перевод успешно сохранен!"

**Expected Console Logs**:
```javascript
[openPlanTransferModal] Opening plan transfer modal
[setTransferRecordType] Set record_type to: plan
[setTransferRecordType] Disabled and cleared transfer_date for plan transfer
[openPlanTransferModal] transfer_date state: {value: '', disabled: true, required: false}
[setupTransferPeriodButtons] ========== START ==========
[setupTransferPeriodButtons] ✅ Default plan_month: 2026-01
[saveTransfer] ========== START ==========
[Transfer Submit] ========== VALIDATION START ==========
[Transfer Submit] Plan month: 2026-01
[Transfer Submit] Final transfer_date: 2026-01-01 record_type: plan
[Transfer Submit] ✅ Transfer created successfully
```

## Button State Management

### Problem: Stuck Spinner on Reopen

**Symptom**: After saving transfer, reopening modal showed loading spinner instead of "Сохранить" button

**Root Cause**: Race condition in cleanup flow
```javascript
// OLD FLOW:
1. User submits form
2. finally block: setButtonLoading(submitBtn, false)
   → Restores button from dataset.originalHtml
   → Deletes dataset.originalHtml
3. Modal closes
4. User reopens modal
5. openPlanTransferModal() tries to restore button
   → dataset.originalHtml is gone! ❌
   → Button still shows spinner
```

**Solution**: Aggressive button reset with fallback
```javascript
// index.html:594-600 (openPlanTransferModal)
if (submitBtn.dataset.originalHtml) {
    submitBtn.innerHTML = submitBtn.dataset.originalHtml;
    delete submitBtn.dataset.originalHtml;
} else {
    // Fallback: restore default text if no saved state
    submitBtn.innerHTML = '<svg...></svg> Сохранить';  // ← FIX
}
submitBtn.disabled = false;
```

### isSubmitting Guard

**Purpose**: Prevent double-clicks during async submit

```javascript
let isSubmitting = false;

form.addEventListener('submit', async function(e) {
    e.preventDefault();

    if (isSubmitting) {
        console.warn('[Transfer Submit] Already submitting, ignoring');
        return;
    }

    isSubmitting = true;

    try {
        // ... submit logic
    } finally {
        isSubmitting = false;  // ← CRITICAL: Reset in ALL paths
        setButtonLoading(submitBtn, false);
    }
});
```

## WebSocket Integration

### Transfer Created Event

**Backend** (after successful creation):
```python
await broadcast_budget_event(
    user_id=current_user.id,
    event_type="transfer_created",
    data={
        "transfer_id": transfer_id,
        "from_fc": from_fc_id,
        "to_fc": to_fc_id,
        "amount": amount,
        "record_type": record_type
    }
)
```

**Frontend** (IncrementalUpdates):
```javascript
case 'transfer_created':
    // Refresh metrics (updated balances)
    await incrementalUpdates.refreshMetrics();

    // Refresh recent transfers widget
    await incrementalUpdates.refreshTransfers();

    // No manual htmx.ajax() call - WebSocket handles everything
    break;
```

**Why No Manual Refresh**:
- OLD: Response handler called `htmx.ajax()` to refresh tables
- NEW: WebSocket event handles refresh automatically
- Result: Single toast notification (not double) ✅

## Testing Strategy

### Unit Tests (Frontend)

**File**: `tests/frontend/test_transfer_validation.js`

```javascript
describe('Transfer Validation', () => {
    it('should validate plan transfers by checking transfer_plan_month', () => {
        const formData = new FormData();
        formData.set('transfer_plan_month', '2026-01');

        const data = {
            record_type: 'plan',
            transfer_date: null,  // Plan transfers have null date
            amount: 1000
        };

        const error = validateTransferData(data, formData);
        expect(error).toBeNull();  // No validation error
    });

    it('should reject plan transfers without transfer_plan_month', () => {
        const formData = new FormData();
        // No transfer_plan_month set

        const data = {
            record_type: 'plan',
            transfer_date: null,
            amount: 1000
        };

        const error = validateTransferData(data, formData);
        expect(error).toBe('Выберите период планирования');
    });
});
```

### Integration Tests

**File**: `tests/integration/test_transfer_flow.py`

```python
async def test_create_plan_transfer(client, auth_headers):
    """Test plan transfer creation with correct date handling."""
    response = await client.post(
        "/api/v1/transfers",
        json={
            "record_type": "plan",
            "fact_date": "2026-01-01",  # 1st of month
            "from_financial_center_id": 1,
            "to_financial_center_id": 2,
            "from_article_id": 10,
            "to_article_id": 20,
            "amount": 5000.00,
            "description": "Plan transfer test"
        },
        headers=auth_headers
    )

    assert response.status_code == 200
    data = response.json()

    # Verify paired records created
    transfer_id = data["transfer_id"]
    facts = await get_facts_by_transfer_id(transfer_id)

    assert len(facts) == 2
    assert facts[0].record_type == "plan"
    assert facts[1].record_type == "plan"
    assert facts[0].fact_date.day == 1  # 1st of month
```

### Manual Test Scenarios

**Scenario 1: Plan Transfer Happy Path**
```
1. Open "Плановый перевод"
2. Select "Янв 2026" period
3. Fill: From FC=1, To FC=2, Category=Income, Amount=5000
4. Click "Сохранить"
5. Verify: Single toast "Перевод успешно сохранен!"
6. Check DB: record_type='plan', fact_date='2026-01-01'
```

**Scenario 2: Plan Transfer Error Handling**
```
1. Open "Плановый перевод"
2. DON'T select period
3. Fill other fields
4. Click "Сохранить"
5. Verify: Error "Выберите период планирования"
6. Select period
7. Click "Сохранить" again
8. Verify: Success (button not stuck)
```

**Scenario 3: Plan → Fact → Plan Switching**
```
1. Open "Плановый перевод"
2. Check console: transfer_date.value = ''
3. Close modal
4. Open "Перевод" (fact)
5. Check console: transfer_date.value = today's date
6. Close modal
7. Open "Плановый перевод" again
8. Check console: transfer_date.value = '' (reset!)
```

## Performance Considerations

### Deferred DOM Updates

**Pattern**: `setTimeout(() => setupTransferPeriodButtons(), 0)`

**Why**: Period buttons are hidden by default. When switching to plan mode:
1. DOM update: Remove 'hidden' class from plan section
2. Browser renders new DOM
3. setupTransferPeriodButtons() queries DOM for buttons

**Problem**: If called synchronously, querySelector() may run before DOM update completes

**Solution**: Defer execution to next event loop tick
```javascript
setTimeout(() => setupTransferPeriodButtons(), 0);
```

### Category Tree Filter Reset

**Pattern**: Reset `financialCenterId` before modal opens

**Why**: Category tree caches previous financial center selection. Without reset:
```
1. Create transfer: From FC=1 → Category auto-selects based on FC=1
2. Close modal
3. Reopen modal: previousFcId = 1 (still cached)
4. Select From FC=2 → isInitialFiltering = false
5. Category STAYS as previous selection ❌ (phantom selection)
```

**Solution**:
```javascript
function openPlanTransferModal() {
    // CRITICAL: Reset FC filter state
    if (fromCategoryTree) {
        fromCategoryTree.options.financialCenterId = null;
    }
    if (toCategoryTree) {
        toCategoryTree.options.financialCenterId = null;
    }

    // Now opening modal works correctly
    setTransferRecordType('plan');
    modal.showModal();
}
```

## Monitoring and Debugging

### Key Console Logs

**Enable debug logging**:
```javascript
// In browser console:
localStorage.setItem('DEBUG_MODE', 'true');
location.reload();
```

**Expected logs for plan transfer**:
```javascript
[openPlanTransferModal] Opening plan transfer modal
[setTransferRecordType] Set record_type to: plan Value now: plan
[setTransferRecordType] Disabled and cleared transfer_date for plan transfer
[openPlanTransferModal] transfer_date state: {value: '', disabled: true, ...}
[setupTransferPeriodButtons] ========== START ==========
[setupTransferPeriodButtons] Found period buttons: 3
[setupTransferPeriodButtons] ✅ Default plan_month: 2026-01
[saveTransfer] ========== START ==========
[saveTransfer] Form is valid, calling requestSubmit()
[Transfer Submit] Plan month: 2026-01
[Transfer Submit] Final transfer_date: 2026-01-01 record_type: plan
[Transfer Submit] ✅ Transfer created successfully
```

### Common Error Patterns

#### Error: "Укажите дату перевода" on Plan Transfer

**Diagnostic**:
```javascript
// Check which handler is executing
console.log('[Transfer Submit] handler source:', new Error().stack);
```

**If shows transfer.js**:
- ❌ Legacy handler is still active
- Fix: Verify transfer.js:510-515 is commented out
- Clear browser cache and reload

**If shows index.html**:
- ✅ Correct handler active
- Check: Is `transfer_plan_month` set?
- Debug: Log formData.get('transfer_plan_month')

#### Error: Button Stuck in Loading State

**Diagnostic**:
```javascript
// Check button state in console
const btn = document.querySelector('.save-btn');
console.log({
    disabled: btn.disabled,
    innerHTML: btn.innerHTML,
    hasOriginal: !!btn.dataset.originalHtml
});
```

**If hasOriginal = false and innerHTML contains spinner**:
- ❌ Button state not restored
- Fix: Call `window.location.reload()` to reset
- Long-term: Verify fallback logic in openPlanTransferModal()

## Migration Notes

### Upgrading from v5.2.x to v5.3.0

**Breaking Changes**:
1. `transfer.js` submit handler disabled - ensure no custom modifications to this handler
2. `transfer_date` now cleared for plan transfers - update any client-side scripts that read this field

**Database Changes**: None (schema unchanged)

**API Changes**: None (endpoint behavior unchanged)

**Frontend Changes**:
1. Update `transfer.js` to latest version (commit 7ca1f426+)
2. Update `index.html` to latest version (commit 7ca1f426+)
3. Clear browser cache after deployment

**Testing Checklist**:
- [ ] Plan transfer creates record with `fact_date = YYYY-MM-01`
- [ ] Fact transfer creates record with `fact_date = user's selected date`
- [ ] No double toast notifications
- [ ] Button state resets correctly on modal reopen
- [ ] Console shows NO validation errors for valid plan transfers

## Future Improvements

### Phase 1: Completed ✅
- [x] Fix double submit handler registration
- [x] Fix transfer_date clearing for plan transfers
- [x] Fix validateTransferData() conditional logic
- [x] Add comprehensive logging
- [x] Implement button state fallback

### Phase 2: Planned
- [ ] Add Playwright E2E tests for transfer flows
- [ ] Implement optimistic UI updates (show transfer immediately, rollback on error)
- [ ] Add transfer templates (save frequent transfers)
- [ ] Support bulk transfers (multiple transfers in one operation)
- [ ] Add transfer scheduling (cron-like recurring transfers)

### Phase 3: Exploration
- [ ] Mobile app support (React Native)
- [ ] Offline-first transfers with conflict resolution
- [ ] Transfer approvals workflow (multi-user budgets)
- [ ] Transfer categories analytics (most frequent routes)

## Related Documentation

- [PWA Architecture](../core/pwa.md) - Service Worker and offline support
- [Caching Strategy](../optimization/caching-strategy.md) - Frontend cache versioning
- [Web Workers - Background processing
- [Backup System](./backup-system.md) - Data backup and recovery

## Changelog

### 2025-12-25 (v5.3.0)
- ✅ Fixed double submit handler registration (commit 7ca1f426)
- ✅ Fixed transfer_date clearing for plan transfers (commit 7ca1f426)
- ✅ Fixed validateTransferData() conditional validation (commit eb70521e)
- ✅ Added comprehensive debug logging
- ✅ Implemented button state fallback logic
- ✅ Deployed to production (budget-dev.ikeniborn.ru)

### 2025-12-23 (v5.2.0)
- Added FC filter state reset (commit eb70521e)
- Implemented deduplication via sync_hash
- Added WebSocket integration for real-time updates

### 2025-11-15 (v5.1.0)
- Initial transfer system implementation
- Support for fact and plan transfers
- Double-entry bookkeeping logic
