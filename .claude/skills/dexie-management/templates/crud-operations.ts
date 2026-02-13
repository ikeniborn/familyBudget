/**
 * CRUD Operations Template
 * Замените {Model} и {models} на actual model name
 */

import { db, toCents, fromCents } from '../core/database';
import { logger } from '../utils/logger';
import { validate{Model} } from '../utils/validation';
import { calculateContentHash, generateUUID } from '../utils/hash';
import type { Local{Model}, {Model}Filters } from '../types/{model}';

/**
 * CREATE operation
 */
export async function create{Model}(
  data: Omit<Local{Model}, 'id' | 'temp_id' | 'sync_status' | 'content_hash' | 'created_at' | 'updated_at' | 'synced_at'>
): Promise<string> {
  const temp_id = generateUUID();
  const content_hash = await calculateContentHash(data as Record<string, unknown>);

  validate{Model}(data);

  const new{Model}: Local{Model} = {
    id: null,
    temp_id,
    ...data,
    amount: toCents(data.amount), // ⚠️ Only if amount field exists
    sync_status: 'pending',
    content_hash,
    created_at: new Date(),
    updated_at: new Date(),
    synced_at: null
  };

  await db.{models}.add(new{Model});

  await db.pendingOperations.add({
    operation: 'create',
    entity_type: '{model}',
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

  logger.info('[Dexie] ✅ {Model} created', { temp_id });
  return temp_id;
}

/**
 * QUERY operation
 */
export async function query{Models}(filters?: {Model}Filters): Promise<Local{Model}[]> {
  let results: Local{Model}[];

  // Use compound index if possible
  if (filters?.user_id && filters?.date_from && filters?.date_to) {
    results = await db.{models}
      .where('[user_id+date]')
      .between(
        [filters.user_id, filters.date_from],
        [filters.user_id, filters.date_to],
        true,
        true
      )
      .toArray();
  } else {
    results = await db.{models}.toArray();
  }

  // Apply additional filters
  if (filters) {
    results = results.filter(item => {
      if (filters.user_id && item.user_id !== filters.user_id) return false;
      // Add other filters
      return true;
    });
  }

  // Convert amount from cents
  return results.map(item => ({
    ...item,
    amount: fromCents(item.amount) // ⚠️ Only if amount field exists
  }));
}

/**
 * UPDATE operation
 */
export async function update{Model}(
  temp_id: string,
  updates: Partial<Pick<Local{Model}, 'field1' | 'field2' | 'amount'>>
): Promise<void> {
  const item = await db.{models}.where('temp_id').equals(temp_id).first();
  if (!item) {
    throw new Error(`{Model} not found: ${temp_id}`);
  }

  const updatesWithCents = updates.amount !== undefined
    ? { ...updates, amount: toCents(updates.amount) }
    : updates;

  await db.{models}.where('temp_id').equals(temp_id).modify({
    ...updatesWithCents,
    sync_status: 'pending',
    updated_at: new Date()
  });

  const content_hash = await calculateContentHash({ ...item, ...updates } as Record<string, unknown>);
  await db.pendingOperations.add({
    operation: 'update',
    entity_type: '{model}',
    temp_id,
    server_id: item.id,
    payload: updates as Record<string, unknown>,
    attempts: 0,
    max_attempts: 3,
    last_error: null,
    content_hash,
    created_at: new Date(),
    updated_at: new Date()
  });

  logger.info('[Dexie] ✅ {Model} updated', { temp_id });
}

/**
 * DELETE operation (soft delete)
 */
export async function delete{Model}(temp_id: string): Promise<void> {
  const item = await db.{models}.where('temp_id').equals(temp_id).first();
  if (!item) {
    throw new Error(`{Model} not found: ${temp_id}`);
  }

  await db.{models}.where('temp_id').equals(temp_id).modify({
    sync_status: 'deleted',
    updated_at: new Date()
  });

  await db.pendingOperations.add({
    operation: 'delete',
    entity_type: '{model}',
    temp_id,
    server_id: item.id,
    payload: {},
    attempts: 0,
    max_attempts: 3,
    last_error: null,
    content_hash: '',
    created_at: new Date(),
    updated_at: new Date()
  });

  logger.info('[Dexie] ✅ {Model} deleted', { temp_id });
}
