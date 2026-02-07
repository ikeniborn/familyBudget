# Database Schema

**Type**: Entity Relationship Diagram
**Purpose**: Comprehensive view of PostgreSQL database schema with 39 tables
**Last Updated**: 2026-02-07

## Overview

Family Budget uses PostgreSQL 16 with:
- **39 tables** organized in 5 groups
- **Star Schema** (1 fact table + 4 dimension tables)
- **Closure Table** pattern for hierarchical categories
- **SCD Type 2** history tracking (8 history tables)
- **Table Partitioning** (96 monthly partitions on fact table)

---

## Star Schema (Core Analytics)

```mermaid
erDiagram
    t_f_budget_fact ||--o{ t_d_article : "article_id"
    t_f_budget_fact ||--o{ t_d_user : "user_id"
    t_f_budget_fact ||--o{ t_d_currency : "currency_id"
    t_f_budget_fact ||--o{ t_d_account : "account_id"

    t_f_budget_fact {
        bigint budget_fact_id PK
        date fact_date "Partition Key"
        bigint article_id FK
        bigint user_id FK
        smallint currency_id FK
        integer account_id FK
        bigint amount_cents "Stored in cents"
        varchar fact_type "fact|plan|transfer"
        bigint linked_fact_id "For transfers"
        timestamp created_at
        timestamp updated_at
    }

    t_d_article {
        bigint article_id PK
        varchar article_name
        varchar article_category "income|expense"
        boolean is_active
        integer display_order
        timestamp created_at
    }

    t_d_user {
        bigint user_id PK
        varchar username
        varchar email
        bigint telegram_user_id UK
        varchar role "user|admin"
        timestamp created_at
    }

    t_d_currency {
        smallint currency_id PK
        varchar currency_code "RUB|USD|EUR"
        varchar currency_symbol
        smallint decimal_places "0|2"
    }

    t_d_account {
        integer account_id PK
        varchar account_name
        varchar account_type "cash|card|deposit"
        boolean is_active
        timestamp created_at
    }
```

### Partition Strategy

```mermaid
graph LR
    subgraph "t_f_budget_fact (Parent Table)"
        direction TB
        Parent[Partitioned by fact_date<br/>RANGE monthly]
    end

    subgraph "96 Monthly Partitions"
        P202201[fact_202201<br/>2022-01-01 to 2022-01-31]
        P202202[fact_202202<br/>2022-02-01 to 2022-02-28]
        P202203[fact_202203<br/>...]
        Pdots[...]
        P202601[fact_202601<br/>2026-01-01 to 2026-01-31]
        P202602[fact_202602<br/>2026-02-01 to 2026-02-28]
    end

    Parent --> P202201
    Parent --> P202202
    Parent --> P202203
    Parent --> Pdots
    Parent --> P202601
    Parent --> P202602

    style Parent fill:#FF9800,stroke:#E65100,color:#fff
    style P202601 fill:#4CAF50,stroke:#2E7D32,color:#fff
    style P202602 fill:#4CAF50,stroke:#2E7D32,color:#fff
```

**Security Note**: Queries WITHOUT `fact_date` filter scan all 96 partitions → performance penalty enforced

---

## Closure Table Pattern (Hierarchical Categories)

```mermaid
erDiagram
    t_d_article ||--o{ t_d_article_hierarchy : "ancestor_id"
    t_d_article ||--o{ t_d_article_hierarchy : "descendant_id"

    t_d_article {
        bigint article_id PK
        varchar article_name
        varchar article_category
        boolean is_active
    }

    t_d_article_hierarchy {
        bigint ancestor_id FK "Parent category"
        bigint descendant_id FK "Child category"
        integer depth "0=self, 1=child, 2=grandchild"
    }
```

### Example Hierarchy

```
Food (ancestor_id=1)
├── Groceries (descendant_id=2, depth=1)
│   ├── Vegetables (descendant_id=3, depth=2)
│   └── Meat (descendant_id=4, depth=2)
└── Restaurants (descendant_id=5, depth=1)
```

**Closure Table Records**:
```sql
-- Self-references (depth=0)
(1,1,0), (2,2,0), (3,3,0), (4,4,0), (5,5,0)
-- Direct children (depth=1)
(1,2,1), (1,5,1), (2,3,1), (2,4,1)
-- Grandchildren (depth=2)
(1,3,2), (1,4,2)
```

**Benefits**:
- Retrieve all descendants: `SELECT * WHERE ancestor_id = 1`
- Retrieve all ancestors: `SELECT * WHERE descendant_id = 3`
- Check if ancestor: `SELECT 1 WHERE ancestor_id = 1 AND descendant_id = 3`

---

## SCD Type 2 History Tables

```mermaid
erDiagram
    t_d_article ||--o{ t_d_article_history : "article_id"
    t_d_user ||--o{ t_d_user_history : "user_id"
    t_d_currency ||--o{ t_d_currency_history : "currency_id"
    t_d_account ||--o{ t_d_account_history : "account_id"
    t_f_budget_fact ||--o{ t_f_budget_fact_history : "budget_fact_id"
    t_s_recurring_plan ||--o{ t_s_recurring_plan_history : "recurring_plan_id"
    t_s_shopping_list ||--o{ t_s_shopping_list_history : "shopping_list_id"
    t_s_shopping_item ||--o{ t_s_shopping_item_history : "shopping_item_id"

    t_d_article_history {
        bigint history_id PK
        bigint article_id FK
        varchar article_name
        timestamp valid_from "Start of validity"
        timestamp valid_to "End of validity (NULL = current)"
        varchar change_type "INSERT|UPDATE|DELETE"
        bigint changed_by_user_id
    }
```

**SCD Type 2 Strategy**:
- Every change creates new history record
- `valid_from` = timestamp of change
- `valid_to` = NULL for current version, timestamp for historical
- Enables time-travel queries: "What was the category name on 2025-01-15?"

---

## Full Schema (39 Tables)

### Dimension Tables (Core)
```mermaid
graph TB
    subgraph "Core Dimensions"
        article[t_d_article<br/>Categories]
        user[t_d_user<br/>Users]
        currency[t_d_currency<br/>Currencies]
        account[t_d_account<br/>Accounts]
        family[t_d_family<br/>Family Groups]
    end

    subgraph "Supporting Tables"
        user_family[t_d_user_family<br/>User-Family Links]
        article_hierarchy[t_d_article_hierarchy<br/>Closure Table]
    end

    user -->|M:N| user_family
    family -->|M:N| user_family
    article -->|Self-Join| article_hierarchy

    style article fill:#7CB342,stroke:#558B2F,color:#fff
    style user fill:#2196F3,stroke:#1565C0,color:#fff
    style currency fill:#FF9800,stroke:#E65100,color:#fff
    style account fill:#9C27B0,stroke:#6A1B9A,color:#fff
    style family fill:#F44336,stroke:#C62828,color:#fff
```

### Fact Tables
```mermaid
graph TB
    subgraph "Transactional Data"
        fact[t_f_budget_fact<br/>96 partitions]
    end

    style fact fill:#FF5722,stroke:#D84315,color:#fff
```

### Session & Auth Tables
```mermaid
graph TB
    subgraph "Authentication"
        sessions[user_sessions<br/>JWT refresh tokens]
        webauthn_cred[webauthn_credentials<br/>Biometric public keys]
        webauthn_challenge[webauthn_challenges<br/>Challenge-response]
        totp[totp_secrets<br/>2FA secrets]
        backup_codes[backup_codes<br/>2FA recovery]
    end

    style sessions fill:#3F51B5,stroke:#283593,color:#fff
```

### Recurring Plans
```mermaid
graph TB
    subgraph "Recurring Payments"
        recurring_plan[t_s_recurring_plan<br/>Templates]
        recurring_exec[t_s_recurring_execution<br/>Execution log]
    end

    recurring_plan -->|1:N| recurring_exec

    style recurring_plan fill:#00BCD4,stroke:#0097A7,color:#fff
```

### Shopping Lists
```mermaid
graph TB
    subgraph "Shopping Lists (Offline-First)"
        shopping_list[t_s_shopping_list<br/>Lists]
        shopping_item[t_s_shopping_item<br/>Items]
        shopping_share[t_s_shopping_list_share<br/>Shared access]
    end

    shopping_list -->|1:N| shopping_item
    shopping_list -->|M:N| shopping_share

    style shopping_list fill:#4CAF50,stroke:#2E7D32,color:#fff
```

### Notifications
```mermaid
graph TB
    subgraph "Notifications"
        notification[t_s_notification<br/>Messages]
        web_push[web_push_subscriptions<br/>VAPID endpoints]
    end

    style notification fill:#FF9800,stroke:#E65100,color:#fff
```

### History Tables (SCD Type 2)
```mermaid
graph TB
    subgraph "Audit Trail"
        article_history[t_d_article_history]
        user_history[t_d_user_history]
        currency_history[t_d_currency_history]
        account_history[t_d_account_history]
        fact_history[t_f_budget_fact_history]
        recurring_history[t_s_recurring_plan_history]
        list_history[t_s_shopping_list_history]
        item_history[t_s_shopping_item_history]
    end

    style article_history fill:#607D8B,stroke:#37474F,color:#fff
```

---

## Key Relationships

### User → Facts (1:N)
```sql
SELECT * FROM t_f_budget_fact WHERE user_id = 1;
```

### Article → Facts (1:N with Hierarchy)
```sql
-- All facts for "Food" category and subcategories
SELECT f.*
FROM t_f_budget_fact f
JOIN t_d_article_hierarchy h ON f.article_id = h.descendant_id
WHERE h.ancestor_id = (SELECT article_id FROM t_d_article WHERE article_name = 'Food');
```

### Transfer Facts (1:1 Linked)
```sql
-- Find transfer pair
SELECT * FROM t_f_budget_fact
WHERE budget_fact_id = 100 OR linked_fact_id = 100;
```

### Family Shared Budget (M:N)
```sql
-- All users in family
SELECT u.* FROM t_d_user u
JOIN t_d_user_family uf ON u.user_id = uf.user_id
WHERE uf.family_id = 1;
```

---

## Index Strategy

### Primary Indexes
- All `_id` columns have B-tree indexes
- Composite index on `(user_id, fact_date)` for partition pruning

### Unique Constraints
- `t_d_user.telegram_user_id` (unique per Telegram user)
- `t_d_user.email` (unique per email)
- `t_d_article_hierarchy.(ancestor_id, descendant_id)` (prevent duplicates)

### Performance Indexes
- `t_f_budget_fact.fact_date` (partition key)
- `t_f_budget_fact.linked_fact_id` (for transfer queries)
- `t_s_shopping_item.list_id` (for list fetching)

---

## Data Constraints

### Check Constraints
```sql
-- Amount must be positive
CHECK (amount_cents > 0)

-- Fact type enum
CHECK (fact_type IN ('fact', 'plan', 'transfer'))

-- Article category enum
CHECK (article_category IN ('income', 'expense'))

-- Depth must be non-negative
CHECK (depth >= 0)
```

### Foreign Key Cascade Rules
- `ON DELETE CASCADE`: user_sessions (delete sessions when user deleted)
- `ON DELETE RESTRICT`: t_f_budget_fact (prevent deleting referenced articles)
- `ON DELETE SET NULL`: t_f_budget_fact.linked_fact_id (allow unlinking transfers)

---

## Migration Strategy

### Alembic Migrations
```bash
# Generate migration
alembic revision --autogenerate -m "Add new column"

# Apply migration
python -m alembic upgrade head

# Rollback migration
python -m alembic downgrade -1
```

### Partition Maintenance
```sql
-- Create new partition for March 2026
CREATE TABLE t_f_budget_fact_202603 PARTITION OF t_f_budget_fact
FOR VALUES FROM ('2026-03-01') TO ('2026-04-01');

-- Drop old partition (archive first!)
DROP TABLE t_f_budget_fact_202201;
```

---

## Performance Characteristics

| Operation | Complexity | Notes |
|-----------|------------|-------|
| Insert fact | O(1) | Direct partition insert |
| Query by date | O(log n) | Partition pruning |
| Query without date | O(96n) | Scans all partitions |
| Closure table descendants | O(k) | k = number of descendants |
| History lookup | O(log n) | Indexed by valid_from/valid_to |

---

## References

- [Database Design](../architecture/backend/database/README.md)
- [Closure Table Pattern](../architecture/features/advanced-patterns.md)
- [SCD Type 2 Implementation](../architecture/backend/database/history-tracking.md)
- [Partition Strategy](../architecture/optimization/partition-optimization.md)

---

**Version**: 11.4.4
**Created**: 2026-02-07
