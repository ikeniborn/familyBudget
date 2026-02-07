# Data Flows

**Type**: Flow Diagrams
**Purpose**: Visualize critical data flows in Family Budget system
**Last Updated**: 2026-02-07

## Overview

This document covers 4 critical data flows:
1. **Transaction Creation** - HTMX form → API → Database → WebSocket broadcast
2. **Offline Sync** - Dexie.js → Sync Manager → API → Conflict resolution
3. **Transfer Logic** - Double-entry bookkeeping with linked records
4. **WebSocket Real-Time Updates** - Database change → Redis Pub/Sub → All clients

---

## 1. Transaction Creation Flow

```mermaid
flowchart TB
    Start([User fills form]) --> ValidateClient{Client-side<br/>validation}

    ValidateClient -->|Invalid| ShowError1[Show validation errors]
    ShowError1 --> Start

    ValidateClient -->|Valid| ConvertCents[Convert rubles to cents<br/>amount_cents = amount * 100]
    ConvertCents --> SubmitHTMX[HTMX POST /api/budget/facts]

    SubmitHTMX --> APIReceive[FastAPI endpoint receives]
    APIReceive --> ParseJWT[Parse JWT token<br/>Extract user_id]

    ParseJWT --> ValidateServer{Server-side<br/>validation}
    ValidateServer -->|Invalid| Return400[Return 400 Bad Request<br/>+ validation errors]
    Return400 --> DisplayError[Display inline errors]

    ValidateServer -->|Valid| CheckOnline{Request has<br/>sync_queue_id?}

    CheckOnline -->|Yes - Offline sync| DedupeCheck{Check duplicate<br/>via sync_queue_id}
    DedupeCheck -->|Duplicate found| Return409[Return 409 Conflict<br/>Already processed]
    DedupeCheck -->|Not duplicate| InsertDB

    CheckOnline -->|No - Online create| InsertDB[INSERT INTO t_f_budget_fact]

    InsertDB --> TriggerHistory[Trigger: Insert into<br/>t_f_budget_fact_history]
    TriggerHistory --> CommitDB[(Commit transaction)]

    CommitDB --> PublishRedis[Publish to Redis Pub/Sub<br/>channel: budget_updates]
    PublishRedis --> WSBroadcast{WebSocket<br/>manager}

    WSBroadcast --> WSSameUser[Send to same user<br/>other tabs]
    WSBroadcast --> WSFamily[Send to family members<br/>if shared budget]

    WSSameUser --> UpdateUIUser[Update UI<br/>via hx-swap-oob]
    WSFamily --> UpdateUIFamily[Update family UI]

    CommitDB --> Return201[Return 201 Created<br/>+ HTML fragment]
    Return201 --> HTMXSwap[HTMX swaps content<br/>into #facts-list]

    HTMXSwap --> Success([Transaction created])
    UpdateUIUser --> Success
    UpdateUIFamily --> Success

    style Start fill:#4CAF50,stroke:#2E7D32,color:#fff
    style Success fill:#4CAF50,stroke:#2E7D32,color:#fff
    style InsertDB fill:#2196F3,stroke:#1565C0,color:#fff
    style CommitDB fill:#2196F3,stroke:#1565C0,color:#fff
    style PublishRedis fill:#9C27B0,stroke:#6A1B9A,color:#fff
    style WSBroadcast fill:#9C27B0,stroke:#6A1B9A,color:#fff
```

### Key Points
- **Cents conversion**: Frontend converts `100.50 RUB` → `10050 cents` before submission
- **Deduplication**: `sync_queue_id` prevents duplicate inserts from offline sync
- **Optimistic UI**: HTMX swaps HTML immediately, WebSocket updates other tabs
- **Family sharing**: Family members see real-time updates via WebSocket

---

## 2. Offline Sync Flow

```mermaid
stateDiagram-v2
    [*] --> Online: App loads

    Online --> Offline: Network lost<br/>(NetworkDetector)

    Offline --> QueueOperation: User creates/updates/<br/>deletes transaction
    QueueOperation --> StoreLocal: Save to Dexie.js<br/>sync_status = 'pending'
    StoreLocal --> ShowOfflineBadge: Display "Offline" badge

    ShowOfflineBadge --> Offline: Continue working
    Offline --> Online: Network restored

    Online --> CheckQueue: SyncManager checks<br/>pending operations
    CheckQueue --> HasPending{Has pending<br/>operations?}

    HasPending -->|No| [*]
    HasPending -->|Yes| ProcessQueue

    ProcessQueue --> NextItem: Get next pending item
    NextItem --> SendToAPI: POST /api/budget/facts<br/>with sync_queue_id

    SendToAPI --> APIResponse{API Response}

    APIResponse -->|201 Created| UpdateLocal1: Update Dexie.js<br/>sync_status = 'synced'
    UpdateLocal1 --> RemoveFromQueue
    RemoveFromQueue --> MoreItems{More items<br/>in queue?}

    APIResponse -->|409 Conflict<br/>Already synced| UpdateLocal2: Update Dexie.js<br/>sync_status = 'synced'
    UpdateLocal2 --> RemoveFromQueue

    APIResponse -->|400 Bad Request<br/>Validation error| MarkFailed: Update Dexie.js<br/>sync_status = 'failed'
    MarkFailed --> ShowError: Notify user<br/>of sync failure
    ShowError --> MoreItems

    APIResponse -->|500 Server Error<br/>Network error| RetryLater: Keep sync_status = 'pending'
    RetryLater --> ExponentialBackoff: Wait 2s, 4s, 8s, 16s...
    ExponentialBackoff --> MoreItems

    MoreItems -->|Yes| NextItem
    MoreItems -->|No| SyncComplete

    SyncComplete --> HideOfflineBadge: Remove "Offline" badge
    HideOfflineBadge --> [*]

    note right of StoreLocal
        Dexie.js Schema:
        {
          id: UUID,
          sync_queue_id: UUID,
          sync_status: 'pending'|'synced'|'failed',
          operation: 'create'|'update'|'delete',
          data: {...},
          created_at: timestamp,
          retry_count: 0
        }
    end note

    note right of SendToAPI
        API deduplication:
        - Check if sync_queue_id exists in DB
        - If exists, return 409 Conflict
        - If not, process normally
    end note
```

### Conflict Resolution Strategy

```mermaid
flowchart TB
    Start([Sync operation]) --> ServerCheck{Server has<br/>newer version?}

    ServerCheck -->|No| NoConflict[Apply local changes<br/>Server timestamp updated]
    NoConflict --> Success([Sync complete])

    ServerCheck -->|Yes| ConflictType{Conflict type}

    ConflictType -->|Create → Already exists| UseServer1[Use server version<br/>Discard local]
    ConflictType -->|Update → Server modified| LastWriteWins[Last-write-wins<br/>Show warning to user]
    ConflictType -->|Delete → Server deleted| NoOp[No operation<br/>Already deleted]

    UseServer1 --> LogConflict[Log conflict in browser console]
    LastWriteWins --> LogConflict
    NoOp --> LogConflict

    LogConflict --> Success

    style Start fill:#4CAF50,stroke:#2E7D32,color:#fff
    style Success fill:#4CAF50,stroke:#2E7D32,color:#fff
    style NoConflict fill:#2196F3,stroke:#1565C0,color:#fff
    style LogConflict fill:#FF9800,stroke:#E65100,color:#fff
```

### Sync Status States

| State | Meaning | Action |
|-------|---------|--------|
| `pending` | Waiting to sync | Retry on network restore |
| `synced` | Successfully synced | Remove from queue |
| `failed` | Validation error | Show error to user |

---

## 3. Transfer Logic (Double-Entry Bookkeeping)

```mermaid
flowchart TB
    Start([User initiates transfer<br/>100 RUB from Cash to Card]) --> ValidateAccounts{Source != Destination?}

    ValidateAccounts -->|Same account| Error1[Error: Cannot transfer<br/>to same account]
    ValidateAccounts -->|Different| ConvertAmount[Convert to cents<br/>10000 cents]

    ConvertAmount --> BeginTX[BEGIN TRANSACTION]

    BeginTX --> CreateExpense[INSERT fact #1<br/>Expense from Cash<br/>amount: -10000 cents<br/>account_id: Cash]

    CreateExpense --> CreateIncome[INSERT fact #2<br/>Income to Card<br/>amount: +10000 cents<br/>account_id: Card]

    CreateIncome --> LinkRecords[UPDATE both records<br/>fact #1.linked_fact_id = fact #2.id<br/>fact #2.linked_fact_id = fact #1.id]

    LinkRecords --> CommitTX[COMMIT TRANSACTION]

    CommitTX --> PublishEvent[Publish WebSocket event<br/>type: 'transfer_created']

    PublishEvent --> UpdateUI[Update UI<br/>Show both records linked]

    UpdateUI --> Success([Transfer complete])

    style Start fill:#4CAF50,stroke:#2E7D32,color:#fff
    style Success fill:#4CAF50,stroke:#2E7D32,color:#fff
    style BeginTX fill:#2196F3,stroke:#1565C0,color:#fff
    style CommitTX fill:#2196F3,stroke:#1565C0,color:#fff
    style CreateExpense fill:#FF5722,stroke:#D84315,color:#fff
    style CreateIncome fill:#4CAF50,stroke:#2E7D32,color:#fff
```

### Transfer Data Structure

```sql
-- Fact #1 (Expense)
INSERT INTO t_f_budget_fact (
    fact_date,
    article_id,     -- "Transfer Out" category
    user_id,
    currency_id,
    account_id,     -- Source account (Cash)
    amount_cents,   -- -10000 (negative)
    fact_type,      -- 'transfer'
    linked_fact_id  -- Points to Fact #2
) VALUES (
    '2026-02-07',
    (SELECT article_id FROM t_d_article WHERE article_name = 'Transfer Out'),
    1,
    1,
    5,              -- Cash account
    -10000,
    'transfer',
    2               -- Linked to Fact #2
);

-- Fact #2 (Income)
INSERT INTO t_f_budget_fact (
    fact_date,
    article_id,     -- "Transfer In" category
    user_id,
    currency_id,
    account_id,     -- Destination account (Card)
    amount_cents,   -- +10000 (positive)
    fact_type,      -- 'transfer'
    linked_fact_id  -- Points to Fact #1
) VALUES (
    '2026-02-07',
    (SELECT article_id FROM t_d_article WHERE article_name = 'Transfer In'),
    1,
    1,
    6,              -- Card account
    10000,
    'transfer',
    1               -- Linked to Fact #1
);
```

### Transfer Deduplication

```mermaid
flowchart LR
    Query[Query transfers] --> FilterType{Filter by<br/>fact_type}
    FilterType -->|fact_type = 'transfer'| GetPairs[Get linked pairs]
    GetPairs --> Dedupe{Deduplicate}

    Dedupe -->|Keep only fact_id < linked_fact_id| UniqueSet[Unique transfer set]

    UniqueSet --> DisplayUI[Display in UI<br/>Single row per transfer]

    style Query fill:#4CAF50,stroke:#2E7D32,color:#fff
    style Dedupe fill:#FF9800,stroke:#E65100,color:#fff
    style DisplayUI fill:#2196F3,stroke:#1565C0,color:#fff
```

**SQL Deduplication**:
```sql
-- Get unique transfers (avoid showing both sides)
SELECT *
FROM t_f_budget_fact
WHERE fact_type = 'transfer'
  AND budget_fact_id < linked_fact_id;
```

---

## 4. WebSocket Real-Time Updates

```mermaid
sequenceDiagram
    participant DB as PostgreSQL
    participant API as FastAPI App
    participant Redis as Redis Pub/Sub
    participant WS1 as WebSocket Client 1<br/>(Same user, Tab A)
    participant WS2 as WebSocket Client 2<br/>(Same user, Tab B)
    participant WS3 as WebSocket Client 3<br/>(Family member)

    Note over DB,WS3: User creates transaction in Tab A

    WS1->>API: POST /api/budget/facts<br/>(via HTMX)
    API->>DB: INSERT INTO t_f_budget_fact

    DB-->>API: Return new fact_id
    API->>API: Build WebSocket event<br/>{type: 'fact_created', data: {...}}

    API->>Redis: PUBLISH budget_updates<br/>{user_id, family_id, event}

    Note over Redis: Redis broadcasts to<br/>all API instances

    Redis-->>API: Message received

    API->>API: Filter recipients<br/>- Same user: all tabs<br/>- Family members: if shared budget

    par Send to all matching WebSocket connections
        API->>WS1: Skip (originator)
        API->>WS2: WebSocket message<br/>{type: 'fact_created', html_fragment}
        API->>WS3: WebSocket message<br/>{type: 'fact_created', html_fragment}
    end

    WS2->>WS2: HTMX swap OOB<br/>Update #facts-list
    WS3->>WS3: HTMX swap OOB<br/>Update #facts-list

    WS2->>WS2: Show toast notification<br/>"New transaction added"
    WS3->>WS3: Show toast notification<br/>"Family member added transaction"
```

### WebSocket Event Types

```mermaid
graph TB
    subgraph "Event Types"
        FactCreated[fact_created<br/>New transaction]
        FactUpdated[fact_updated<br/>Modified transaction]
        FactDeleted[fact_deleted<br/>Deleted transaction]
        BulkDelete[bulk_delete_summary<br/>Multiple deletions]
        AccountUpdated[account_updated<br/>Account balance changed]
        ListShared[list_shared<br/>Shopping list shared]
    end

    subgraph "Payload Structure"
        Type[type: string]
        Data[data: object]
        HTMLFragment[html_fragment?: string]
        TargetSelector[target_selector?: string]
    end

    FactCreated --> Type
    FactCreated --> Data
    FactCreated --> HTMLFragment
    FactCreated --> TargetSelector

    style FactCreated fill:#4CAF50,stroke:#2E7D32,color:#fff
    style BulkDelete fill:#FF5722,stroke:#D84315,color:#fff
```

### Multi-Tab Coordination

```mermaid
flowchart TB
    Start([Tab A creates transaction]) --> LocalUpdate[Update local Dexie.js]

    LocalUpdate --> BroadcastChannel[BroadcastChannel.postMessage<br/>{type: 'fact_created', id}]

    BroadcastChannel --> TabB[Tab B receives message]
    BroadcastChannel --> TabC[Tab C receives message]

    TabB --> FetchDexie1[Fetch from Dexie.js<br/>by id]
    TabC --> FetchDexie2[Fetch from Dexie.js<br/>by id]

    FetchDexie1 --> UpdateUI1[Update UI in Tab B]
    FetchDexie2 --> UpdateUI2[Update UI in Tab C]

    UpdateUI1 --> Complete([All tabs synchronized])
    UpdateUI2 --> Complete

    style Start fill:#4CAF50,stroke:#2E7D32,color:#fff
    style Complete fill:#4CAF50,stroke:#2E7D32,color:#fff
    style BroadcastChannel fill:#9C27B0,stroke:#6A1B9A,color:#fff
```

**Benefits**:
- **No redundant API calls**: Tabs share Dexie.js data
- **Instant sync**: BroadcastChannel is synchronous
- **Offline-compatible**: Works without network

---

## Performance Optimizations

### 1. Batch WebSocket Messages

```javascript
// Instead of sending 100 individual messages
for (let i = 0; i < 100; i++) {
    ws.send({type: 'fact_deleted', id: i});
}

// Send single bulk summary
ws.send({
    type: 'bulk_delete_summary',
    deleted_count: 100,
    affected_categories: ['Food', 'Transport']
});
```

### 2. Partition Pruning (Database)

```sql
-- BAD: Scans all 96 partitions
SELECT * FROM t_f_budget_fact WHERE user_id = 1;

-- GOOD: Scans only 1 partition
SELECT * FROM t_f_budget_fact
WHERE user_id = 1 AND fact_date >= '2026-02-01' AND fact_date < '2026-03-01';
```

### 3. Redis Pub/Sub Filtering

```python
# Publish with user_id and family_id
redis.publish('budget_updates', {
    'user_id': 1,
    'family_id': 5,
    'event': {...}
})

# API instance filters before sending to WebSocket
if client.user_id == event['user_id'] or client.family_id == event['family_id']:
    await client.send_json(event)
```

---

## Error Handling

### Network Failures

```mermaid
flowchart TB
    Start([Operation failed]) --> CheckOnline{Is online?}

    CheckOnline -->|Offline| QueueDexie[Queue in Dexie.js<br/>sync_status = 'pending']
    CheckOnline -->|Online| CheckError{Error type}

    CheckError -->|400 Validation| ShowUser[Show validation errors<br/>Do not retry]
    CheckError -->|409 Conflict| ResolveConflict[Conflict resolution logic]
    CheckError -->|500 Server Error| Retry[Exponential backoff retry]

    QueueDexie --> WaitNetwork[Wait for network restore]
    WaitNetwork --> AutoSync[Auto-sync when online]

    ShowUser --> End([User fixes issue])
    ResolveConflict --> End
    Retry --> End
    AutoSync --> End

    style Start fill:#FF5722,stroke:#D84315,color:#fff
    style End fill:#4CAF50,stroke:#2E7D32,color:#fff
```

---

## References

- [Transaction Flow](../architecture/features/transaction-management.md)
- [Offline Architecture](09-offline-architecture.md)
- [Transfer System](../architecture/features/transfers-system.md)
- [WebSocket Implementation](../architecture/core/websocket.md)

---

**Version**: 11.4.4
**Created**: 2026-02-07
