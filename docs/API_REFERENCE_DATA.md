# API Documentation: Reference Data Management

## Overview

The Reference Data API provides endpoints for managing core reference entities in the Family Budget system. All endpoints require authentication and return data filtered by the authenticated user.

## Base URL

```
https://api.familybudget.com/api
```

## Authentication

All requests must include the user context. Authentication is handled via Telegram OAuth.

### Headers

```
Authorization: Bearer {token}
Content-Type: application/json
```

## Common Response Format

### Success Response

```json
{
  "status": "success",
  "data": { ... },
  "meta": {
    "timestamp": "2024-01-20T10:30:00Z",
    "version": "1.0.0"
  }
}
```

### Error Response

```json
{
  "status": "error",
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": [
      {
        "field": "period_month",
        "message": "Month must be between 1 and 12"
      }
    ]
  },
  "meta": {
    "timestamp": "2024-01-20T10:30:00Z"
  }
}
```

## Endpoints

### Periods

#### List Periods

```http
GET /periods
```

Query Parameters:
- `is_active` (boolean) - Filter by active status
- `year` (integer) - Filter by year
- `month` (integer) - Filter by month
- `limit` (integer) - Page size (default: 100)
- `offset` (integer) - Skip records (default: 0)
- `sort` (string) - Sort field (e.g., "period_order", "-period_name")

Response:
```json
{
  "status": "success",
  "data": [
    {
      "period_id": 1,
      "period_name": "Январь 2024",
      "period_year": 2024,
      "period_month": 1,
      "period_order": 202401,
      "is_active": true,
      "user_id": 123,
      "created_at": "2024-01-01T00:00:00Z",
      "updated_at": "2024-01-01T00:00:00Z"
    }
  ],
  "meta": {
    "total": 12,
    "limit": 100,
    "offset": 0
  }
}
```

#### Get Period

```http
GET /periods/{period_id}
```

Response:
```json
{
  "status": "success",
  "data": {
    "period_id": 1,
    "period_name": "Январь 2024",
    "period_year": 2024,
    "period_month": 1,
    "period_order": 202401,
    "is_active": true,
    "user_id": 123,
    "created_at": "2024-01-01T00:00:00Z",
    "updated_at": "2024-01-01T00:00:00Z"
  }
}
```

#### Create Period

```http
POST /periods
```

Request Body:
```json
{
  "period_name": "Январь 2024",
  "period_year": 2024,
  "period_month": 1
}
```

Validation Rules:
- `period_name` - Required, max 100 characters
- `period_year` - Required, between 2000 and 2100
- `period_month` - Required, between 1 and 12
- Combination of year/month must be unique per user

Response:
```json
{
  "status": "success",
  "data": {
    "period_id": 1,
    "period_name": "Январь 2024",
    "period_year": 2024,
    "period_month": 1,
    "period_order": 202401,
    "is_active": true,
    "user_id": 123,
    "created_at": "2024-01-20T10:30:00Z",
    "updated_at": "2024-01-20T10:30:00Z"
  }
}
```

#### Update Period

```http
PUT /periods/{period_id}
```

Request Body:
```json
{
  "period_name": "Январь 2024 (обновлен)",
  "is_active": false
}
```

Note: `period_year` and `period_month` cannot be updated

#### Delete Period

```http
DELETE /periods/{period_id}
```

Soft delete - sets `is_active` to false

### Financial Centers

#### List Financial Centers

```http
GET /financial_centers
```

Query Parameters:
- `is_active` (boolean) - Filter by active status
- `parent_id` (integer) - Filter by parent
- `level` (integer) - Filter by hierarchy level
- `include_children` (boolean) - Include nested structure

Response:
```json
{
  "status": "success",
  "data": [
    {
      "financial_center_id": 1,
      "financial_center_name": "Головной офис",
      "financial_center_description": "Главный финансовый центр",
      "parent_id": null,
      "level": 0,
      "path": "1",
      "is_active": true,
      "user_id": 123,
      "created_at": "2024-01-01T00:00:00Z",
      "updated_at": "2024-01-01T00:00:00Z",
      "children": [
        {
          "financial_center_id": 2,
          "financial_center_name": "Филиал Москва",
          "parent_id": 1,
          "level": 1,
          "path": "1.2"
        }
      ]
    }
  ]
}
```

#### Create Financial Center

```http
POST /financial_centers
```

Request Body:
```json
{
  "financial_center_name": "Новый ЦФО",
  "financial_center_description": "Описание",
  "parent_id": 1
}
```

Validation Rules:
- `financial_center_name` - Required, max 255 characters
- `parent_id` - Optional, must exist and not create circular dependency
- Maximum hierarchy depth: 5 levels

#### Update Financial Center Hierarchy

```http
PUT /financial_centers/{id}/move
```

Request Body:
```json
{
  "new_parent_id": 5
}
```

Moves the financial center and all its children to a new parent.

### Cost Centers

#### List Cost Centers

```http
GET /cost_centers
```

Query Parameters:
- `financial_center_id` (integer) - Filter by financial center
- `has_budget` (boolean) - Filter by budget presence
- `budget_exceeded` (boolean) - Filter by budget status

Response:
```json
{
  "status": "success",
  "data": [
    {
      "cost_center_id": 1,
      "cost_center_name": "Маркетинг",
      "cost_center_description": "Отдел маркетинга",
      "financial_center_id": 1,
      "budget_limit": 500000,
      "budget_period": "monthly",
      "budget_used": 350000,
      "budget_percentage": 70,
      "is_active": true,
      "user_id": 123,
      "created_at": "2024-01-01T00:00:00Z",
      "updated_at": "2024-01-01T00:00:00Z",
      "financial_center": {
        "financial_center_id": 1,
        "financial_center_name": "Головной офис"
      }
    }
  ]
}
```

#### Create Cost Center

```http
POST /cost_centers
```

Request Body:
```json
{
  "cost_center_name": "Новый МВЗ",
  "cost_center_description": "Описание",
  "financial_center_id": 1,
  "budget_limit": 1000000,
  "budget_period": "monthly"
}
```

Validation Rules:
- `cost_center_name` - Required, max 255 characters
- `financial_center_id` - Required, must exist
- `budget_limit` - Optional, must be positive
- `budget_period` - Optional, one of: "monthly", "quarterly", "yearly"

#### Get Cost Center Statistics

```http
GET /cost_centers/{id}/statistics
```

Query Parameters:
- `period_id` (integer) - Specific period
- `date_from` (date) - Start date
- `date_to` (date) - End date

Response:
```json
{
  "status": "success",
  "data": {
    "budget_usage": [
      {
        "period": "2024-01",
        "budget_limit": 500000,
        "actual_spent": 350000,
        "percentage": 70
      }
    ],
    "transactions_count": 145,
    "average_transaction": 2413.79
  }
}
```

### Nomenclatures

#### List Nomenclatures

```http
GET /nomenclatures
```

Query Parameters:
- `nomenclature_type` (string) - Filter by type (INCOME/EXPENSE)
- `parent_id` (integer) - Filter by parent
- `include_tree` (boolean) - Return hierarchical structure

Response:
```json
{
  "status": "success",
  "data": [
    {
      "nomenclature_id": 1,
      "nomenclature_name": "Продукты питания",
      "nomenclature_type": "EXPENSE",
      "parent_id": null,
      "level": 0,
      "path": "1",
      "color": "#FF5733",
      "icon": "shopping-cart",
      "is_active": true,
      "user_id": 123,
      "created_at": "2024-01-01T00:00:00Z",
      "updated_at": "2024-01-01T00:00:00Z",
      "children": []
    }
  ]
}
```

#### Create Nomenclature

```http
POST /nomenclatures
```

Request Body:
```json
{
  "nomenclature_name": "Новая категория",
  "nomenclature_type": "EXPENSE",
  "parent_id": 1,
  "color": "#FF5733",
  "icon": "folder"
}
```

Validation Rules:
- `nomenclature_name` - Required, max 255 characters
- `nomenclature_type` - Required, one of: "INCOME", "EXPENSE"
- `parent_id` - Optional, must exist and be same type
- `color` - Optional, valid hex color
- `icon` - Optional, from predefined set

#### Bulk Update Nomenclature Type

```http
POST /nomenclatures/bulk-update-type
```

Request Body:
```json
{
  "nomenclature_ids": [1, 2, 3],
  "new_type": "INCOME"
}
```

Updates the type for multiple nomenclatures and their children.

### Products

#### List Products

```http
GET /products
```

Query Parameters:
- `search` (string) - Search in name
- `unit` (string) - Filter by unit
- `has_price` (boolean) - Filter by price presence

Response:
```json
{
  "status": "success",
  "data": [
    {
      "product_id": 1,
      "product_name": "Молоко",
      "unit": "л",
      "is_active": true,
      "user_id": 123,
      "created_at": "2024-01-01T00:00:00Z",
      "updated_at": "2024-01-01T00:00:00Z",
      "current_price": 89.90,
      "average_price": 85.50,
      "nomenclatures": [
        {
          "nomenclature_id": 5,
          "nomenclature_name": "Молочные продукты"
        }
      ]
    }
  ]
}
```

#### Create Product

```http
POST /products
```

Request Body:
```json
{
  "product_name": "Новый продукт",
  "unit": "кг",
  "initial_price": 150.00,
  "nomenclature_ids": [5, 10]
}
```

#### Update Product Price

```http
POST /products/{id}/price
```

Request Body:
```json
{
  "price": 175.50,
  "effective_date": "2024-01-20"
}
```

Creates a new price history entry.

#### Get Product Price History

```http
GET /products/{id}/price-history
```

Query Parameters:
- `date_from` (date) - Start date
- `date_to` (date) - End date
- `limit` (integer) - Number of records

Response:
```json
{
  "status": "success",
  "data": [
    {
      "price_id": 1,
      "product_id": 1,
      "price": 89.90,
      "effective_date": "2024-01-20",
      "created_at": "2024-01-20T10:00:00Z"
    }
  ]
}
```

### Bulk Operations

#### Import Data

```http
POST /bulk/import
```

Request Body (multipart/form-data):
- `file` - CSV or Excel file
- `entity_type` - One of: "periods", "financial_centers", "cost_centers", "nomenclatures", "products"
- `options` - JSON string with import options

Options:
```json
{
  "skipValidation": false,
  "updateExisting": true,
  "dryRun": false,
  "mappings": {
    "column1": "period_name",
    "column2": "period_year"
  }
}
```

Response:
```json
{
  "status": "success",
  "data": {
    "totalProcessed": 100,
    "successCount": 95,
    "errorCount": 5,
    "errors": [
      {
        "row": 5,
        "error": "Invalid month value: 13"
      }
    ]
  }
}
```

#### Export Data

```http
POST /bulk/export
```

Request Body:
```json
{
  "entity_type": "periods",
  "format": "excel",
  "filters": {
    "is_active": true,
    "year": 2024
  },
  "columns": ["period_name", "period_year", "period_month"]
}
```

Response: File download

#### Batch Update

```http
POST /bulk/update
```

Request Body:
```json
{
  "entity_type": "periods",
  "operations": [
    {
      "id": 1,
      "updates": {
        "is_active": false
      }
    },
    {
      "id": 2,
      "updates": {
        "period_name": "Updated name"
      }
    }
  ]
}
```

#### Batch Delete

```http
POST /bulk/delete
```

Request Body:
```json
{
  "entity_type": "periods",
  "ids": [1, 2, 3],
  "soft_delete": true
}
```

### Audit

#### Get Audit Logs

```http
GET /audit/logs
```

Query Parameters:
- `entity_type` (string) - Filter by entity
- `entity_id` (integer) - Specific entity
- `action` (string) - CREATE/UPDATE/DELETE/RESTORE
- `user_id` (integer) - Filter by user
- `date_from` (datetime) - Start date
- `date_to` (datetime) - End date
- `limit` (integer) - Page size
- `offset` (integer) - Skip records

Response:
```json
{
  "status": "success",
  "data": [
    {
      "audit_id": 1,
      "entity_type": "periods",
      "entity_id": 1,
      "action": "UPDATE",
      "user_id": 123,
      "timestamp": "2024-01-20T10:30:00Z",
      "old_values": {
        "period_name": "Old name"
      },
      "new_values": {
        "period_name": "New name"
      },
      "changes": [
        {
          "field": "period_name",
          "old_value": "Old name",
          "new_value": "New name"
        }
      ],
      "metadata": {
        "ip_address": "192.168.1.1",
        "user_agent": "Mozilla/5.0..."
      }
    }
  ]
}
```

#### Get Entity History

```http
GET /audit/history/{entity_type}/{entity_id}
```

Returns complete change history for a specific entity.

#### Restore Deleted Entity

```http
POST /audit/restore
```

Request Body:
```json
{
  "entity_type": "periods",
  "entity_id": 1,
  "restore_to_version": 5
}
```

### Search

#### Global Search

```http
GET /search
```

Query Parameters:
- `q` (string) - Search query
- `types` (array) - Entity types to search
- `limit` (integer) - Results per type

Response:
```json
{
  "status": "success",
  "data": {
    "periods": [
      {
        "period_id": 1,
        "period_name": "Январь 2024",
        "match_score": 0.95
      }
    ],
    "financial_centers": [],
    "cost_centers": [],
    "nomenclatures": [],
    "products": []
  }
}
```

## Error Codes

| Code | Description |
|------|-------------|
| `VALIDATION_ERROR` | Input validation failed |
| `NOT_FOUND` | Entity not found |
| `CONFLICT` | Conflict with existing data |
| `PERMISSION_DENIED` | Access denied |
| `BUDGET_EXCEEDED` | Budget limit exceeded |
| `CIRCULAR_DEPENDENCY` | Circular reference detected |
| `MAX_DEPTH_EXCEEDED` | Maximum hierarchy depth exceeded |
| `IMPORT_ERROR` | Import processing failed |
| `EXPORT_ERROR` | Export generation failed |

## Rate Limiting

- 1000 requests per hour per user
- Bulk operations: 10 per hour
- Export operations: 100 per hour

## Webhooks

Configure webhooks for real-time notifications:

```http
POST /webhooks
```

Request Body:
```json
{
  "url": "https://your-server.com/webhook",
  "events": ["period.created", "budget.exceeded"],
  "secret": "your-secret-key"
}
```

## SDK Examples

### JavaScript/TypeScript

```typescript
import { FamilyBudgetAPI } from '@familybudget/sdk';

const api = new FamilyBudgetAPI({
  token: 'your-token'
});

// List periods
const periods = await api.periods.list({
  year: 2024,
  is_active: true
});

// Create period
const newPeriod = await api.periods.create({
  period_name: 'Январь 2024',
  period_year: 2024,
  period_month: 1
});
```

### Python

```python
from familybudget import Client

client = Client(token='your-token')

# List periods
periods = client.periods.list(year=2024, is_active=True)

# Create period
new_period = client.periods.create(
    period_name='Январь 2024',
    period_year=2024,
    period_month=1
)
```

## Best Practices

1. **Pagination** - Always use pagination for list endpoints
2. **Filtering** - Use specific filters to reduce payload size
3. **Caching** - Implement client-side caching for reference data
4. **Batch Operations** - Use bulk endpoints for multiple operations
5. **Error Handling** - Implement exponential backoff for retries
6. **Audit Trail** - Subscribe to webhooks for critical changes