# Import Wizard - Architecture Documentation

## Overview

The Import Wizard allows users to import CSV bank statements into the budget system with customizable column mappings.

## Key Features

- **Per-User Mappings**: Each user has their own column mapping per bank
- **Timeout Protection**: 30s timeout on file analysis to prevent UI hangs
- **Multiple Banks**: Support for Tinkoff, Alfabank, Sberbank, VTB, Raiffeisen
- **Auto-Detection**: Automatic delimiter and encoding detection

## Workflow (6 Steps)

### Step 1: Bank Selection
- User selects bank from dropdown
- `GET /api/v1/import/banks` returns active banks

### Step 2: File Upload
- User uploads CSV file or provides Google Sheets URL
- `POST /api/v1/import/upload` analyzes file structure
- Auto-detects delimiter (`;`, `,`, `\t`, `|`, `:`, ` `) and encoding (UTF-8, Windows-1251)

**Timeout Protection:**
- Frontend timeout: 30s (AbortController)
- Loading spinner during analysis
- User-friendly error messages for timeout/network failures

### Step 3: Column Mapping
- User selects delimiter (default: Автоопределение) or manually chooses from 7 options
- User maps CSV columns to budget fields (fact_date, amount, description, etc.)
- `GET /api/v1/import/mappings/{bank_id}` loads saved mapping (per-user)
- `POST /api/v1/import/mappings` saves mapping (SCD Type 1, per-user)

**Per-User Architecture:**
- Each user has their own mapping per bank
- Unique constraint: `(bank_provider_id, user_id)`
- User A saving mapping does NOT affect User B's mapping

### Step 4: Parse & Staging
- `POST /api/v1/import/files/{id}/parse` parses CSV with mapping
- Records saved to `t_import_staging`

### Step 5: Enrichment
- User assigns Article, FinancialCenter, CostCenter to each row
- Bulk operations supported

### Step 6: Import
- Create BudgetFact records from selected staging rows
- Create BudgetFactHistory records (SCD Type 2)

## Data Model

### ImportColumnMapping

**Purpose**: Store user-specific column mappings for CSV imports

**Schema:**
```sql
CREATE TABLE t_import_column_mapping (
    id BIGSERIAL PRIMARY KEY,
    bank_provider_id BIGINT NOT NULL REFERENCES t_d_bank_provider(id),
    user_id BIGINT NOT NULL REFERENCES t_d_user(id),
    mapping JSONB NOT NULL,  -- CSV column → budget field
    transformations JSONB,   -- date_format, decimal_separator, etc.
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL,
    CONSTRAINT uq_bank_user_mapping UNIQUE (bank_provider_id, user_id)
);
```

**Pattern**: SCD Type 1 (in-place updates per user)

**Example Mapping:**
```json
{
  "fact_date": "Дата операции",
  "amount": "Сумма операции",
  "description": "Описание",
  "csv_category": "Категория",
  "csv_mcc": "MCC",
  "csv_card": "Номер карты"
}
```

### Architecture Decision: Per-User Mappings

**Why per-user?**
- Different users may receive different CSV formats from the same bank
- Corporate vs personal accounts have different export options
- Preserves user autonomy in multi-user environment

**History:**
- Migration `20251222_a4b5c6d7e8f9`: Implemented shared mapping - **WRONG**
- Migration `20251222_9baacd464951`: Reverted to per-user mapping - **CORRECT**

## Error Handling

### File Analysis Timeout

**Problem:** Large CSV files could cause frontend to hang indefinitely

**Solution:**
```javascript
// Frontend: 30s timeout with AbortController
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), 30000);

const response = await fetch('/api/v1/import/files/${fileId}/analyze', {
    signal: controller.signal
});
```

**Error Messages:**
- `AbortError`: "Превышено время ожидания (30 сек). Попробуйте загрузить файл меньшего размера..."
- `Failed to fetch`: "Ошибка сети. Проверьте подключение к интернету."

**Backend Monitoring:**
```python
# Logs warning if analyze_file() takes >5s
elapsed = time.time() - start_time
if elapsed > 5.0:
    logger.warning(f"SLOW QUERY: analyze_file took {elapsed:.2f}s")
```

## API Endpoints

### Import Mappings

**GET /api/v1/import/mappings/{bank_provider_id}**
- Returns saved mapping for current user + bank
- Returns 404 with default mapping if not saved

**POST /api/v1/import/mappings**
- Saves or updates mapping (per-user)
- SCD Type 1: in-place update for same user
- Different users create separate mappings

**Example:**
```python
# User 123 saves mapping (doesn't affect other users)
mapping1 = await MappingService.save_mapping(
    session, bank_id=1, user_id=123,
    mapping={"fact_date": "Date1"}
)

# User 456 saves different mapping (separate record)
mapping2 = await MappingService.save_mapping(
    session, bank_id=1, user_id=456,
    mapping={"fact_date": "Date2"}
)

# mapping1.id != mapping2.id (each user has their own)
```

## Security

### User Isolation

- Column mappings: Per-user (no cross-contamination)
- File uploads: User ID validated in API
- Staging records: Filtered by current_user.id

### Input Validation

- Max file size: 100MB
- Allowed content types: text/csv, application/csv
- Encoding validation: UTF-8, Windows-1251 only
- Required mapping fields: fact_date, amount

## Performance

### File Analysis

**Typical performance:**
- Small files (<1MB): <500ms
- Medium files (1-10MB): 1-3s
- Large files (10-100MB): 5-15s

**Optimization:**
- CSVAnalyzer only reads first 1000 rows for sampling
- Encoding detection uses chardet library (fast)
- Delimiter detection tries common separators first

**Warning threshold:** 5s (backend logs warning if exceeded)

## Testing

### Manual Testing Checklist

**Per-User Mapping Isolation:**
1. User A logs in, uploads Tinkoff CSV, saves mapping
2. User B logs in, uploads Tinkoff CSV, saves different mapping
3. User A re-uploads → sees THEIR original mapping (not User B's)
4. User B re-uploads → sees THEIR own mapping (not User A's)

**File Analysis Timeout:**
1. Upload large file (>50MB)
2. Verify loading spinner appears immediately
3. Verify either success (if <30s) OR timeout error (if >30s)
4. Verify error message is user-friendly

**"Начать заново" Flow:**
1. Upload file successfully, reach step 2
2. Click "Начать заново"
3. Verify immediate return to step 1 (<1s, no hang)

## Known Issues & Fixes

### Upload Permission Denied (Fixed 2026-01-17)

**Problem**: При загрузке CSV файла на шаге 2 ошибка:
```
Permission denied: '/app/uploads/temp/import_xxx.csv'
```

**Root Cause**:
- Backend контейнер запускается как `appuser` (UID:GID 999:999, см. `backend/Dockerfile`)
- docker-compose.yml монтирует volume `./uploads:/app/uploads`
- `sync.sh` создавал директорию без установки правильного владельца
- Директория принадлежала UID 1000 (пользователь развёртывания) вместо UID 999

**Solution**:
Добавлена функция `fix_uploads_permissions()` в `scripts/lib/sync.sh`:

```bash
# Fix uploads directory permissions for backend container
# Backend runs as appuser (UID:GID 999:999 from backend/Dockerfile)
# Host-mounted volumes inherit host permissions, so we must chown
fix_uploads_permissions() {
    chown -R 999:999 "$DEPLOY_DIR/uploads" 2>/dev/null || true
}
```

Функция вызывается в трёх sync функциях:
- `sync_mirror()` — после создания директорий
- `sync_update()` — после создания директорий
- `sync_clean()` — после создания директорий

**Files**: `scripts/lib/sync.sh:27-32,365,557,689`

**Verification**:
```bash
ssh budget-test "ls -la /opt/budget/uploads/"
# Expected: drwxr-xr-x 999 999 uploads/
```

**See also**: `scripts/lib/utils.sh:385-434` — `prepare_upload_directories()` uses same UID/GID pattern

---

### Step 2 Form Reset (Fixed 2025-12-23)

**Problem**: When restarting import wizard (Step 1 → Step 2), upload form does not display correctly.

**Root Cause**:
- `proceedToUpload()` only toggled visibility without clearing Step 2 state
- Radio buttons, file inputs, and forms retained state from previous session
- Issue most commonly occurred when confirming staging deletion during step transition

**Fix**:
- Added state reset in `proceedToUpload()`: clear forms, reset radio to CSV, hide post-upload actions
- Enhanced `resetWorkflow()` to explicitly reset upload source visibility
- Files: `frontend/web/templates/admin_import.html:1318-1334,1069-1078`

**Testing**:
1. Upload file successfully, reach step 3
2. Click "Начать заново" → returns to step 1
3. Select bank → proceed to step 2
4. **Expected**: Upload form visible with CSV option selected
5. **Before fix**: Form not visible OR wrong source selected
6. **After fix**: Form displays correctly ✅

**Alternative scenario (staging deletion)**:
1. Upload file, complete import
2. Return to /import page
3. Select bank → confirm staging deletion → proceed to step 2
4. **Before fix**: Form state from previous session (broken)
5. **After fix**: Clean form with CSV selected ✅

---

### Bulk Delete Button Logic (Fixed 2025-12-23)

**Problem**: The "🗑️ Удалить" (Delete) button in bulk-panel-filtered deleted ALL filtered records, ignoring checkboxes.

**Root Cause**:
- `deleteFilteredRecords()` used `filteredRecords.map(r => r.id)` to get IDs for deletion
- This selected ALL filtered records, not just checked ones
- User expectation: Delete only checked records (via checkboxes)
- Actual behavior: Delete all records matching filters

**Fix**:
- Changed `deleteFilteredRecords()` to use `getSelectedIds()` instead of `filteredRecords.map(r => r.id)`
- `getSelectedIds()` correctly returns only records with checked checkboxes
- Updated confirmation message: "отфильтрованных" → "выбранных" (filtered → selected)
- Updated function comment to reflect new behavior

**Files**: `frontend/web/templates/admin_import.html:3221-3260`

**Testing**:
1. Load staging data (Step 4)
2. Check ONE record via checkbox
3. Click "🗑️ Удалить" in bulk-panel-filtered
4. **Expected**: Confirmation shows "Удалить 1 выбранных записей?" (only 1 record)
5. **Before fix**: Deleted all filtered records (regardless of checkboxes)
6. **After fix**: Deletes only the 1 checked record ✅

---

### Clear Staging Button Removed (Fixed 2025-12-23)

**Problem**: Step 4 had duplicate delete functionality - both "Очистить staging" and "🗑️ Удалить" buttons.

**Root Cause**:
- "Очистить staging" button called `clearStaging()` - deleted ALL records for selected bank
- This functionality duplicated the "Начать заново" button (reset workflow)
- Confused users - unclear difference between buttons

**Fix**:
- Removed "Очистить staging" button from Step 4 UI (admin_import.html:835-840)
- Removed both `clearStaging()` function definitions (old version at line 1423, new version at line 2868)
- Kept "🗑️ Удалить" button (now correctly deletes only checked records)
- Kept "Начать заново" button (resets entire workflow)

**Files**: `frontend/web/templates/admin_import.html:835-840, 1423-1439, 2868-2930`

**Result**: Clear UI with no functional duplication. Users now have:
- **"🗑️ Удалить"** - Delete checked records
- **"Начать заново"** - Reset workflow to Step 1

---

### Delimiter Auto-Detection + Extended Delimiters (Added 2025-12-23)

**Enhancement**: Added automatic delimiter detection and support for 7 delimiters (was 3).

**Changes:**
1. **New delimiters** added to dropdown:
   - `|` (pipe/вертикальная черта)
   - `:` (colon/двоеточие)
   - ` ` (space/пробел)
   - Total: 7 delimiters (was: `;`, `,`, `\t`)

2. **"Автоопределение" option** (default):
   - Value: `auto`
   - Selected by default on Step 3
   - Uses backend auto-detection via `/analyze` endpoint
   - Shows detected delimiter in status: "✓ 15 колонок, 152 строк (разделитель: точка с запятой (;))"

3. **Smart delimiter handling**:
   - If user selects "Автоопределение" → uses `/api/v1/import/files/{id}/analyze` (auto-detect)
   - If user selects specific delimiter → uses `/api/v1/import/files/{id}/preview?delimiter=...` (force)
   - When saving mapping with "auto" → saves actual detected delimiter (not "auto" string)

4. **Backend changes** (`csv_analyzer.py`):
   - Extended `csv.Sniffer` delimiters: `';,\t|: '` (was `';,\t'`)
   - Extended fallback candidates list
   - Updated docstring with new examples

**Files:**
- `frontend/web/templates/admin_import.html:511-519` (dropdown)
- `frontend/web/templates/admin_import.html:1862-1926` (loadCsvPreview logic)
- `frontend/web/templates/admin_import.html:1804-1811` (default "auto")
- `frontend/web/templates/admin_import.html:2072-2086` (save actual delimiter)
- `backend/app/services/csv_analyzer.py:166-246` (detect_delimiter)

**User Experience:**
1. Upload file → Step 3 opens with "Автоопределение" selected
2. Preview shows: "✓ 15 колонок, 152 строк (разделитель: точка с запятой (;))"
3. User can switch to manual delimiter if auto-detection is wrong
4. Saved mapping stores actual delimiter for future imports

---

### Radio Buttons Visibility on Restart (Fixed 2025-12-23)

**Problem**: When restarting import wizard (Step 1 → Step 2), radio buttons for source selection (CSV/Google Sheets) were not visible.

**Root Cause**: Radio buttons container was hidden after first file upload and not restored in `proceedToUpload()` or `resetWorkflow()`.

**Fix**:
- Added unique ID `upload-source-selector` to radio buttons container
- Replaced all `.form-control.mb-4` selectors with direct `getElementById('upload-source-selector')`
- Restore radio buttons container visibility in `proceedToUpload()` and `resetWorkflow()`

**Files**: `frontend/web/templates/admin_import.html:390,1081,1349,1613,1679`

**Follow-up Fix #1 (2025-12-23)**: Initial implementation using `.form-control.mb-4` selector was too generic and could select wrong element. Fixed by adding unique ID to container.

**Follow-up Fix #2 (2025-12-23)**: Google Sheets form disappeared when selecting it after clicking "Начать заново". Root cause: `resetWorkflow()` set `style.display` directly on forms, conflicting with container-based visibility management. Fixed by removing direct form display manipulation.

---

### Mapping Buttons Incorrect Display (Fixed 2025-12-23)

**Problem**: After uploading file on Step 2, "Create mapping" button shown even when mapping exists in database.

**Root Cause**: `showPostUploadActions()` did not load mapping from API before checking `savedMappingId`, causing it to remain `null`.

**Fix**: Call `await loadSavedMapping(selectedBankId)` before checking mapping existence.

**Files**: `frontend/web/templates/admin_import.html:1694-1695`

---

### Category Picker Async Loading Race Condition (Fixed 2025-12-23)

**Problem**: Console error "Category not found in choices: 70" during enrichment step.

**Root Cause**: `setSelectedCategory()` called before categories finished loading from API (async fetch in `loadCategories()`).

**Fix**: Added retry logic (3 attempts, 100ms delay) in `setSelectedCategory()` to wait for categories to load.

**Files**: `frontend/shared/static/js/choicesCategoryTree.js:917-947`

---

### Import Execution Error Handling (Fixed 2025-12-23)

**Problem**: `executeImport()` crashed with `SyntaxError: Unexpected token '<'` when server returned HTML error page instead of JSON.

**Root Cause**: Code attempted to parse all responses as JSON without checking `Content-Type` header first. When backend returned HTML error page (e.g., 500 Internal Server Error), `response.json()` failed with cryptic syntax error.

**Fix**: Added Content-Type validation before JSON parsing:

1. **Error responses** (non-2xx status):
   - Check `Content-Type` header
   - If `application/json` → parse as JSON and extract error message
   - If HTML or other → read as text, log first 200 chars, show user-friendly error
   - Catch parse errors → show connection error with status code

2. **Success responses** (2xx status):
   - Check `Content-Type` header before parsing
   - If not JSON → throw error with helpful message

**User Experience:**
- **Before**: Cryptic error "SyntaxError: Unexpected token '<', "<html>..." in console
- **After**: Clear Russian error message: "Ошибка сервера (500). Проверьте логи backend."

**Debugging:**
- Non-JSON responses logged to console with first 200 characters
- Parse errors logged with full stack trace
- HTTP status code included in error messages

**Files**: `frontend/web/templates/admin_import.html:2820-2865`

**Testing:**
1. Trigger backend 500 error (e.g., database connection issue)
2. Click "Импортировать" button
3. **Expected**: User-friendly error message, not JavaScript exception
4. **Console**: Shows response preview and HTTP status code

---

### Console Errors and Performance (Fixed 2025-12-23)

**Problem 1**: `GET /api/v1/import/mappings/1 404 (Not Found)` shown in console as error during normal import workflow.

**Root Cause**: 404 is expected when user has no saved mapping yet (first import). Backend correctly returns 404, but browser shows it as error in console.

**Fix**:
- Added explicit `response.status === 404` check in `loadSavedMapping()`
- 404 handled silently as normal behavior (not logged as error)
- Only non-404 errors logged: `console.error()`
- Added comment explaining 404 is expected

**User Experience**:
- **Before**: Red 404 error in console (confusing for users)
- **After**: No error logging for 404 (still visible in Network tab, but not alarming)

**Files**: `frontend/web/templates/admin_import.html:1494-1518`

---

**Problem 2**: `[ChoicesCategoryTree] Category not found in choices after 3 attempts: 70` warning in console.

**Root Cause**: Category ID 70 either deleted from database, wrong type (expense/income mismatch), not a leaf node, or filtered out by financial center. `setSelectedCategory()` retried 3 times, then logged warning.

**Fix**:
- Changed `console.warn` to `console.debug` in `setSelectedCategory()`
- Added explanatory comment listing reasons why category may not be found
- Debug messages hidden by default in browser console (less noise)

**Valid Reasons for Missing Category**:
1. Category deleted from database
2. Type mismatch (staging record type ≠ category type)
3. Not a leaf node (if `showLeafOnly: true`)
4. Filtered out by financial center

**User Experience**:
- **Before**: Yellow warning in console
- **After**: Debug message (hidden by default, visible if console set to "Verbose")

**Files**:
- `frontend/shared/static/js/choicesCategoryTree.js:1011-1018`
- `frontend/web/static/js/budgetShared.min.js` (minified)

---

**Problem 3**: `[Violation] 'click' handler took 1218ms` performance warning in `applyBulkToFiltered()`.

**Root Cause**: `applyBulkToFiltered()` synchronously called `renderStagingTable()`, which:
- Clears table: `tbody.innerHTML = ''`
- Creates all rows via `createStagingRow()` for each record
- Initializes Choices.js picker for each row (with `setTimeout(..., 50)`)
- For 100 records: 100 pickers × initialization time = 1200ms+ blocking UI

**Fix**:
- Wrapped `renderStagingTable()` and related operations in `setTimeout(..., 10)`
- Allows browser to update UI (show notification) before heavy DOM operations
- Prevents "long task" performance warning

**Performance Impact**:
- **Before**: Click handler blocks UI for 1200ms (browser freezes)
- **After**: Click handler returns in ~10ms, heavy work deferred (UI stays responsive)

**User Experience**:
- **Before**: Browser freezes after clicking "Применить" button
- **After**: Notification appears immediately, table updates shortly after (smooth)

**Files**: `frontend/web/templates/admin_import.html:3275-3292`

---

**Summary**: All three console issues resolved. Import workflow now:
- ✅ No false-positive 404 errors
- ✅ No noisy warnings for expected missing categories
- ✅ No UI freezing during bulk operations

---

### Import Options Conditional Display (Added 2025-12-24)

**Enhancement:** Import checkboxes now display conditionally based on validation result.

**Changes:**

1. **"Агрегировать количество дубликатов"** (Aggregate duplicates):
   - **Condition:** Only shown if `result.warnings.length > 0` OR option is already enabled
   - **Rationale:** Aggregation is only relevant when duplicates exist
   - **Implementation:** `${this.hasDuplicateWarnings(result) ? ... : ''}`

2. **"Загрузить с новой группой или магазином"** (Create missing references):
   - **Condition:** Only shown if `result.errors` contains `error_type === 'reference'` OR option is already enabled
   - **Rationale:** Option only relevant when stores/product groups are missing from database
   - **Implementation:** `${this.hasReferenceErrors(result) ? ... : ''}`

3. **Spacing improvements:**
   - Changed checkbox margin-bottom: `mb-4` (16px) → `mb-2` (8px)
   - More compact layout without compromising readability
   - Consistent with DaisyUI form control spacing recommendations

**Helper Methods:**

```javascript
// frontend/web/static/js/lists/csvImporter.js

/**
 * Check if validation result has reference errors.
 * Reference errors occur when store/product_group not found in DB.
 *
 * IMPORTANT: Returns true if createMissingReferences is already enabled,
 * to keep checkbox visible (otherwise user can't disable it).
 */
hasReferenceErrors(result) {
    // Keep checkbox visible if user already enabled the option
    if (this.importOptions.createMissingReferences) {
        return true;
    }

    // Show checkbox if there are reference errors in current result
    if (!result.errors || result.errors.length === 0) {
        return false;
    }
    return result.errors.some(e => e.error_type === 'reference');
}

/**
 * Check if validation result has duplicate warnings.
 *
 * IMPORTANT: Returns true if aggregateDuplicates is already enabled,
 * to keep checkbox visible (otherwise user can't disable it).
 */
hasDuplicateWarnings(result) {
    // Keep checkbox visible if user already enabled the option
    if (this.importOptions.aggregateDuplicates) {
        return true;
    }

    // Show checkbox if there are duplicate warnings
    return result.warnings && result.warnings.length > 0;
}
```

**Critical Logic Explanation:**

When user enables "Aggregate duplicates" or "Create missing refs", backend modifies the result:
- **Aggregate duplicates ON** → backend merges duplicates → `result.warnings.length = 0`
- **Create missing refs ON** → backend filters reference errors → `result.errors` without reference errors

Without checking `this.importOptions.*`, checkbox would disappear when user enables it, preventing them from disabling!

**Solution:** Always show checkbox if option is already enabled (`importOptions.aggregateDuplicates` or `importOptions.createMissingReferences`)

**User Experience:**

| Scenario | Checkboxes Shown |
|----------|------------------|
| No errors, no warnings | None (only Import button) |
| 5 invalid rows, no duplicates | "Skip invalid" only |
| 3 duplicates, no errors | "Skip duplicates", "Aggregate duplicates" |
| 2 reference errors | "Skip invalid", "Create missing references" |
| All issue types | All 4 checkboxes |
| User enables "Aggregate duplicates" | "Aggregate duplicates" stays visible (even though warnings=0 after aggregation) |
| User enables "Create missing refs" | "Create missing refs" stays visible (even though reference errors filtered) |

**Files Changed:**
- `frontend/web/static/js/lists/csvImporter.js` - Added helper methods, conditional rendering
- `docs/architecture/functionality/import-wizard.md` - This documentation

**See also:**
- `backend/app/services/csv_validator.py:26-54` - ValidationError structure
- `backend/app/api/v1/endpoints/shopping_csv_import.py:202-216` - Reference error filtering

---

### Mutually Exclusive Options: Skip Duplicates vs Aggregate Duplicates (Added 2025-12-24)

**Enhancement:** "Skip Duplicates" and "Aggregate Duplicates" are now mutually exclusive in the UI to prevent user confusion.

**Problem:**
- Both checkboxes were shown simultaneously when duplicates existed
- Users could check both, causing confusion about which action would apply
- "Skip" = ignore duplicates (final count = unique rows only)
- "Aggregate" = merge duplicates (final count = unique rows with summed quantities)
- These are conceptually incompatible operations

**Solution:**
When "Skip Duplicates" is checked → "Aggregate Duplicates" checkbox is automatically hidden.

**Implementation:**

1. **Updated `hasDuplicateWarnings()` method** (csvImporter.js:1102-1115):
   ```javascript
   hasDuplicateWarnings(result) {
       // Hide aggregate checkbox if skip duplicates is enabled (mutually exclusive)
       if (this.importOptions.skipDuplicates) {
           return false;  // Highest priority check
       }

       // Keep checkbox visible if user already enabled the option
       if (this.importOptions.aggregateDuplicates) {
           return true;
       }

       // Show checkbox if there are duplicate warnings
       return result.warnings && result.warnings.length > 0;
   }
   ```

2. **Added onchange handler** to Skip Duplicates checkbox (csvImporter.js:1253):
   ```html
   <input type="checkbox" id="skip-duplicates-checkbox"
          class="checkbox checkbox-warning"
          ${this.importOptions.skipDuplicates ? 'checked' : ''}
          onchange="window.${varName}.handleSkipDuplicatesChange()" />
   ```

3. **Created `handleSkipDuplicatesChange()` method** (csvImporter.js:698-729):
   ```javascript
   handleSkipDuplicatesChange() {
       const skipDuplicatesCheckbox = document.getElementById('skip-duplicates-checkbox');
       const aggregateDuplicatesCheckbox = document.getElementById('aggregate-duplicates-checkbox');

       // Read and save state
       const skipDuplicatesEnabled = skipDuplicatesCheckbox ?
           skipDuplicatesCheckbox.checked : false;
       this.importOptions.skipDuplicates = skipDuplicatesEnabled;

       // Auto-uncheck Aggregate if incompatible (both can't be true)
       if (skipDuplicatesEnabled && aggregateDuplicatesCheckbox &&
           aggregateDuplicatesCheckbox.checked) {
           aggregateDuplicatesCheckbox.checked = false;
           this.importOptions.aggregateDuplicates = false;
           debugLog('[CSVImporter] Auto-disabled Aggregate Duplicates (incompatible with Skip)');
       }

       // Re-render UI with updated visibility logic
       // NOTE: Does NOT call API - just updates UI (skip is a final import option, not preview)
       this.renderPreviewResults();
   }
   ```

**User Flow:**

| User Action | UI State | Result |
|-------------|----------|--------|
| Duplicates detected | Both checkboxes visible (unchecked) | User can choose |
| Check "Skip Duplicates" | "Aggregate" checkbox disappears | Skip mode active |
| Uncheck "Skip Duplicates" | "Aggregate" checkbox reappears (unchecked) | Both options available again |
| Check "Aggregate" → then check "Skip" | "Aggregate" auto-unchecked and hidden | Skip takes priority |

**Why No API Call:**
- "Skip Duplicates" is a **final import option** (affects what gets imported)
- "Aggregate Duplicates" is a **preview option** (affects staging data transformation)
- Changing "Skip" doesn't require re-validation → just updates UI visibility
- Changing "Aggregate" triggers `revalidateWithOptions()` → calls API to merge rows

**Performance:**
- UI update: ~10-50ms (renderPreviewResults without API)
- No network latency
- Smooth user experience

**Files Changed (pre-v7.0.1):**
- `frontend/web/static/js/lists/csvImporter.js` (3 changes: method update, handler add, new method)

**Files Changed (v7.0.1+):**
- `frontend/web/static/js/lists/csvImporter.ts` (TypeScript module)
- Bundled into `frontend/web/static/js/lists.min.js` (unified bundle)

**Testing Checklist:**

1. Upload CSV with duplicates → both checkboxes visible (unchecked)
2. Check "Skip Duplicates" → "Aggregate" disappears
3. Uncheck "Skip Duplicates" → "Aggregate" reappears (unchecked)
4. Check "Aggregate" first, then check "Skip" → "Aggregate" auto-unchecks and disappears
5. Console logs (debug mode): "Skip Duplicates toggled: true/false"

**Edge Cases Handled:**
- Both checkboxes enabled simultaneously → Skip takes priority, Aggregate auto-disabled
- Large CSV with slow render → Acceptable lag (~200-500ms for renderPreviewResults)
- Page reload → Both reset to unchecked (fresh state)
- CSV without duplicates → Neither checkbox shown

**Rationale:**
- Prevents user confusion about conflicting options
- Makes import behavior predictable and clear
- Follows principle of "make impossible states impossible" in UI design

**See also:**
- `frontend/web/static/js/lists/csvImporter.js:698-729` - handleSkipDuplicatesChange() implementation
- `frontend/web/static/js/lists/csvImporter.js:1102-1115` - hasDuplicateWarnings() logic

## Transformation Options: include_all_columns (v6.x+)

**Since version 6.x**: Users can optionally concatenate ALL unmapped CSV columns into the description field.

### Overview

**UI Location**: Step 3 (Column Mapping), below mapping table

**Checkbox**: "Включить все колонки CSV в описание"

**Purpose**: Preserve metadata from CSV files that have many columns beyond the standard mappings (date, amount, description).

### Behavior

**When enabled**:
- All CSV columns that are NOT mapped (fact_date, amount, description, csv_category) are concatenated into description
- Format: `[CSV: Column1: Value1; Column2: Value2; ...]`
- Empty values are skipped
- Mapped description is preserved and prepended: `"Original Description | [CSV: ...]"`

**When disabled** (default):
- Only the mapped description field is used
- No concatenation occurs

### Technical Implementation

**Storage**: `t_import_column_mapping.transformations` JSONB field

```json
{
  "delimiter": ";",
  "date_format": "%d.%m.%Y %H:%M:%S",
  "number_format": "ru",
  "include_all_columns": true
}
```

**Processing**: `generic_csv_parser.py` processes concatenation during parsing (Step 4)

**Smart Exclusion**: Mapped columns are EXCLUDED from concatenation to avoid duplication

### Use Case

**Example CSV** (Tinkoff bank export):
```
Date;Amount;Description;MCC;Merchant;CardLast4
20.11.2025;-100,00;Coffee Purchase;5814;Starbucks;5958
```

**Mapping**:
- fact_date → Date
- amount → Amount
- description → Description

**Result** (include_all_columns=true):
```
Description: Coffee Purchase | [CSV: MCC: 5814; Merchant: Starbucks; CardLast4: 5958]
```

**Note**: Date, Amount, Description are EXCLUDED from [CSV: ...] to avoid duplication.

### Logging

**Backend**: `[CSV_PARSER]`, `[CSV_MAPPING]`
**Frontend**: `[MAPPING]`, `[IMPORT]`

**Example logs**:
```
[CSV_PARSER] Starting parse: include_all_columns=True
[CSV_PARSER] Row 2: excluding 4 mapped columns
[CSV_PARSER] Row 2: concatenated 3 unmapped columns
[CSV_PARSER] Parsing complete: 10 records parsed, include_all_columns=True
```

### Files Modified

- **Backend**: `generic_csv_parser.py:40-49` (transformations parameter), `generic_csv_parser.py:164-213` (concatenation logic)
- **Backend**: `import_endpoints.py:882-898` (pass transformations to parser)
- **Frontend**: `admin_import.html:584-600` (checkbox UI), `admin_import.html:2087-2096` (handleIncludeAllColumnsChange), `admin_import.html:2098-2121` (saveMapping update)
- **Migration**: `20251229_a1b2c3d4e5f6_remove_csv_info_fields.py`

---

## Removed Features

### csv_info1 and csv_info2 Fields (Removed in v6.x)

**Migration**: `20251229_a1b2c3d4e5f6_remove_csv_info_fields.py`

**Previously**: Step 3 allowed mapping `csv_info1` and `csv_info2` to CSV columns for metadata storage

**Removed**:
- UI mapping options "Информация 1 (metadata)" and "Информация 2 (metadata)"
- Table columns "Инфо 1" and "Инфо 2" from staging table
- `info1` and `info2` keys in `t_import_staging.csv_metadata` JSONB

**Reason**: Rarely used, replaced by `include_all_columns` transformation (more flexible)

**Backward Compatibility**:
- Old mappings automatically cleaned during migration upgrade
- No data loss (fields were optional and rarely populated)
- Frontend silently filters deprecated fields with warning log

**Migration Logic**:
```sql
-- Remove keys from staging metadata
UPDATE t_import_staging
SET csv_metadata = csv_metadata - 'info1' - 'info2'
WHERE csv_metadata ? 'info1' OR csv_metadata ? 'info2';

-- Remove keys from column mappings
UPDATE t_import_column_mapping
SET mapping = mapping - 'csv_info1' - 'csv_info2'
WHERE mapping ? 'csv_info1' OR mapping ? 'csv_info2';
```

**Replacement**: Use `include_all_columns` transformation to capture all CSV metadata automatically

---

## References

- **Backend**: `/backend/app/api/v1/endpoints/import_endpoints.py`
- **Models**: `/backend/app/models/import_column_mapping.py`
- **Services**: `/backend/app/services/generic_csv_parser.py`
- **Frontend**: `/frontend/web/templates/admin_import.html`
- **Migration**: `/backend/db/migrations/versions/20251222_9baacd464951_revert_to_per_user_mappings.py`
- **Migration**: `/backend/db/migrations/versions/20251229_a1b2c3d4e5f6_remove_csv_info_fields.py` (v6.x)
- **CLAUDE.md**: Section "Import Column Mappings: Per-User Model"
