# Business Rules Documentation: Reference Data Management

## Overview

This document describes the business rules and validation logic implemented in the Family Budget reference data management system. These rules ensure data integrity, consistency, and proper business logic enforcement.

## General Rules

### Multi-tenancy
- **Rule**: All data is isolated by user
- **Implementation**: Every entity has a `user_id` field that is automatically set from the authenticated user
- **Validation**: Users can only access and modify their own data
- **Exception**: None

### Soft Delete Pattern
- **Rule**: Data is never physically deleted
- **Implementation**: Entities have an `is_active` boolean field
- **Validation**: Delete operations set `is_active = false`
- **Recovery**: Deleted records can be restored through audit history

### Audit Trail
- **Rule**: All changes must be tracked
- **Implementation**: Every CREATE, UPDATE, DELETE operation is logged
- **Validation**: Audit logs cannot be modified or deleted
- **Retention**: Audit logs are retained indefinitely

## Period-Specific Rules

### Period Uniqueness
- **Rule**: Only one period per year/month combination per user
- **Validation**: 
  ```sql
  UNIQUE(user_id, period_year, period_month)
  ```
- **Error**: "Period for {month}/{year} already exists"
- **Business Reason**: Prevents duplicate financial periods

### Period Date Validation
- **Rule**: Month must be between 1-12
- **Validation**: `period_month >= 1 AND period_month <= 12`
- **Error**: "Month must be between 1 and 12"
- **Business Reason**: Ensures valid calendar months

### Period Year Range
- **Rule**: Year must be between 2000-2100
- **Validation**: `period_year >= 2000 AND period_year <= 2100`
- **Error**: "Year must be between 2000 and 2100"
- **Business Reason**: Reasonable date range for financial planning

### Period Order Calculation
- **Rule**: Automatic calculation of sort order
- **Formula**: `period_order = period_year * 100 + period_month`
- **Example**: January 2024 = 202401
- **Business Reason**: Enables efficient chronological sorting

### Period Activation Rules
- **Rule**: Inactive periods cannot be used in transactions
- **Validation**: Check `is_active = true` when creating transactions
- **Error**: "Cannot use inactive period"
- **Business Reason**: Prevents accidental use of closed periods

## Financial Center Rules

### Hierarchy Depth Limit
- **Rule**: Maximum 5 levels of nesting
- **Validation**: Count parent chain length <= 5
- **Error**: "Maximum hierarchy depth (5 levels) exceeded"
- **Business Reason**: Prevents overly complex organizational structures

### Circular Dependency Prevention
- **Rule**: A financial center cannot be its own parent
- **Validation**: Check entire parent chain for circular references
- **Error**: "Circular dependency detected"
- **Algorithm**:
  ```
  1. Start from proposed parent
  2. Follow parent chain upward
  3. If current node found in chain, reject
  ```

### Parent Type Consistency
- **Rule**: Parent must be an active financial center
- **Validation**: `parent.is_active = true`
- **Error**: "Parent financial center is inactive"
- **Business Reason**: Maintains hierarchy integrity

### Cascade Deactivation
- **Rule**: Deactivating a parent deactivates all children
- **Implementation**: Recursive update of child nodes
- **Warning**: "This will deactivate {count} child centers"
- **Business Reason**: Prevents orphaned active nodes

### Path Management
- **Rule**: Materialized path for efficient queries
- **Format**: `{parent_path}.{current_id}`
- **Example**: "1.5.12" (third level node)
- **Update**: Recalculate on parent change

## Cost Center Rules

### Financial Center Assignment
- **Rule**: Every cost center must belong to a financial center
- **Validation**: `financial_center_id` NOT NULL and exists
- **Error**: "Financial center is required"
- **Business Reason**: Ensures organizational alignment

### Budget Limit Validation
- **Rule**: Budget limit must be positive if specified
- **Validation**: `budget_limit IS NULL OR budget_limit > 0`
- **Error**: "Budget limit must be positive"
- **Business Reason**: Prevents invalid budget constraints

### Budget Period Validation
- **Rule**: Valid budget periods only
- **Validation**: `budget_period IN ('monthly', 'quarterly', 'yearly')`
- **Error**: "Invalid budget period"
- **Business Reason**: Standardizes budget cycles

### Budget Usage Calculation
- **Rule**: Track actual vs. budget in real-time
- **Formula**: 
  ```
  usage_percentage = (actual_amount / budget_limit) * 100
  ```
- **Thresholds**:
  - 80%: Warning notification
  - 90%: Critical warning
  - 100%: Block new expenses (configurable)

### Budget Period Conversion
- **Rule**: Convert all budgets to monthly for comparison
- **Conversion**:
  - Monthly: `limit`
  - Quarterly: `limit / 3`
  - Yearly: `limit / 12`
- **Business Reason**: Enables cross-period comparisons

## Nomenclature Rules

### Type Inheritance
- **Rule**: Child nomenclatures inherit parent type
- **Validation**: `child.type = parent.type`
- **Error**: "Child must have same type as parent"
- **Business Reason**: Maintains category consistency

### Type Immutability
- **Rule**: Cannot change type if has children
- **Validation**: Check for existing children before type change
- **Error**: "Cannot change type with existing children"
- **Business Reason**: Prevents data inconsistency

### Color Format Validation
- **Rule**: Colors must be valid hex format
- **Validation**: Regex `^#[0-9A-Fa-f]{6}$`
- **Error**: "Invalid color format. Use #RRGGBB"
- **Default**: Type-based defaults (Income: #10B981, Expense: #EF4444)

### Icon Validation
- **Rule**: Icons from predefined set only
- **Validation**: Check against allowed icon list
- **Error**: "Invalid icon name"
- **Business Reason**: Ensures UI consistency

### Hierarchy Depth
- **Rule**: Maximum 5 levels for nomenclatures
- **Validation**: Same as financial centers
- **Business Reason**: Maintains manageable categorization

### Active Parent Rule
- **Rule**: Cannot activate if parent is inactive
- **Validation**: Check parent status on activation
- **Error**: "Cannot activate with inactive parent"
- **Business Reason**: Maintains hierarchy consistency

## Product Rules

### Name Uniqueness
- **Rule**: Product names unique per user
- **Validation**: `UNIQUE(user_id, product_name)`
- **Error**: "Product with this name already exists"
- **Business Reason**: Prevents duplicate products

### Unit Validation
- **Rule**: Standard units of measurement
- **Validation**: Predefined list or custom with approval
- **Standard Units**: кг, г, л, мл, шт, уп, м, см
- **Business Reason**: Enables quantity calculations

### Price History Rules
- **Rule**: Prices are immutable once set
- **Implementation**: New price creates new history record
- **Validation**: Cannot modify existing price records
- **Business Reason**: Maintains accurate price history

### Price Effective Date
- **Rule**: No future-dated prices
- **Validation**: `effective_date <= CURRENT_DATE`
- **Error**: "Cannot set future prices"
- **Business Reason**: Reflects actual market prices

### Product-Nomenclature Mapping
- **Rule**: Product must have at least one category
- **Validation**: At least one nomenclature link required
- **Error**: "Product must belong to at least one category"
- **Business Reason**: Ensures proper categorization

## Validation Layers

### 1. Client-Side Validation
- Field format checking
- Required field validation
- Basic business rules
- Real-time feedback

### 2. API Validation
- Complete business rule validation
- Cross-entity validation
- Referential integrity
- User permissions

### 3. Database Constraints
- Foreign key constraints
- Unique constraints
- Check constraints
- Trigger-based validation

## Conflict Resolution Rules

### Update Conflicts
- **Rule**: Last-write-wins with conflict detection
- **Implementation**: Compare `updated_at` timestamps
- **Detection**: Client version != server version
- **Resolution Options**:
  1. Accept server version
  2. Force client version
  3. Manual merge

### Duplicate Detection
- **Rule**: Fuzzy matching for potential duplicates
- **Algorithm**: Levenshtein distance < 3
- **Warning**: "Similar entry exists: {name}"
- **User Action**: Confirm or cancel

### Cascade Operations
- **Rule**: Explicit confirmation for cascade impacts
- **Affected Operations**:
  - Delete parent with children
  - Deactivate parent
  - Change nomenclature type
- **UI**: Show impact summary before confirmation

## Performance Rules

### Pagination Requirements
- **Rule**: All list operations must be paginated
- **Default Limit**: 100 records
- **Maximum Limit**: 1000 records
- **Implementation**: LIMIT/OFFSET or cursor-based

### Caching Strategy
- **Rule**: Reference data cached for 5 minutes
- **Invalidation**: On any write operation
- **Scope**: Per-user cache isolation
- **Implementation**: Redis or in-memory

### Bulk Operation Limits
- **Rule**: Chunk large operations
- **Limits**:
  - Import: 10,000 records per file
  - Export: 50,000 records per request
  - Batch Update: 1,000 records per operation
  - Chunk Size: 100 records

## Security Rules

### Data Access
- **Rule**: Row-level security by user_id
- **Implementation**: All queries filtered by authenticated user
- **Validation**: Verify user_id match on updates
- **Error**: "Access denied"

### Audit Information
- **Rule**: Capture request context
- **Required Data**:
  - User ID
  - Timestamp
  - IP Address
  - User Agent
  - Session ID
- **Storage**: Append-only audit table

### Sensitive Data
- **Rule**: No PII in reference data
- **Validation**: Check for patterns (phone, email, SSN)
- **Error**: "Personal information not allowed"
- **Business Reason**: Privacy compliance

## Integration Rules

### API Rate Limits
- **Standard Operations**: 1000/hour
- **Bulk Operations**: 10/hour
- **Export Operations**: 100/hour
- **Implementation**: Token bucket algorithm

### Webhook Delivery
- **Rule**: At-least-once delivery guarantee
- **Retry Strategy**: Exponential backoff
- **Max Retries**: 5
- **Timeout**: 30 seconds

### Data Consistency
- **Rule**: Eventually consistent for read operations
- **Write Consistency**: Strong consistency required
- **Sync Delay**: Maximum 5 seconds
- **Implementation**: Event sourcing pattern