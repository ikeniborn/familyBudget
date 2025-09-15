# Nomenclature API Changes

## Version 3.3.0 - Simplified Nomenclature Form

### Summary
Removed unnecessary fields from the nomenclature management interface to simplify data entry and improve user experience.

### Changes Made

#### Backend Changes

1. **Schema Updates** (`app/schemas/nomenclature.py`)
   - Made `account_name`, `bill_name`, and `operation` fields optional
   - Changed from required (`str`) to optional (`Optional[str] = None`)
   - Maintained backward compatibility with existing data

2. **Model Updates** (`app/models/nomenclature.py`)
   - Updated database columns to allow NULL values
   - Changed `nullable=False` to `nullable=True` for:
     - `account_name`
     - `bill_name`
     - `operation_name` (mapped to `operation` field)

3. **Database Migration** (`alembic/versions/ba29b9c1f48d_make_nomenclature_fields_optional.py`)
   - Created migration to alter columns to nullable
   - Existing data preserved with no data loss
   - Rollback capability included

#### Frontend Changes

1. **Form Simplification** (`src/routes/(protected)/settings/nomenclatures/+page.svelte`)
   - Removed form fields for:
     - "Название счета" (account_name)
     - "Название счета к оплате" (bill_name)
     - "Операция" (operation)
   - Updated form data handling to exclude these fields
   - Simplified API request payloads

2. **TypeScript Updates** (`src/lib/types/index.ts`)
   - Made corresponding fields optional in `Nomenclature` interface
   - Added `?` modifier to optional fields

3. **Service Layer Updates** (`src/lib/services/nomenclatures.service.ts`)
   - Updated create/update data interfaces
   - Removed optional fields from CSV export
   - Improved data mapping for optional fields

### API Schema

#### Current Schema (v3.3.0)

```typescript
interface Nomenclature {
  id: number;
  code: string;                    // Required
  name: string;                    // Required
  account_name?: string;           // Optional (deprecated)
  bill_name?: string;              // Optional (deprecated)
  operation?: string;              // Optional (deprecated)
  operation_name?: string;         // Optional (deprecated)
  description?: string;            // Optional
  nomenclature_type?: string;      // Optional
  is_budget: boolean;              // Required
  is_fact: boolean;                // Required
  is_active: boolean;              // Required
  user_id: number;                 // Required (auto-set)
  created_at: string;              // Auto-generated
  updated_at: string;              // Auto-generated
}
```

#### API Request Examples

**Create Nomenclature (Minimal)**
```json
POST /api/nomenclatures/
{
  "code": "001",
  "name": "Продукты питания",
  "is_budget": true,
  "is_fact": true
}
```

**Create Nomenclature (With Optional Fields)**
```json
POST /api/nomenclatures/
{
  "code": "002",
  "name": "Транспорт",
  "description": "Расходы на транспорт",
  "nomenclature_type": "Расходы",
  "is_budget": true,
  "is_fact": true,
  "is_active": true
}
```

**Update Nomenclature**
```json
PUT /api/nomenclatures/{id}
{
  "code": "001",
  "name": "Продукты питания - обновлено",
  "description": "Обновленное описание",
  "is_active": false
}
```

### Migration Guide

#### For Frontend Developers
1. Remove any form validation for `account_name`, `bill_name`, `operation` fields
2. Update form submissions to exclude these fields
3. Handle null values when displaying existing data

#### For API Consumers
1. Stop sending `account_name`, `bill_name`, `operation` in requests
2. These fields will be ignored if sent (backward compatibility)
3. Expect null values for these fields in responses

#### Database Migration
```bash
# Apply migration
docker exec budget-backend alembic upgrade head

# Rollback if needed
docker exec budget-backend alembic downgrade -1
```

### Backward Compatibility

- ✅ Existing records with these fields continue to work
- ✅ API accepts requests with or without optional fields
- ✅ No breaking changes for existing clients
- ✅ Gradual migration path available

### Benefits

1. **Simplified User Interface**: Reduced form complexity
2. **Improved Data Quality**: No need for dummy values in unused fields
3. **Better Performance**: Smaller payloads and faster form submissions
4. **Clearer Data Model**: NULL values indicate "not specified" vs empty strings

### Testing

Comprehensive tests have been added:
- Backend: `/tests/backend/test_nomenclature_simplified_form.py`
- Frontend: `/tests/frontend/nomenclature-types-validation.test.ts`
- Manual: `/tests/manual/test_nomenclature_api_simplified.py`

### Future Considerations

These fields (`account_name`, `bill_name`, `operation`) are marked as deprecated and may be removed entirely in a future major version (v4.0.0). Plan to migrate any dependent functionality before the next major release.