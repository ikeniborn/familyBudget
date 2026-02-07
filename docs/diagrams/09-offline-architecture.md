# Offline Architecture

**Type**: State Machine + Flow Diagram
**Purpose**: NetworkDetector, Dexie.js sync, conflict resolution
**Last Updated**: 2026-02-07

## Network State Machine

```mermaid
stateDiagram-v2
    [*] --> Initializing
    Initializing --> CheckingConnectivity: NetworkDetector starts

    CheckingConnectivity --> Online: navigator.onLine = true<br>Health check succeeds
    CheckingConnectivity --> Offline: navigator.onLine = false<br>OR Health check fails

    Online --> Offline: Network lost<br>(online event → false)
    Offline --> Online: Network restored<br>(online event → true)

    Online --> HealthCheckOnline: Periodic health check<br>every 30s
    HealthCheckOnline --> Online: 200 OK
    HealthCheckOnline --> Offline: Timeout/Error

    Offline --> HealthCheckOffline: Periodic health check<br>every 5s (faster retry)
    HealthCheckOffline --> Online: 200 OK
    HealthCheckOffline --> Offline: Still failing

    state Online {
        [*] --> DisplayOnlineBadge
        DisplayOnlineBadge --> ProcessSyncQueue
        ProcessSyncQueue --> [*]
    }

    state Offline {
        [*] --> DisplayOfflineBadge
        DisplayOfflineBadge --> QueueOperations
        QueueOperations --> [*]
    }
```

### Health Check Endpoint

```javascript
// networkDetector.ts
async function healthCheck(): Promise<boolean> {
    try {
        const response = await fetch('/api/health', {
            method: 'HEAD',
            cache: 'no-cache',
            signal: AbortSignal.timeout(5000) // 5s timeout
        });
        return response.ok;
    } catch {
        return false;
    }
}
```

---

## Dexie.js Schema (15 Tables)

```mermaid
erDiagram
    budgetFacts {
        bigint budget_fact_id PK
        string sync_queue_id UK
        bigint user_id
        date fact_date
        string sync_status "pending|synced|failed"
        bigint amount_cents "Stored in cents"
        timestamp created_at
    }

    articles {
        bigint article_id PK
        string article_name
        string article_category
        boolean is_active
    }

    articleHierarchy {
        bigint ancestor_id PK_FK
        bigint descendant_id PK_FK
        int depth
    }

    financialCenters {
        int financial_center_id PK
        string name
        boolean is_active
    }

    costCenters {
        int cost_center_id PK
        string name
        boolean is_active
    }

    pendingOperations {
        int id PK
        string sync_queue_id UK
        string operation "create|update|delete"
        string entity_type "fact|list|item"
        json payload
        int retry_count
        timestamp created_at
    }

    syncConflicts {
        int id PK
        string entity_type
        string entity_id
        string conflict_type
        json local_data
        json server_data
        timestamp created_at
    }

    recurringPlans {
        bigint recurring_plan_id PK
        bigint user_id
        bigint article_id FK
        boolean is_active
        int execution_day "MMDD encoding"
    }

    shoppingLists {
        bigint shopping_list_id PK
        string sync_queue_id UK
        bigint creator_id
        string name
        string sync_status "pending|synced|failed"
        timestamp created_at
    }

    shoppingListItems {
        bigint shopping_item_id PK
        string sync_queue_id UK
        bigint list_id FK
        string name
        boolean purchased
        string sync_status "pending|synced|failed"
    }

    stores {
        int store_id PK
        string name
    }

    productGroups {
        int product_group_id PK
        string name
    }

    productGroupHierarchy {
        int ancestor_id PK_FK
        int descendant_id PK_FK
        int depth
    }

    syncMetadata {
        string key PK
        json value
        timestamp last_synced_at
    }

    schemaMigrations {
        int id PK
        int version
        timestamp applied_at
    }

    articles ||--o{ articleHierarchy : "ancestor/descendant"
    shoppingLists ||--o{ shoppingListItems : "list_id"
    productGroups ||--o{ productGroupHierarchy : "ancestor/descendant"
    recurringPlans }o--|| articles : "article_id"
```

---

## Sync Queue Processing

```mermaid
flowchart TB
    Start([Network Restored]) --> SyncManager[SyncManager Activated]

    SyncManager --> FetchQueue[Fetch from pendingOperations<br>WHERE sync_status = 'pending']

    FetchQueue --> HasItems{Queue<br>Empty?}
    HasItems -->|Yes| Complete([Sync Complete])
    HasItems -->|No| NextItem[Get next item]

    NextItem --> BuildRequest[Build API Request<br>Include sync_queue_id]

    BuildRequest --> SendAPI[Send to API<br>POST/PUT/DELETE]

    SendAPI --> APIResponse{Response}

    APIResponse -->|201/200| Success[Update sync_status = 'synced']
    Success --> RemoveQueue[Remove from pendingOperations]
    RemoveQueue --> MoreItems

    APIResponse -->|409 Conflict| AlreadySynced[Update sync_status = 'synced'<br>Server has newer version]
    AlreadySynced --> RemoveQueue

    APIResponse -->|400 Validation| ValidationError[Update sync_status = 'failed'<br>Show error to user]
    ValidationError --> LogError[Log to console]
    LogError --> MoreItems

    APIResponse -->|500/Network Error| IncrementRetry[Increment retry_count]
    IncrementRetry --> CheckRetries{retry_count<br>> 5?}

    CheckRetries -->|Yes| MarkFailed[Update sync_status = 'failed'<br>Max retries exceeded]
    MarkFailed --> MoreItems

    CheckRetries -->|No| ExponentialBackoff[Wait 2^retry_count seconds<br>2s, 4s, 8s, 16s, 32s...]
    ExponentialBackoff --> MoreItems

    MoreItems{More Items?}
    MoreItems -->|Yes| NextItem
    MoreItems -->|No| Complete

    style Start fill:#4CAF50,stroke:#2E7D32,color:#fff
    style Complete fill:#4CAF50,stroke:#2E7D32,color:#fff
    style Success fill:#2196F3,stroke:#1565C0,color:#fff
    style ValidationError fill:#FF5722,stroke:#D84315,color:#fff
```

---

## Conflict Resolution Logic

```mermaid
flowchart TB
    SyncAttempt([Sync Operation]) --> ServerFetch[Fetch server version<br>by sync_queue_id]

    ServerFetch --> ServerExists{Server has<br>record?}

    ServerExists -->|No| NoConflict[No conflict<br>Create on server]
    NoConflict --> Success([Sync Success])

    ServerExists -->|Yes| CompareTimestamp{Compare<br>updated_at}

    CompareTimestamp -->|Local newer| LastWriteWins[Last-write-wins<br>Update server<br>Show warning]
    CompareTimestamp -->|Server newer| ServerWins[Use server version<br>Overwrite local]
    CompareTimestamp -->|Same timestamp| NoOp[No operation needed<br>Already in sync]

    LastWriteWins --> LogConflict[Log conflict to console<br>+ WebSocket event]
    ServerWins --> LogConflict
    NoOp --> Success

    LogConflict --> Success

    style SyncAttempt fill:#4CAF50,stroke:#2E7D32,color:#fff
    style Success fill:#4CAF50,stroke:#2E7D32,color:#fff
    style LogConflict fill:#FF9800,stroke:#E65100,color:#fff
```

### Conflict Example

```javascript
// Local version (offline edit)
{
    id: 'abc123',
    amount_cents: 10000,
    updated_at: '2026-02-07T10:00:00Z'
}

// Server version (edited by another user)
{
    id: 'abc123',
    amount_cents: 15000,
    updated_at: '2026-02-07T10:05:00Z'  // Newer!
}

// Result: Server wins, local version overwritten
// User sees notification: "Transaction updated by another user"
```

---

## BroadcastChannel Multi-Tab Coordination

```mermaid
sequenceDiagram
    participant Tab1 as Tab 1 (Active)
    participant Dexie as Dexie.js (Shared)
    participant Channel as BroadcastChannel
    participant Tab2 as Tab 2 (Background)
    participant Tab3 as Tab 3 (Background)

    Tab1->>Dexie: Add new fact<br>{id: 'abc', ...}
    Dexie-->>Tab1: Success

    Tab1->>Channel: postMessage<br>{type: 'fact_created', id: 'abc'}

    Note over Channel: Instant broadcast<br>to all tabs

    Channel->>Tab2: Receive message
    Channel->>Tab3: Receive message

    par Parallel Updates
        Tab2->>Dexie: Get fact by id 'abc'
        Tab3->>Dexie: Get fact by id 'abc'
    end

    Dexie-->>Tab2: Return fact data
    Dexie-->>Tab3: Return fact data

    Tab2->>Tab2: Update UI
    Tab3->>Tab3: Update UI

    Note over Tab1,Tab3: All tabs synchronized<br>without API calls
```

### Benefits

- **Zero latency**: Synchronous message passing
- **No server load**: Tabs share IndexedDB data
- **Offline compatible**: Works without network
- **Battery efficient**: No polling required

---

## Service Worker Caching Strategy

```mermaid
flowchart TB
    Request([Browser Request]) --> SWIntercept{Service Worker}

    SWIntercept -->|/static/*| CacheFirst
    SWIntercept -->|/api/*| NetworkFirst
    SWIntercept -->|/*.html| NetworkFirst

    subgraph "Cache-First (Static Assets)"
        CacheFirst --> InCache1{In Cache?}
        InCache1 -->|Yes| ReturnCache1[Return from cache]
        InCache1 -->|No| FetchNet1[Fetch from network]
        FetchNet1 --> UpdateCache1[Update cache]
        UpdateCache1 --> ReturnFresh1[Return response]
    end

    subgraph "Network-First (API + HTML)"
        NetworkFirst --> TryNet{Network OK?}
        TryNet -->|Yes| FetchNet2[Fetch from network]
        FetchNet2 --> Success{Success?}
        Success -->|200 OK| UpdateCache2[Update cache]
        UpdateCache2 --> ReturnFresh2[Return response]
        Success -->|Error| FallbackCache[Fallback to cache]

        TryNet -->|No - Offline| InCache2{In Cache?}
        InCache2 -->|Yes| ReturnCache2[Return from cache]
        InCache2 -->|No| OfflinePage[Show offline page]
    end

    ReturnCache1 --> End([Response])
    ReturnFresh1 --> End
    ReturnFresh2 --> End
    FallbackCache --> End
    ReturnCache2 --> End
    OfflinePage --> End

    style CacheFirst fill:#4CAF50,stroke:#2E7D32,color:#fff
    style NetworkFirst fill:#2196F3,stroke:#1565C0,color:#fff
    style OfflinePage fill:#FF5722,stroke:#D84315,color:#fff
```

---

## Offline User Experience

```mermaid
journey
    title Offline Transaction Creation Journey
    section Online
      Open app: 5: User
      Create transaction: 5: User
      Submit form: 5: User
      See in list: 5: User
    section Offline
      Network lost: 1: System
      See offline badge: 3: User
      Create transaction: 4: User
      Submit form: 4: User
      See "Pending sync": 3: User
    section Back Online
      Network restored: 5: System
      Auto-sync starts: 5: System
      See "Synced" badge: 5: User
      Badge disappears: 5: User
```

---

## References

- [Offline Architecture](../architecture/core/pwa.md)
- [Dexie.js Integration](../architecture/core/dexie-integration.md)
- [Service Worker Caching](../architecture/optimization/caching-strategy.md)

---

**Version**: 11.4.4
**Created**: 2026-02-07
