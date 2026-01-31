# RecurringPlan CRUD Example

Real offline-first CRUD implementation for RecurringPlan model with Dexie.js.

## Context

RecurringPlan - регулярные платежи (зарплата, аренда, подписки).
- Используется для автоматического создания budget facts
- Amount хранится в cents для точности

## Task

```
Создай offline-first CRUD operations для модели RecurringPlan с Dexie.js.
Поля: user_id (number), article_id (number), financial_center_id (number),
      amount (number, cents), frequency (string), day_of_month (number), is_active (boolean)
Amount field: amount
```

## Generated Files

### Type Definitions

`frontend/shared/db/dexie/types/recurringPlan.ts` (60 строк):

```typescript
export interface LocalRecurringPlan {
  id: number | null;
  temp_id: string;
  user_id: number;
  article_id: number;
  financial_center_id: number;
  amount: number;  // ⚠️ STORED AS CENTS
  frequency: string;
  day_of_month: number | null;
  is_active: boolean;
  sync_status: 'synced' | 'pending' | 'conflict' | 'deleted';
  content_hash: string | null;
  created_at: Date;
  updated_at: Date;
  synced_at: Date | null;
}

export interface RecurringPlanFilters {
  user_id?: number;
  article_id?: number;
  is_active?: boolean;
  frequency?: string;
}
```

### Validation

`frontend/shared/db/dexie/utils/validation.ts` (добавить):

```typescript
export function validateRecurringPlan(plan: {
  amount: number;
  frequency: string;
  day_of_month: number | null;
}): void {
  if (!validateAmount(plan.amount)) {
    throw new Error(`Invalid amount: ${plan.amount}`);
  }

  const allowedFrequencies = ['daily', 'weekly', 'monthly', 'yearly'] as const;
  if (!validateType(plan.frequency, allowedFrequencies)) {
    throw new Error(`Invalid frequency: ${plan.frequency}`);
  }

  if (plan.day_of_month !== null) {
    if (!Number.isInteger(plan.day_of_month) ||
        plan.day_of_month < 1 ||
        plan.day_of_month > 31) {
      throw new Error(`Invalid day_of_month: ${plan.day_of_month}`);
    }
  }
}
```

### CRUD Operations

`frontend/shared/db/dexie/operations/recurringPlanOperations.ts` (200 строк):

```typescript
import { db, toCents, fromCents } from '../core/database';
import { logger } from '../utils/logger';
import { validateRecurringPlan } from '../utils/validation';
import { calculateContentHash, generateUUID } from '../utils/hash';
import type { LocalRecurringPlan, RecurringPlanFilters } from '../types/recurringPlan';

export async function createRecurringPlan(
  data: Omit<LocalRecurringPlan, 'id' | 'temp_id' | 'sync_status' | 'content_hash' | 'created_at' | 'updated_at' | 'synced_at'>
): Promise<string> {
  const temp_id = generateUUID();
  const content_hash = await calculateContentHash(data as Record<string, unknown>);

  validateRecurringPlan(data);

  const newPlan: LocalRecurringPlan = {
    id: null,
    temp_id,
    ...data,
    amount: toCents(data.amount),  // Convert to cents
    sync_status: 'pending',
    content_hash,
    created_at: new Date(),
    updated_at: new Date(),
    synced_at: null
  };

  await db.recurringPlans.add(newPlan);

  // Add to pending queue
  await db.pendingOperations.add({
    operation: 'create',
    entity_type: 'recurring_plan',
    temp_id,
    server_id: null,
    payload: data as Record<string, unknown>,
    attempts: 0,
    max_attempts: 3,
    last_error: null,
    content_hash,
    created_at: new Date(),
    updated_at: new Date()
  });

  logger.info('[Dexie] ✅ RecurringPlan created', { temp_id });
  return temp_id;
}

export async function queryRecurringPlans(
  filters?: RecurringPlanFilters
): Promise<LocalRecurringPlan[]> {
  let results = await db.recurringPlans.toArray();

  if (filters) {
    results = results.filter(plan => {
      if (filters.user_id && plan.user_id !== filters.user_id) return false;
      if (filters.article_id && plan.article_id !== filters.article_id) return false;
      if (filters.is_active !== undefined && plan.is_active !== filters.is_active) return false;
      if (filters.frequency && plan.frequency !== filters.frequency) return false;
      return true;
    });
  }

  // Convert amount from cents to dollars
  return results.map(plan => ({
    ...plan,
    amount: fromCents(plan.amount)
  }));
}
```

## Usage

```typescript
// Create recurring plan for monthly salary
const temp_id = await createRecurringPlan({
  user_id: 1,
  article_id: 5,  // "Зарплата"
  financial_center_id: 2,
  amount: 100000,  // $100,000 (will be stored as 10,000,000 cents)
  frequency: 'monthly',
  day_of_month: 25,
  is_active: true
});

// Query active plans
const activePlans = await queryRecurringPlans({
  user_id: 1,
  is_active: true
});
```
