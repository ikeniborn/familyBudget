# ADR-005: Timezone Handling for Database Storage

## Status
Accepted

## Date
2025-09-14

## Context
The application was experiencing critical errors when creating periods due to timezone mismatches. PostgreSQL database columns were defined as `TIMESTAMP WITHOUT TIME ZONE`, but the frontend was sending timezone-aware datetime objects with UTC timezone information. This caused SQLAlchemy to throw errors: "can't subtract offset-naive and offset-aware datetimes".

## Decision
We implemented a centralized timezone handling strategy that:
1. Strips timezone information from datetime objects before database storage
2. Maintains UTC consistency for all timestamps
3. Handles both timezone-aware and naive datetime inputs gracefully

## Implementation
- Created timezone utility module (`app/core/timezone.py`) with conversion functions
- Updated all period endpoints to use timezone utilities before database operations
- Added comprehensive error handling for various datetime formats

## Consequences
### Positive
- Eliminates timezone-related database errors
- Maintains data consistency across the application
- Provides backward compatibility with existing data
- Centralizes timezone handling logic for maintainability

### Negative
- Slight performance overhead for datetime conversion
- All timestamps stored without timezone information (mitigated by UTC standardization)

## Technical Details
### Utility Functions
- `prepare_datetime_for_db()`: Converts timezone-aware to naive UTC
- `prepare_datetime_fields_for_db()`: Bulk processes multiple datetime fields
- `get_utc_now()`: Returns current UTC time without timezone
- `ensure_utc_for_comparison()`: Normalizes datetimes for comparison

### Test Coverage
- 37 comprehensive unit tests
- 100% code coverage for timezone utilities
- Integration tests for API endpoints

## References
- Issue: Period creation error for user test5
- Fix PR: Timezone handling implementation
- Tests: `/tests/test_timezone_utils.py`