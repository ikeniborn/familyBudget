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
- Auto-detects delimiter (`;`, `,`, `\t`) and encoding (UTF-8, Windows-1251)

**Timeout Protection:**
- Frontend timeout: 30s (AbortController)
- Loading spinner during analysis
- User-friendly error messages for timeout/network failures

### Step 3: Column Mapping
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

### Radio Buttons Visibility on Restart (Fixed 2025-12-23)

**Problem**: When restarting import wizard (Step 1 → Step 2), radio buttons for source selection (CSV/Google Sheets) were not visible.

**Root Cause**: Radio buttons container was hidden after first file upload and not restored in `proceedToUpload()` or `resetWorkflow()`.

**Fix**: Restore radio buttons container visibility in both functions.

**Files**: `frontend/web/templates/admin_import.html:1345-1349,1080-1084`

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

## References

- **Backend**: `/backend/app/api/v1/endpoints/import_endpoints.py`
- **Models**: `/backend/app/models/import_column_mapping.py`
- **Services**: `/backend/app/services/mapping_service.py`
- **Frontend**: `/frontend/web/templates/admin_import.html`
- **Migration**: `/backend/db/migrations/versions/20251222_9baacd464951_revert_to_per_user_mappings.py`
- **CLAUDE.md**: Section "Import Column Mappings: Per-User Model"
