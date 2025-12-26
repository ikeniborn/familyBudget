# Recurring Plans Architecture

**Since version:** 6.2.0
**Author:** Claude Code
**Date:** 2025-12-26

## Overview

Recurring Plans система для автоматического создания повторяющихся транзакций (платежей, доходов) на регулярной основе. Поддерживает три типа периодичности: ежемесячно, ежеквартально, ежегодно.

## Frequency Types

### Monthly (Ежемесячно)
- **Description**: Генерирует факт каждый месяц на указанное число
- **frequency_value**: 1-28 (день месяца)
- **Example**: `frequency_value=15` → Факты 15-го числа каждого месяца

### Quarterly (Ежеквартально)
- **Description**: Генерирует факт каждый квартал на указанное число
- **frequency_value**: 1-28 (день месяца в январе, апреле, июле, октябре)
- **Example**: `frequency_value=10` → Факты 10-го января, апреля, июля, октября

### Yearly (Ежегодно)
- **Description**: Генерирует факт один раз в год на указанную дату
- **frequency_value**: 101-1231 (MMDD format)
- **Encoding**: `(month * 100) + day`
- **Examples**:
  - `frequency_value=115` → 15 января каждого года
  - `frequency_value=1231` → 31 декабря каждого года
  - `frequency_value=615` → 15 июня каждого года

**Validation Rules for Yearly:**
- Month: 1-12
- Day: 1-31, но должен быть валиден для выбранного месяца
- February 29 НЕ поддерживается (чтобы избежать сложностей с високосными годами)
- Невалидные даты отклоняются: 31 апреля, 30 февраля, 13 месяц, и т.д.

## Database Schema

```sql
CREATE TABLE t_d_recurring_plan (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    article_id INTEGER NOT NULL,
    financial_center_id INTEGER NOT NULL,
    cost_center_id INTEGER,

    -- Frequency configuration
    frequency_type VARCHAR(20) NOT NULL
        CHECK (frequency_type IN ('monthly', 'quarterly', 'yearly')),
    frequency_value INTEGER NOT NULL
        CHECK (
            (frequency_type = 'monthly' AND frequency_value BETWEEN 1 AND 28) OR
            (frequency_type = 'quarterly' AND frequency_value BETWEEN 1 AND 28) OR
            (frequency_type = 'yearly' AND frequency_value BETWEEN 101 AND 1231)
        )
        COMMENT ON COLUMN frequency_value IS
        'Day of month (1-28) for monthly/quarterly, MMDD format (101-1231) for yearly',

    -- Schedule
    start_date DATE NOT NULL,
    end_date DATE,
    occurrences_count INTEGER,
    occurrences_generated INTEGER DEFAULT 0,

    -- Transaction template
    amount DECIMAL(15,2) NOT NULL CHECK (amount > 0),
    description TEXT,
    record_type VARCHAR(10) NOT NULL,

    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    next_generation_date DATE,
    last_generated_date DATE,

    -- Audit
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

## Next Occurrence Calculation Logic

### Monthly
```python
current_date + 1 month, day = frequency_value
```

### Quarterly
```python
current_date + 3 months, day = frequency_value
```

### Yearly
1. Decode `frequency_value` → `month = value // 100`, `day = value % 100`
2. If `(current_month, current_day) >= (target_month, target_day)` → `next_year = current_year + 1`
3. Else → `next_year = current_year`
4. Return `date(next_year, month, day)`

**Example:**
```python
# March 15 every year (frequency_value=315)
_calculate_next_occurrence(from_date=date(2025, 1, 1))
# → date(2025, 3, 15)  # Before March 15 this year

_calculate_next_occurrence(from_date=date(2025, 3, 20))
# → date(2026, 3, 15)  # After March 15 this year
```

## Frontend Implementation

### Yearly frequency uses dual-select UI:
- **Month select**: 1-12 (Январь - Декабрь)
- **Day select**: 1-31 (validated against month)
- **Hidden input**: stores encoded `frequency_value` (MMDD)
- **On change**: validate day ≤ max_day_for_month, encode to MMDD

**Display format**: "Ежегодно, DD МЕСЯЦ" (e.g., "Ежегодно, 15 марта")

### UI Components
- **Modal**: `frontend/web/templates/components/modal_plan.html`
  - `#yearly-picker-{{ modal_id }}` - container for month/day selects
  - `select[name="frequency_value_month"]` - month selector
  - `select[name="frequency_value_day"]` - day selector
  - `input[name="frequency_value_yearly"]` - hidden input with MMDD value

- **JavaScript**: `frontend/web/templates/plan.html`
  - `updateFrequencyFields(modalId)` - show/hide pickers
  - `updateYearlyFrequencyValue(modalId)` - encode month+day → MMDD
  - `getFrequencyDisplayText(type, value)` - decode MMDD → readable text
  - `updateRecurringPreview(modalId)` - update preview panel

### Encoding/Decoding Examples

**Encoding (JS):**
```javascript
const month = 3;  // March
const day = 15;
const frequencyValue = (month * 100) + day;  // 315
```

**Decoding (JS):**
```javascript
const frequencyValue = 315;
const month = Math.floor(frequencyValue / 100);  // 3
const day = frequencyValue % 100;  // 15
const monthNames = ['января', 'февраля', ...];
const text = `Ежегодно, ${day} ${monthNames[month-1]}`;  // "Ежегодно, 15 марта"
```

**Decoding (Python):**
```python
frequency_value = 315
month = frequency_value // 100  # 3
day = frequency_value % 100  # 15
month_names = ["января", "февраля", "марта", ...]
text = f"Ежегодно, {day} {month_names[month-1]}"  # "Ежегодно, 15 марта"
```

## Backend Implementation

### Service: `RecurringPlanService`
**Location**: `backend/app/services/recurring_plan_service.py`

**Key methods:**
- `_calculate_next_occurrence()` - calculates next date based on frequency
- `_get_frequency_display()` - human-readable frequency description
- `_generate_facts_for_plan()` - generates BudgetFact records
- `generate_pending_facts()` - daily scheduler job

**Logging:**
```python
logger.info(
    f"[CALC_NEXT] Yearly: decoded frequency_value={frequency_value} → "
    f"month={target_month}, day={target_day}, from_date={from_date}"
)
logger.info(f"[CALC_NEXT] Yearly: {from_date} → {next_date}")
```

### Schema: `RecurringPlanCreate`
**Location**: `backend/app/schemas/recurring_plan.py`

**Validation:**
```python
@model_validator(mode="after")
def validate_frequency_value(self):
    if freq_type == "yearly":
        if not (101 <= freq_value <= 1231):
            raise ValueError("yearly frequency_value must be 101-1231 (MMDD format)")

        month = freq_value // 100
        day = freq_value % 100

        if not (1 <= month <= 12):
            raise ValueError(f"Invalid month: {month}")

        days_in_month = {1:31, 2:28, 3:31, ...}
        if not (1 <= day <= days_in_month[month]):
            raise ValueError(f"Invalid day {day} for month {month}")
```

## Migration

**File**: `backend/db/migrations/versions/20251226_e8e69b30e4db_add_yearly_frequency_remove_daily_weekly.py`

**Changes:**
- Removed 'daily' and 'weekly' from frequency_type CHECK constraint
- Added 'yearly' to frequency_type CHECK constraint
- Updated frequency_value CHECK constraint for yearly MMDD format (101-1231)
- Added column comment explaining yearly encoding

**Constraint Names:**
The migration uses actual database constraint names (not SQLAlchemy auto-generated names):
- `ck_recurring_plan_frequency_type` - Validates frequency_type values
- `ck_recurring_plan_frequency_value_range` - Validates frequency_value ranges

**Data Migration:**
⚠️ **CRITICAL:** Migration deletes existing daily/weekly recurring plans:
```sql
DELETE FROM t_d_recurring_plan
WHERE frequency_type IN ('daily', 'weekly')
```

**Impact:**
- All daily and weekly recurring plans will be **permanently deleted**
- Users should be notified to recreate plans as monthly/quarterly/yearly
- Test data with empty descriptions will be removed

**Before Migration:**
If production data exists, export daily/weekly plans:
```sql
-- Export daily/weekly plans for manual conversion
SELECT * FROM t_d_recurring_plan
WHERE frequency_type IN ('daily', 'weekly');
```

**Troubleshooting:**
If migration fails with "constraint does not exist", verify actual constraint names:
```sql
SELECT conname, contype FROM pg_constraint
WHERE conrelid = 't_d_recurring_plan'::regclass;
```

## Testing

### Backend Test Example
```python
from backend.app.schemas.recurring_plan import RecurringPlanCreate

# Valid yearly values
plan = RecurringPlanCreate(
    article_id=1, financial_center_id=1, amount=100,
    frequency_type="yearly", frequency_value=315,  # March 15
    start_date="2025-01-01", description="Annual insurance"
)

# Invalid yearly values (will raise ValueError)
plan = RecurringPlanCreate(..., frequency_value=229)  # Feb 29 - not allowed
plan = RecurringPlanCreate(..., frequency_value=431)  # Apr 31 - invalid
plan = RecurringPlanCreate(..., frequency_value=1232)  # Dec 32 - invalid
```

### Frontend Test Checklist
- [ ] Open recurring plans page (/plan)
- [ ] Click "Создать план"
- [ ] Select "Ежегодно" frequency
- [ ] Verify month/day selects appear
- [ ] Select March + 15
- [ ] Verify preview shows "Ежегодно, 15 марта"
- [ ] Try invalid combinations (Feb 31) - should alert
- [ ] Submit form - verify plan created
- [ ] Check browser console for `[PLAN]` logs

### Database Test
```sql
-- Create yearly plan (March 15, start 2025-01-01)
INSERT INTO t_d_recurring_plan (frequency_type, frequency_value, ...)
VALUES ('yearly', 315, ...);

-- Verify facts generated
SELECT fact_date FROM t_f_budget_fact
WHERE recurring_plan_id = <plan_id>
ORDER BY fact_date;

-- Expected: 2025-03-15, 2026-03-15, 2027-03-15...
```

## Limitations

1. **Feb 29 not supported** - To avoid leap year complexity
2. **Days 29-31** - Not supported for monthly/quarterly (for stability across all months)
3. **MMDD encoding range** - Limited to 101-1231 (cannot exceed December 31)

## Related Files

| Component | File | Lines |
|-----------|------|-------|
| Backend Schema | `backend/app/schemas/recurring_plan.py` | 17, 127-175 |
| Backend Service | `backend/app/services/recurring_plan_service.py` | 670-809 |
| Migration | `backend/db/migrations/versions/20251226_*.py` | 30-87 |
| Frontend Modal | `frontend/web/templates/components/modal_plan.html` | 134-187 |
| Frontend JS | `frontend/web/templates/plan.html` | 2722-2743, 4358-4424, 4486-4516 |

## See Also

- [CLAUDE.md](../../CLAUDE.md) - Development guidelines
- [PRD: Recurring Plans](../prd/recurring-plans.md) - Product requirements
- [Migration Guide](../guides/migration-guide.md) - Database migration process
