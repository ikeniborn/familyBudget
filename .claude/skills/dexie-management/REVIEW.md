# Dexie Management Skill Review

**Дата:** 2026-01-31
**Reviewer:** Claude Sonnet 4.5
**Версия skill:** 1.0.0 (880 строк)

---

## Executive Summary

**Статус:** ✅ Production-ready с рекомендациями по улучшению

**Сильные стороны:**
- ✅ Полные CRUD templates (CREATE/QUERY/UPDATE/DELETE)
- ✅ Sync operations templates (UPLOAD/DOWNLOAD/FULL/AUTO)
- ✅ Key Patterns хорошо описаны (Cents, Async/Await, Sync Status)
- ✅ Validation Checklist (10 пунктов)
- ✅ Common Mistakes с решениями (5 ошибок)
- ✅ Все architectural refs валидны

**Области для улучшения:**
- ⚠️ Отсутствуют конкретные примеры использования
- ⚠️ Validation/Hash utilities не упоминаются
- ⚠️ Conflict Resolution не раскрыт
- ⚠️ Bulk Operations не покрыты
- ⚠️ Type Definitions template отсутствует
- ⚠️ Testing Strategy не детализирована
- ⚠️ Transaction patterns не показаны

---

## Детальный анализ

### 1. Отсутствие конкретных примеров ⚠️ HIGH PRIORITY

**Проблема:**
Skill содержит generic templates (`{Model}`, `{models}`) но нет секции "Examples" с реальными use cases.

**Сравнение с api-development:**
```yaml
# api-development/SKILL.md имеет:
**Example Reference:**
- Real Article endpoint: `examples/article-endpoint.md`
- Real BudgetFact endpoint: `examples/fact-endpoint.md`
```

**Рекомендация:**
Добавить секцию **"## Examples"** после Commands с 2-3 реальными примерами:

```markdown
## Examples

### Example 1: RecurringPlan CRUD

**Task:** Создай offline-first CRUD operations для модели RecurringPlan с Dexie.js

**Fields:**
- user_id: number
- article_id: number
- amount: number (cents)
- frequency: string
- is_active: boolean

**Generated Code:**
```typescript
// frontend/shared/db/dexie/operations/recurringPlanOperations.ts

import { db, toCents, fromCents } from '../core/database';
import { logger } from '../utils/logger';
import { validateRecurringPlan } from '../utils/validation';
import { calculateContentHash, generateUUID } from '../utils/hash';
import type { LocalRecurringPlan } from '../types/recurringPlan';

export async function createRecurringPlan(
  data: Omit<LocalRecurringPlan, 'id' | 'created_at'>
): Promise<number> {
  // ... full implementation
}
```

**Reference Files:**
- operations/recurringPlanOperations.ts (200 строк)
- types/recurringPlan.ts (50 строк)
- utils/validation.ts (добавлено validateRecurringPlan)
```

**Impact:** Упрощает понимание skill для разработчиков

---

### 2. Validation Helpers не упоминаются ⚠️ MEDIUM PRIORITY

**Проблема:**
В `utils/validation.ts` есть готовые функции (`validateArticle`, `validateFact`, `amountToCents`), но templates используют `validate{Model}()` без объяснения как их создать.

**Текущий код в validation.ts:**
```typescript
export function validateFact(fact: {
  amount: number;
  date: string;
  record_type: string;
  user_id: number;
  article_id: number;
}): void {
  // 66 строк валидации
}
```

**Текущий template в skill:**
```typescript
// Validate перед insert
validate{Model}(data);  // ⚠️ Где эта функция?
```

**Рекомендация:**
Добавить в **"Generated Files"** секцию для validation:

```markdown
**Generated Files:**
```
frontend/shared/db/dexie/operations/{model}Operations.ts  # CRUD operations
frontend/shared/db/dexie/types/{model}.ts                 # Type definitions
frontend/shared/db/dexie/utils/validation.ts              # Validation (add validate{Model})
```

**Template for Validation Function:**
```typescript
// frontend/shared/db/dexie/utils/validation.ts (add to existing file)

/**
 * Validate Local{Model} before insert/update
 */
export function validate{Model}(data: {
  field1: type1;
  field2: type2;
  amount?: number;  // Optional amount field
}): void {
  // Validate required fields
  if (!data.field1 || data.field1.trim().length === 0) {
    throw new Error('{Model} field1 cannot be empty');
  }

  // Validate amount (if applicable)
  if (data.amount !== undefined && !validateAmount(data.amount)) {
    throw new Error(`Invalid amount: ${data.amount}. Must be a positive number`);
  }

  // Add other field-specific validation
}
```
```

**Impact:** Уменьшает дублирование кода, улучшает consistency

---

### 3. Hash/UUID Utilities не упоминаются ⚠️ MEDIUM PRIORITY

**Проблема:**
Templates используют `calculateContentHash()` и `generateUUID()` без импортов и reference.

**Текущий template:**
```typescript
const temp_id = generateUUID();  // ⚠️ Откуда импорт?
const content_hash = await calculateContentHash(data as Record<string, unknown>);
```

**Рекомендация:**
Добавить в начале каждого template секцию **"Required Imports"**:

```markdown
**Template: CREATE Operation**

**Required Imports:**
```typescript
import { db, toCents, fromCents } from '../core/database';
import { logger } from '../utils/logger';
import { validate{Model} } from '../utils/validation';
import { calculateContentHash, generateUUID } from '../utils/hash';
import type { Local{Model} } from '../types/{model}';
```

**Utility Functions Reference:**
- `generateUUID()`: Creates RFC 4122 UUID v4 for temp_id
- `calculateContentHash(data)`: SHA-256 hash for deduplication (async)
- `toCents(amount)`: Convert dollars to integer cents
- `fromCents(cents)`: Convert cents to dollars

См. [hash.ts](../../frontend/shared/db/dexie/utils/hash.ts) для implementation details.
```

**Impact:** Улучшает developer experience, уменьшает ошибки импорта

---

### 4. Conflict Resolution не раскрыт ⚠️ HIGH PRIORITY

**Проблема:**
Упоминается `sync_status: 'conflict'` но нет template как разрешать конфликты.

**Текущее упоминание:**
```markdown
### 3. Sync Status Tracking
- `'conflict'` - Sync conflict (needs resolution)
```

**Рекомендация:**
Добавить новую команду **"Command: conflict-resolution"** или секцию в sync-operations:

```markdown
### Conflict Resolution Strategy

**Когда возникает конфликт:**
- Local version изменена (sync_status: 'pending')
- Server version тоже изменена (другой updated_at)
- При upload получаем 409 Conflict

**Template: Detect and Log Conflict**
```typescript
/**
 * Handle sync conflict
 * Сохраняет конфликт в syncConflicts table для manual resolution
 */
async function handleConflict(
  temp_id: string,
  localVersion: Local{Model},
  serverVersion: Local{Model}
): Promise<void> {
  logger.warn('[{model}Sync] Conflict detected', { temp_id });

  // Save to conflicts table
  await db.syncConflicts.add({
    entity_type: '{model}',
    entity_id: serverVersion.id,
    temp_id: temp_id,
    local_version: localVersion as Record<string, unknown>,
    server_version: serverVersion as Record<string, unknown>,
    resolution: null,
    resolved_at: null,
    created_at: new Date()
  });

  // Mark local item as conflict
  await db.{models}.where('temp_id').equals(temp_id).modify({
    sync_status: 'conflict'
  });

  logger.info('[{model}Sync] Conflict saved for manual resolution');
}
```

**Resolution Strategies:**
1. **Server Wins**: Replace local with server version
2. **Client Wins**: Force upload local version
3. **Merge**: Combine changes (requires custom logic)
4. **Manual**: Present to user in UI

**Template: Resolve Conflict (Server Wins)**
```typescript
export async function resolveConflict(
  conflictId: number,
  strategy: 'server' | 'client' | 'manual' = 'server'
): Promise<void> {
  const conflict = await db.syncConflicts.get(conflictId);
  if (!conflict) throw new Error(`Conflict not found: ${conflictId}`);

  if (strategy === 'server') {
    // Server wins - replace local with server version
    const serverVersion = conflict.server_version as Local{Model};

    await db.{models}.where('temp_id').equals(conflict.temp_id!).modify({
      ...serverVersion,
      sync_status: 'synced',
      synced_at: new Date()
    });

    // Mark conflict as resolved
    await db.syncConflicts.update(conflictId, {
      resolution: 'server',
      resolved_at: new Date()
    });

    logger.info('[{model}Sync] ✅ Conflict resolved (server wins)', { conflictId });
  }
  // ... other strategies
}
```
```

**Impact:** Критично для production offline-first приложений

---

### 5. Bulk Operations не покрыты ⚠️ MEDIUM PRIORITY

**Проблема:**
Есть `bulkOperations.ts` в codebase, но нет template в skill.

**Текущий код:**
```typescript
// frontend/shared/db/dexie/operations/bulkOperations.ts
export async function bulkInsertFacts(facts: LocalBudgetFact[]): Promise<void> {
  // 50+ строк implementation
}
```

**Рекомендация:**
Добавить в **Command: offline-crud** секцию **"Template: BULK Operations"**:

```markdown
**Template: BULK CREATE**
```typescript
/**
 * Bulk insert {models} (optimized for large datasets)
 * Использует Dexie bulkAdd для atomic transaction
 */
export async function bulkCreate{Models}(
  items: Omit<Local{Model}, 'id' | 'temp_id' | 'sync_status' | 'content_hash' | 'created_at' | 'updated_at' | 'synced_at'>[]
): Promise<number> {
  logger.info('[Dexie] Bulk creating {models}', { count: items.length });

  const newItems: Local{Model}[] = items.map(item => ({
    id: null,
    temp_id: generateUUID(),
    ...item,
    amount: toCents(item.amount), // If applicable
    sync_status: 'pending',
    content_hash: '', // Will calculate later
    created_at: new Date(),
    updated_at: new Date(),
    synced_at: null
  }));

  // Use bulkAdd (atomic transaction)
  await db.{models}.bulkAdd(newItems);

  logger.info('[Dexie] ✅ Bulk create complete', { count: newItems.length });
  return newItems.length;
}
```

**Performance Note:**
- Bulk operations are ~10x faster than individual inserts
- Use for datasets > 100 items
- Batch size recommendation: 1000-5000 items per bulkAdd
```

**Impact:** Улучшает performance guidance

---

### 6. Type Definitions Template отсутствует ⚠️ MEDIUM PRIORITY

**Проблема:**
В "Generated Files" упоминается `types/{model}.ts` но нет template.

**Рекомендация:**
Добавить секцию **"Template: Type Definitions"**:

```markdown
**Template: Type Definitions**
```typescript
// frontend/shared/db/dexie/types/{model}.ts

/**
 * Local{Model} - client-side representation
 */
export interface Local{Model} {
  id: number | null;          // Server ID (null for pending creates)
  temp_id: string;            // Client-side UUID

  // Domain fields
  field1: type1;
  field2: type2 | null;       // Nullable field
  amount: number;             // ⚠️ STORED AS CENTS (integer): $123.45 = 12345

  // Sync tracking
  sync_status: 'synced' | 'pending' | 'conflict' | 'deleted';
  content_hash: string | null; // SHA-256 for deduplication

  // Timestamps
  created_at: Date;
  updated_at: Date;
  synced_at: Date | null;
}

/**
 * Filters for querying {models}
 */
export interface {Model}Filters {
  user_id?: number;
  field1?: type1;
  field2?: type2;
  sync_status?: 'synced' | 'pending' | 'conflict' | 'deleted';
  // Add other filter fields
}
```

**ВАЖНО:**
- Amount fields должны иметь комментарий о cents storage
- sync_status MUST be union type (не string)
- Filters interface для type-safe queries
```

**Impact:** Улучшает type safety, уменьшает ошибки

---

### 7. Offline Indicator Integration ⚠️ LOW PRIORITY

**Проблема:**
Templates используют `pgliteIndicator` (legacy название) без объяснения.

**Текущий код:**
```typescript
if (typeof window !== 'undefined') {
  (window as any).pgliteIndicator?.onSyncStart();  // ⚠️ Legacy name
}
```

**Рекомендация:**
Добавить секцию **"Sync Indicator Integration"** в Key Patterns:

```markdown
### 6. Sync Indicator Integration

**Purpose:** Visual feedback для user о sync status

**Implementation:**
```typescript
// Trigger sync start indicator
if (typeof window !== 'undefined') {
  (window as any).pgliteIndicator?.onSyncStart();
}

// ... operation

// Trigger sync complete
if (typeof window !== 'undefined') {
  (window as any).pgliteIndicator?.onSyncComplete();
}

// Or on error
if (typeof window !== 'undefined') {
  (window as any).pgliteIndicator?.onSyncError(error);
}
```

**Note:** `pgliteIndicator` - legacy название от PGlite миграции. В будущем будет переименовано в `offlineIndicator`.

**Reference:** См. [pwa.md](../../docs/architecture/pwa.md#sync-indicator) для UI implementation.
```

**Impact:** Уменьшает confusion о legacy naming

---

### 8. Transaction Patterns не показаны ⚠️ MEDIUM PRIORITY

**Проблема:**
Dexie поддерживает atomic transactions, но templates не показывают как их использовать.

**Рекомендация:**
Добавить в Key Patterns секцию **"Atomic Transactions"**:

```markdown
### 7. Atomic Transactions

**Когда использовать:**
- Несколько связанных операций должны выполниться atomically
- Create с pending operation (должны быть вместе)
- Update нескольких таблиц одновременно

**Pattern:**
```typescript
import { db } from '../core/database';

// Atomic transaction: create fact + pending operation
await db.transaction('rw', [db.budgetFacts, db.pendingOperations], async () => {
  // 1. Insert fact
  await db.budgetFacts.add(newFact);

  // 2. Add pending operation
  await db.pendingOperations.add(pendingOp);

  // Both succeed or both fail (atomic)
});
```

**ВАЖНО:**
- Используйте `db.transaction()` для multi-table operations
- Все операции внутри transaction должны быть на тех же tables что указаны в параметрах
- Transactions автоматически rollback при ошибке
```

**Impact:** Улучшает data consistency patterns

---

### 9. Testing Strategy не детализирована ⚠️ LOW PRIORITY

**Проблема:**
В Validation Checklist упоминается "Tests: Создан test файл" но нет template.

**Рекомендация:**
Добавить секцию **"Testing Template"** в конце Commands:

```markdown
## Testing

### Template: Unit Tests

**File:** `frontend/shared/db/dexie/__tests__/{model}Operations.test.ts`

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../core/database';
import { create{Model}, query{Models}, update{Model}, delete{Model} } from '../operations/{model}Operations';

describe('{Model} Operations', () => {
  beforeEach(async () => {
    // Clear table before each test
    await db.{models}.clear();
    await db.pendingOperations.clear();
  });

  it('should create {model} with cents conversion', async () => {
    const temp_id = await create{Model}({
      field1: 'test',
      amount: 123.45,  // Dollars
      // ... other fields
    });

    const created = await db.{models}.where('temp_id').equals(temp_id).first();
    expect(created).toBeDefined();
    expect(created!.amount).toBe(12345);  // Cents
    expect(created!.sync_status).toBe('pending');
  });

  it('should add pending operation on create', async () => {
    const temp_id = await create{Model}({ /* ... */ });

    const pending = await db.pendingOperations
      .where('temp_id').equals(temp_id)
      .first();

    expect(pending).toBeDefined();
    expect(pending!.operation).toBe('create');
    expect(pending!.entity_type).toBe('{model}');
  });

  it('should query with filters and cents conversion', async () => {
    // Create test data
    await create{Model}({ amount: 100.50, /* ... */ });
    await create{Model}({ amount: 200.75, /* ... */ });

    const results = await query{Models}();
    expect(results).toHaveLength(2);
    expect(results[0].amount).toBe(100.50);  // Converted back to dollars
  });

  it('should update and mark as pending', async () => {
    const temp_id = await create{Model}({ amount: 100, /* ... */ });

    await update{Model}(temp_id, { amount: 150 });

    const updated = await db.{models}.where('temp_id').equals(temp_id).first();
    expect(updated!.amount).toBe(15000);  // 150 * 100 cents
    expect(updated!.sync_status).toBe('pending');
  });

  it('should soft delete', async () => {
    const temp_id = await create{Model}({ /* ... */ });

    await delete{Model}(temp_id);

    const deleted = await db.{models}.where('temp_id').equals(temp_id).first();
    expect(deleted!.sync_status).toBe('deleted');
  });
});
```

**Run Tests:**
```bash
npm run test:dexie  # или npm test
```
```

**Impact:** Упрощает TDD, улучшает code quality

---

### 10. Performance Guidance отсутствует ⚠️ LOW PRIORITY

**Проблема:**
Нет guidance по batch size, pagination, index optimization.

**Рекомендация:**
Добавить секцию **"## Performance Best Practices"** после Validation Checklist:

```markdown
## Performance Best Practices

### 1. Batch Size для Bulk Operations
- **Recommendation:** 1000-5000 items per `bulkAdd()`/`bulkPut()`
- **Too small** (< 100): Overhead от multiple transactions
- **Too large** (> 10000): Memory pressure, UI blocking

### 2. Pagination для Large Datasets
```typescript
// Query with pagination
async function query{Models}Paginated(
  filters: {Model}Filters,
  offset: number = 0,
  limit: number = 50
): Promise<Local{Model}[]> {
  let query = db.{models}.orderBy('created_at');

  // Apply filters via compound index if possible
  if (filters.user_id) {
    query = db.{models}.where('user_id').equals(filters.user_id);
  }

  return await query.offset(offset).limit(limit).toArray();
}
```

### 3. Index Optimization
**Add index если:**
- Частые queries по этому полю
- Используется в WHERE или ORDER BY

**Remove index если:**
- Поле редко используется в queries
- Слишком много indexes (> 5-7 per table) замедляет writes

**Check index usage:**
```typescript
// Good: uses [user_id+date] compound index
await db.budgetFacts
  .where('[user_id+date]')
  .between([userId, dateFrom], [userId, dateTo])
  .toArray();

// Bad: full table scan
await db.budgetFacts
  .filter(fact => fact.user_id === userId && fact.date >= dateFrom)
  .toArray();
```

### 4. Memory Management
- Clear unused tables: `await db.{models}.clear()`
- Delete old data periodically (data pruning)
- Monitor IndexedDB quota: `navigator.storage.estimate()`
```

**Impact:** Улучшает production performance

---

### 11. Error Handling не стандартизирован ⚠️ LOW PRIORITY

**Проблема:**
Разные error messages в разных местах, нет стандартных error codes.

**Рекомендация:**
Добавить в Common Mistakes секцию **"Standard Error Codes"**:

```markdown
### 6. Inconsistent Error Handling

**Problem:** Разные error messages для одинаковых ошибок

**Solution: Standard Error Codes**

```typescript
// frontend/shared/db/dexie/utils/errors.ts

export class DexieOperationError extends Error {
  constructor(
    public code: string,
    message: string,
    public context?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'DexieOperationError';
  }
}

// Standard error codes
export const ERROR_CODES = {
  VALIDATION_ERROR: 'DEXIE_VALIDATION_ERROR',
  NOT_FOUND: 'DEXIE_NOT_FOUND',
  SYNC_ERROR: 'DEXIE_SYNC_ERROR',
  CONFLICT: 'DEXIE_CONFLICT',
  NETWORK_ERROR: 'DEXIE_NETWORK_ERROR',
} as const;

// Usage in operations
if (!item) {
  throw new DexieOperationError(
    ERROR_CODES.NOT_FOUND,
    `{Model} not found: ${temp_id}`,
    { temp_id }
  );
}
```

**Benefits:**
- Consistent error handling
- Easy error tracking/monitoring
- Type-safe error codes
```

**Impact:** Улучшает error handling, упрощает debugging

---

### 12. WebSocket Integration не детализирована ⚠️ LOW PRIORITY

**Проблема:**
Упоминается в Related Skills но нет template.

**Рекомендация:**
Добавить в Related Skills секцию **"Integration Example: WebSocket"**:

```markdown
**Integration Example: WebSocket → Dexie Sync**

```typescript
// frontend/web/static/js/budget/budgetWSClient.ts

import { getDexieManager } from '@db/dexie';

// Listen for server-side updates
budgetWSClient.on('{model}_created', async (event) => {
  const manager = getDexieManager();

  // Download new item from server
  const response = await fetch(`/api/v1/{models}/${event.data.id}`);
  const serverItem = await response.json();

  // Insert into local Dexie (with cents conversion)
  await db.{models}.put({
    ...serverItem,
    amount: toCents(serverItem.amount),
    sync_status: 'synced',
    synced_at: new Date()
  });

  logger.info('[WS] {Model} synced from server', { id: event.data.id });
});
```

**Reference:** См. **websocket-realtime** skill для WebSocket event patterns.
```

**Impact:** Упрощает integration с WebSocket

---

## Приоритизация улучшений

### HIGH Priority (добавить в v1.1.0)
1. ✅ **Examples Section** - Конкретные примеры использования (RecurringPlan, ShoppingList)
2. ✅ **Conflict Resolution** - Template для разрешения конфликтов
3. ✅ **Validation Helpers** - Упоминание и template для validate{Model}()
4. ✅ **Hash/UUID Imports** - Required imports в каждом template

### MEDIUM Priority (добавить в v1.2.0)
5. ✅ **Bulk Operations** - Template для bulk create/update/delete
6. ✅ **Type Definitions** - Template для types/{model}.ts
7. ✅ **Transaction Patterns** - Atomic transactions examples
8. ✅ **Testing Template** - Unit tests для CRUD operations

### LOW Priority (добавить в v1.3.0)
9. ✅ **Performance Guidance** - Batch size, pagination, indexes
10. ✅ **Offline Indicator** - Объяснение pgliteIndicator
11. ✅ **Error Codes** - Стандартизация error handling
12. ✅ **WebSocket Integration** - Примеры integration

---

## Предлагаемая структура v1.1.0

### Добавить секции:

**После "Commands":**
```markdown
## Examples
### Example 1: RecurringPlan CRUD
### Example 2: ShoppingList Bulk Operations
### Example 3: Conflict Resolution
```

**В "Command: offline-crud" добавить:**
```markdown
**Required Imports:** (перед каждым template)
**Template: BULK CREATE** (после DELETE)
**Template: Type Definitions** (после CRUD operations)
**Template: Validation Function** (после Type Definitions)
```

**В "Command: sync-operations" добавить:**
```markdown
**Template: CONFLICT RESOLUTION** (после AUTO-SYNC)
```

**В "Key Patterns" добавить:**
```markdown
### 6. Sync Indicator Integration
### 7. Atomic Transactions
```

**После "Validation Checklist":**
```markdown
## Performance Best Practices
## Testing Template
```

**В "Common Mistakes" добавить:**
```markdown
### 6. Inconsistent Error Handling
```

---

## Оценка трудозатрат

**v1.1.0 (HIGH Priority):**
- Examples Section: ~100 строк
- Conflict Resolution: ~80 строк
- Validation Helpers: ~60 строк
- Required Imports: ~30 строк
- **Итого:** ~270 строк (+30% от текущего)

**v1.2.0 (MEDIUM Priority):**
- Bulk Operations: ~60 строк
- Type Definitions: ~40 строк
- Transaction Patterns: ~50 строк
- Testing Template: ~80 строк
- **Итого:** ~230 строк

**v1.3.0 (LOW Priority):**
- Performance Guidance: ~70 строк
- Offline Indicator: ~30 строк
- Error Codes: ~40 строк
- WebSocket Integration: ~40 строк
- **Итого:** ~180 строк

**Total v1.3.0:** 880 (current) + 270 + 230 + 180 = **1560 строк**

---

## Заключение

Skill находится в **production-ready** состоянии для базовых CRUD операций, но требует улучшений для advanced use cases (conflict resolution, bulk operations, testing).

**Рекомендация:** Реализовать v1.1.0 (HIGH Priority) в первую очередь, т.к. эти секции критичны для production offline-first приложений.

**Next Steps:**
1. Создать branch `feature/dexie-management-v1.1`
2. Добавить секции из HIGH Priority
3. Обновить version в frontmatter (1.0.0 → 1.1.0)
4. Тестирование на реальном примере (RecurringPlan)
5. Commit + merge to test
