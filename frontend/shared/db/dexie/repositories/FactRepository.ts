import { db } from '../core/database';
import { mapAPIFactToLocal } from '../utils/apiMapper';
import { generateUUID, calculateContentHash } from '../utils/hash';
import { validateFact } from '../utils/validation';
import { getTabId } from '../utils/tabId';
import { logger } from '../utils/logger';
import type { LocalBudgetFact } from '../types/fact';

/**
 * Server-side fact payload (from API response or WS broadcast).
 * Defined inline to avoid cross-package imports from web/static.
 */
export interface WsFactPayload {
  id: number;
  user_id: number;
  article_id: number;
  financial_center_id: number | null;
  cost_center_id: number | null;
  record_type: string;
  amount: number;
  date?: string;
  fact_date?: string;
  description?: string | null;
  transfer_id?: number | string | null;
  sync_hash?: string | null;
  created_at?: string;
  updated_at?: string;
  tab_origin_id?: string | null;
}

/**
 * Data required to create an offline (pending) fact.
 * Excludes auto-generated fields that the repository manages.
 */
export type OfflineFactData = Omit<
  LocalBudgetFact,
  'id' | 'temp_id' | 'sync_status' | 'content_hash' | 'created_at' | 'updated_at' | 'synced_at' | 'tab_origin_id'
>;

export class FactRepository {
  /**
   * Write a fact received from the API (after successful POST/PATCH).
   * Stamps tab_origin_id so subsequent WS echoes can be skipped.
   */
  async createFromAPI(serverFact: WsFactPayload): Promise<LocalBudgetFact> {
    const mapped = mapAPIFactToLocal({ ...serverFact });
    mapped.tab_origin_id = getTabId();
    mapped.sync_status = 'synced';

    await db.budgetFacts.put(mapped);
    logger.debug('[FactRepository] createFromAPI', { id: mapped.id, temp_id: mapped.temp_id });
    return mapped;
  }

  /**
   * Create a fact locally while offline.
   * Atomically writes the fact + pending operation in one transaction.
   * Returns the temp_id for later confirmation.
   */
  async createOffline(data: OfflineFactData): Promise<string> {
    validateFact({
      amount: data.amount,
      date: data.date,
      record_type: data.record_type,
      user_id: data.user_id,
      article_id: data.article_id,
      is_transfer: data.is_transfer,
    });

    const temp_id = generateUUID();
    const now = new Date();

    const fact: LocalBudgetFact = {
      id: null,
      temp_id,
      ...data,
      sync_status: 'pending',
      content_hash: null,
      created_at: now,
      updated_at: now,
      synced_at: null,
      tab_origin_id: getTabId(),
    };

    // Hash the payload for deduplication
    const payloadForHash: Record<string, unknown> = {
      operation: 'create',
      entity_type: 'fact',
      temp_id,
      user_id: data.user_id,
      article_id: data.article_id,
      amount: data.amount,
      date: data.date,
    };
    const content_hash = await calculateContentHash(payloadForHash);

    await db.transaction('rw', db.budgetFacts, db.pendingOperations, async () => {
      await db.budgetFacts.add(fact);
      await db.pendingOperations.add({
        id: undefined as unknown as number, // auto-incremented by Dexie
        operation: 'create',
        entity_type: 'fact',
        temp_id,
        server_id: null,
        payload: payloadForHash,
        attempts: 0,
        max_attempts: 5,
        last_error: null,
        next_retry_at: null,
        content_hash,
        created_at: now,
        updated_at: now,
      });
    });

    logger.debug('[FactRepository] createOffline', { temp_id });
    return temp_id;
  }

  /**
   * Upsert a fact received via WebSocket from another tab or server.
   *
   * Returns:
   *  - 'skipped'  — event originated from this tab (echo suppression)
   *  - 'created'  — new fact written to Dexie
   *  - 'updated'  — existing fact updated in Dexie
   *
   * Errors propagate — caller decides how to handle WS failures.
   */
  async upsertFromServer(
    serverFact: WsFactPayload
  ): Promise<'skipped' | 'created' | 'updated'> {
    if (serverFact.id === null || serverFact.id === undefined) {
      throw new Error('[FactRepository] upsertFromServer: serverFact.id is required');
    }

    if (serverFact.tab_origin_id === getTabId()) {
      return 'skipped';
    }

    let outcome: 'created' | 'updated' = 'created';

    await db.transaction('rw', db.budgetFacts, async () => {
      const existing = await db.budgetFacts.where('id').equals(serverFact.id).first();

      if (existing) {
        // Pass null to mapper to get all other fields; restore existing.tab_origin_id below to preserve origin tracking
        const mapped = mapAPIFactToLocal({ ...serverFact, tab_origin_id: null });
        await db.budgetFacts.where('temp_id').equals(existing.temp_id).modify({
          ...mapped,
          temp_id: existing.temp_id,
          sync_status: 'synced',
          synced_at: new Date(),
          tab_origin_id: existing.tab_origin_id,
        });
        outcome = 'updated';
      } else {
        const mapped = mapAPIFactToLocal({ ...serverFact });
        mapped.sync_status = 'synced';
        mapped.synced_at = new Date();
        await db.budgetFacts.put(mapped);
        outcome = 'created';
      }
    });

    logger.debug('[FactRepository] upsertFromServer', { id: serverFact.id, outcome });
    return outcome;
  }

  /**
   * Confirm a pending offline fact after the server acknowledges it.
   * Atomically updates the fact record and removes the pending operation.
   */
  async confirmPending(temp_id: string, server_id: number): Promise<void> {
    await db.transaction('rw', db.budgetFacts, db.pendingOperations, async () => {
      await db.budgetFacts.where('temp_id').equals(temp_id).modify({
        id: server_id,
        sync_status: 'synced',
        synced_at: new Date(),
      });
      await db.pendingOperations.where('temp_id').equals(temp_id).delete();
    });

    logger.debug('[FactRepository] confirmPending', { temp_id, server_id });
  }

  /**
   * Bulk-upsert facts from initial sync, in batches to avoid memory spikes.
   */
  async bulkUpsert(
    facts: LocalBudgetFact[],
    onProgress?: (current: number, total: number) => void
  ): Promise<void> {
    const BATCH_SIZE = 1000;
    const total = facts.length;

    for (let i = 0; i < total; i += BATCH_SIZE) {
      const batch = facts.slice(i, i + BATCH_SIZE);
      await db.budgetFacts.bulkPut(batch);
      onProgress?.(Math.min(i + BATCH_SIZE, total), total);
    }
  }

  /**
   * Hard-delete a fact from Dexie by temp_id.
   * Used after server confirms deletion.
   */
  async remove(temp_id: string): Promise<void> {
    await db.budgetFacts.where('temp_id').equals(temp_id).delete();
  }
}

export const factRepo = new FactRepository();
