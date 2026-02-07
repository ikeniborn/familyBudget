# Features Integration Map

**Type**: Feature Interaction Diagram
**Purpose**: Cross-module feature dependencies and interactions
**Last Updated**: 2026-02-07

## Feature Dependencies

```mermaid
graph TB
    subgraph "Core Features"
        Transactions[Transactions<br/>Budget Facts]
        Categories[Categories<br/>Hierarchical Tree]
        Accounts[Accounts<br/>Balance Tracking]
    end

    subgraph "Advanced Features"
        Transfers[Transfers System<br/>Double-Entry Bookkeeping]
        Recurring[Recurring Plans<br/>MMDD Encoding]
        ShoppingLists[Shopping Lists<br/>Offline-First]
    end

    subgraph "Integration Features"
        CSVImport[CSV Import<br/>Bank Integration]
        Backup[Backup System<br/>Full Export/Restore]
        Notifications[Notifications<br/>Web Push + Telegram]
    end

    subgraph "Real-Time Features"
        WebSocket[WebSocket Updates<br/>Multi-Tab Sync]
        OfflineSync[Offline Sync<br/>Dexie.js Queue]
    end

    Transactions --> Transfers
    Transactions --> Recurring
    Categories --> Transactions
    Accounts --> Transactions
    Accounts --> Transfers

    Transfers --> WebSocket
    Recurring --> Notifications
    ShoppingLists --> OfflineSync

    CSVImport --> Transactions
    Backup --> Transactions
    Backup --> ShoppingLists

    Transactions --> WebSocket
    ShoppingLists --> WebSocket

    style Transactions fill:#2196F3,stroke:#1565C0,color:#fff
    style Transfers fill:#FF9800,stroke:#E65100,color:#fff
    style ShoppingLists fill:#4CAF50,stroke:#2E7D32,color:#fff
    style WebSocket fill:#9C27B0,stroke:#6A1B9A,color:#fff
```

---

## Transfers System Flow

```mermaid
sequenceDiagram
    participant User
    participant UI as Transfer Form
    participant API as FastAPI
    participant DB as PostgreSQL
    participant WS as WebSocket

    User->>UI: Enter amount, source, destination
    UI->>API: POST /api/budget/transfers
    API->>DB: BEGIN TRANSACTION
    API->>DB: INSERT fact #1 (expense from source)
    API->>DB: INSERT fact #2 (income to destination)
    API->>DB: UPDATE fact #1.linked_fact_id = fact #2
    API->>DB: UPDATE fact #2.linked_fact_id = fact #1
    API->>DB: COMMIT TRANSACTION
    API->>WS: Broadcast transfer_created event
    WS->>User: Update UI with linked facts
```

---

## Recurring Plans Execution

```mermaid
flowchart TB
    Scheduler[APScheduler<br/>Daily 00:00 UTC] --> FetchPlans[Fetch Active Plans<br/>WHERE is_active = true]

    FetchPlans --> CheckDay{Today matches<br/>execution_day?}

    CheckDay -->|No| Skip[Skip Plan]
    CheckDay -->|Yes| CreateFact[Create Budget Fact<br/>from Plan Template]

    CreateFact --> LogExecution[INSERT INTO<br/>recurring_execution<br/>Log Success]

    LogExecution --> SendNotification[Send Notification<br/>Web Push + Telegram]

    SendNotification --> NextPlan{More Plans?}
    NextPlan -->|Yes| FetchPlans
    NextPlan -->|No| Complete([Daily Job Complete])

    style Scheduler fill:#FF9800,stroke:#E65100,color:#fff
    style CreateFact fill:#4CAF50,stroke:#2E7D32,color:#fff
```

### MMDD Encoding

```
execution_day = 531  // May 31st
execution_day = 229  // Feb 29th (leap year only)
execution_day = 101  // Jan 1st
```

---

## Shopping Lists Offline Sync

```mermaid
stateDiagram-v2
    [*] --> Online
    Online --> CreateItem: User adds item
    CreateItem --> SaveDexie: Save to Dexie.js<br/>sync_status = 'synced'
    SaveDexie --> BroadcastTabs: BroadcastChannel<br/>notify other tabs

    BroadcastTabs --> Online

    Online --> Offline: Network Lost
    Offline --> CreateItemOffline: User adds item offline
    CreateItemOffline --> QueueDexie: Save to Dexie.js<br/>sync_status = 'pending'
    QueueDexie --> ShowOfflineBadge

    ShowOfflineBadge --> Offline
    Offline --> Online: Network Restored

    Online --> SyncQueue: SyncManager processes queue
    SyncQueue --> APISync: POST /api/lists/:id/items<br/>with sync_queue_id
    APISync --> UpdateStatus: Update sync_status = 'synced'
    UpdateStatus --> [*]
```

---

## References

- [Transfers System](../architecture/features/transfers-system.md)
- [Recurring Plans](../architecture/features/recurring-plans.md)
- [Shopping Lists](../architecture/features/shopping-lists.md)
- [Offline Sync](09-offline-architecture.md)

---

**Version**: 11.4.4
**Created**: 2026-02-07
