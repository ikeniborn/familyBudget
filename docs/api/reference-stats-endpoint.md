# Reference Statistics API Endpoint

## Overview

The `/api/reports/reference-stats` endpoint provides reference data statistics for the Family Budget application. This endpoint returns counts of various reference data entities that are available to the current user.

**Endpoint**: `GET /api/reports/reference-stats`
**Authentication**: Required
**Added**: 2025-09-15

## Response Format

Returns a unified API response with the following structure:

```json
{
  "success": true,
  "data": {
    "total_periods": 12,
    "active_periods": 8,
    "financial_centers": 3,
    "nomenclatures": 25,
    "products": 150
  }
}
```

## Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `total_periods` | integer | Total count of budget periods (user-specific + shared) |
| `active_periods` | integer | Count of periods within the last year from current date |
| `financial_centers` | integer | Count of financial centers (ЦФО - user-specific + shared) |
| `nomenclatures` | integer | Count of budget nomenclatures/categories (user-specific + shared) |
| `products` | integer | Count of products linked to user's nomenclatures |

## Data Isolation

The endpoint properly implements user data isolation:

- **User-specific data**: Records where `user_id = current_user.id`
- **Shared data**: Records where `user_id IS NULL` (admin-managed shared reference data)
- **Excluded**: Other users' private data (`user_id != current_user.id`)

## Active Periods Logic

Active periods are defined as periods with a date within the last 365 days from the current date:

```sql
WHERE period_dt >= (CURRENT_DATE - INTERVAL '1 year')
```

## Products Calculation

Products are counted through their association with nomenclatures:

```sql
SELECT COUNT(DISTINCT product_id)
FROM t_l_product_nomenclature
JOIN t_d_nomenclature ON nomenclature_id = nomenclature_id
WHERE (nomenclature.user_id = current_user_id OR nomenclature.user_id IS NULL)
```

Since products themselves don't have user ownership, they are counted based on their linkage to nomenclatures that the user has access to.

## Error Responses

### 401 Unauthorized
```json
{
  "detail": "Not authenticated"
}
```

### 500 Internal Server Error
```json
{
  "success": false,
  "error": "Internal server error description"
}
```

## Usage Examples

### cURL Request
```bash
curl -X GET "http://localhost:4000/api/reports/reference-stats" \
  -H "Cookie: connect.sid=your-session-cookie" \
  -H "Content-Type: application/json"
```

### JavaScript/Fetch
```javascript
const response = await fetch('/api/reports/reference-stats', {
  method: 'GET',
  credentials: 'include',
  headers: {
    'Content-Type': 'application/json'
  }
});

const data = await response.json();
if (data.success) {
  console.log('Statistics:', data.data);
}
```

### Python/httpx
```python
import httpx

async with httpx.AsyncClient() as client:
    response = await client.get(
        'http://localhost:4000/api/reports/reference-stats',
        cookies={'connect.sid': 'your-session-cookie'}
    )
    data = response.json()
    if data['success']:
        stats = data['data']
```

## Implementation Details

### Location
- **File**: `backend-fastapi/app/api/v1/endpoints/reports.py`
- **Function**: `get_reference_stats()`
- **Router**: Included in reports router with `/reports` prefix

### Dependencies
- `Request`: FastAPI request object
- `AsyncSession`: Database session dependency
- `require_auth`: Authentication dependency that provides current user

### Database Models Used
- `Period`: Budget periods
- `FinancialCenter`: Financial responsibility centers
- `Nomenclature`: Budget categories
- `Product`: Product catalog
- `ProductNomenclature`: Product-nomenclature junction table

### SQL Queries Generated
The endpoint executes 5 optimized COUNT queries:

1. Total periods count
2. Active periods count (with date filter)
3. Financial centers count
4. Nomenclatures count
5. Products count (with JOIN)

All queries include proper user isolation filters.

## Testing

The endpoint can be manually tested using the verification script:

```bash
docker exec budget-backend python3 -c "
from app.api.v1.endpoints.reports import get_reference_stats
# Manual testing logic here
"
```

## Performance Considerations

- All queries use COUNT operations which are optimized
- Proper indexes exist on user_id fields for efficient filtering
- Date filtering on periods uses indexed date columns
- Product counting uses optimized JOIN with nomenclatures

## Frontend Integration

This endpoint is designed to replace mock data in settings pages and provide real statistics for:

- Dashboard statistics cards
- Settings page overview metrics
- Administrative reporting interfaces

The response format is compatible with existing frontend components expecting reference data statistics.