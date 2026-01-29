/**
 * Fact and Plan Data Sync Operations
 *
 * Syncs transactional data (facts and plans) to PGlite:
 * - Budget Facts: Within retention window (Facts Window parameter)
 * - Recurring Plans: Active plans only
 */

import type { PGlite } from '@electric-sql/pglite';
import { logger } from '../utils/logger';
import { fetchWithTimeout } from '../utils/fetchWithTimeout';
import { withRetry } from '../utils/retry';

/**
 * Fact data from API
 */
export interface ApiFact {
  id: number;
  user_id: number;
  article_id: number;
  financial_center_id: number | null;
  cost_center_id: number | null;
  fact_date: string;  // ISO date string
  amount: number | string;
  record_type: 'fact' | 'plan';
  comment: string | null;
  transfer_group_id: string | null;
  is_transfer: boolean;
}

/**
 * Recurring plan data from API
 */
export interface ApiRecurringPlan {
  id: number;
  user_id: number;
  article_id: number;
  financial_center_id: number | null;
  cost_center_id: number | null;
  amount: number | string;
  day_of_month: number | null;
  frequency: string;
  is_active: boolean;
  created_at: string;
}

/**
 * Response from facts API
 */
interface FactListResponse {
  facts: ApiFact[];
  total: number;
  limit: number;
  offset: number;
}

/**
 * Response from recurring plans API
 */
interface RecurringPlanListResponse {
  recurring_plans: ApiRecurringPlan[];
  total: number;
  limit: number;
  skip: number;
}

/**
 * Progress callback for UI updates
 */
export type FactSyncProgressCallback = (progress: {
  phase: string;
  message: string;
  current?: number;
  total?: number;
}) => void;

/**
 * Sync facts within retention window
 *
 * @param db - PGlite database instance
 * @param factsWindow - Number of days to sync (default: 90 days)
 * @param onProgress - Optional progress callback
 * @returns Number of facts synced
 */
export async function syncFacts(
  db: PGlite,
  factsWindow = 90,
  onProgress?: FactSyncProgressCallback
): Promise<number> {
  logger.info('[FACT_SYNC] Syncing facts...', { factsWindow });

  return withRetry(
    async () => {
      onProgress?.({ phase: 'facts', message: 'Fetching facts from API...', current: 0, total: 0 });

      // Calculate date range
      const dateTo = new Date();
      const dateFrom = new Date();
      dateFrom.setDate(dateFrom.getDate() - factsWindow);

      const dateFromStr = dateFrom.toISOString().split('T')[0];
      const dateToStr = dateTo.toISOString().split('T')[0];

      // Fetch facts from API
      const params = new URLSearchParams({
        date_from: dateFromStr,
        date_to: dateToStr,
        limit: '10000',  // Max limit
        offset: '0'
      });

      const response = await fetchWithTimeout(
        `/api/v1/facts?${params.toString()}`,
        { credentials: 'include' },
        10000
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch facts: HTTP ${response.status}`);
      }

      const data: FactListResponse = await response.json();
      const facts = data.facts || [];

      logger.info('[FACT_SYNC] Fetched facts from API', {
        count: facts.length,
        dateFrom: dateFromStr,
        dateTo: dateToStr
      });

      if (facts.length === 0) {
        logger.info('[FACT_SYNC] No facts to sync');
        return 0;
      }

      onProgress?.({ phase: 'facts', message: 'Inserting facts into PGlite...', current: 0, total: facts.length });

      // Clear existing facts before inserting new ones
      await db.query('DELETE FROM local_budget_facts WHERE sync_status = \'synced\'');
      logger.info('[FACT_SYNC] Cleared existing synced facts');

      // Insert facts in batches
      const batchSize = 100;
      let insertedCount = 0;

      for (let i = 0; i < facts.length; i += batchSize) {
        const batch = facts.slice(i, i + batchSize);

        // Build VALUES clause for batch insert
        const values = batch.map(fact => {
          const temp_id = `server_${fact.id}`;
          const amount = typeof fact.amount === 'string' ? parseFloat(fact.amount) : fact.amount;

          // Generate UUID for temp_id if needed
          const tempIdValue = temp_id;

          return `(
            ${fact.id},
            '${tempIdValue}',
            ${fact.user_id},
            ${fact.article_id},
            ${fact.financial_center_id ?? 'NULL'},
            ${fact.cost_center_id ?? 'NULL'},
            '${fact.fact_date}',
            ${amount},
            '${fact.record_type}',
            ${fact.comment ? `'${fact.comment.replace(/'/g, "''")}'` : 'NULL'},
            ${fact.transfer_group_id ? `'${fact.transfer_group_id}'` : 'NULL'},
            ${fact.is_transfer ? 'TRUE' : 'FALSE'},
            'synced',
            NULL,
            NULL,
            NOW(),
            NOW(),
            NOW()
          )`;
        }).join(',\n');

        const insertSQL = `
          INSERT INTO local_budget_facts (
            id, temp_id, user_id, article_id, financial_center_id, cost_center_id,
            date, amount, record_type, comment, transfer_group_id, is_transfer,
            sync_status, sync_hash, content_hash,
            created_at, updated_at, synced_at
          ) VALUES ${values}
          ON CONFLICT (temp_id) DO UPDATE SET
            id = EXCLUDED.id,
            user_id = EXCLUDED.user_id,
            article_id = EXCLUDED.article_id,
            financial_center_id = EXCLUDED.financial_center_id,
            cost_center_id = EXCLUDED.cost_center_id,
            date = EXCLUDED.date,
            amount = EXCLUDED.amount,
            record_type = EXCLUDED.record_type,
            comment = EXCLUDED.comment,
            transfer_group_id = EXCLUDED.transfer_group_id,
            is_transfer = EXCLUDED.is_transfer,
            updated_at = NOW(),
            synced_at = NOW()
        `;

        await db.query(insertSQL);
        insertedCount += batch.length;

        onProgress?.({ phase: 'facts', message: 'Inserting facts...', current: insertedCount, total: facts.length });

        logger.info('[FACT_SYNC] Inserted batch', {
          batchStart: i,
          batchEnd: i + batch.length,
          total: facts.length
        });
      }

      logger.info('[FACT_SYNC] Facts sync completed', { count: insertedCount });
      return insertedCount;
    },
    {
      maxAttempts: 3,
      baseDelay: 2000,
      operationName: 'sync facts',
      shouldRetry: (error) => {
        // Don't retry for critical authentication errors
        return !error.message?.includes('401') && !error.message?.includes('403');
      }
    }
  );
}

/**
 * Sync active recurring plans
 *
 * @param db - PGlite database instance
 * @param onProgress - Optional progress callback
 * @returns Number of plans synced
 */
export async function syncRecurringPlans(
  db: PGlite,
  onProgress?: FactSyncProgressCallback
): Promise<number> {
  logger.info('[PLAN_SYNC] Syncing recurring plans...');

  return withRetry(
    async () => {
      onProgress?.({ phase: 'plans', message: 'Fetching recurring plans from API...', current: 0, total: 0 });

      // Fetch active plans from API
      const params = new URLSearchParams({
        is_active: 'true',
        limit: '100',  // Max limit per API constraint (le=100)
        skip: '0'
      });

      const response = await fetchWithTimeout(
        `/api/v1/recurring-plans?${params.toString()}`,
        { credentials: 'include' },
        10000
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch recurring plans: HTTP ${response.status}`);
      }

      const data: RecurringPlanListResponse = await response.json();
      const plans = data.recurring_plans || [];

      logger.info('[PLAN_SYNC] Fetched plans from API', { count: plans.length });

      if (plans.length === 0) {
        logger.info('[PLAN_SYNC] No plans to sync');
        return 0;
      }

      onProgress?.({ phase: 'plans', message: 'Inserting plans into PGlite...', current: 0, total: plans.length });

      // Clear existing plans before inserting new ones
      await db.query('DELETE FROM local_recurring_plans');
      logger.info('[PLAN_SYNC] Cleared existing plans');

      // Insert plans
      const values = plans.map(plan => {
        const amount = typeof plan.amount === 'string' ? parseFloat(plan.amount) : plan.amount;

        return `(
          ${plan.id},
          ${plan.user_id},
          ${plan.article_id},
          ${plan.financial_center_id ?? 'NULL'},
          ${plan.cost_center_id ?? 'NULL'},
          ${amount},
          ${plan.day_of_month ?? 'NULL'},
          '${plan.frequency}',
          ${plan.is_active ? 'TRUE' : 'FALSE'},
          '${plan.created_at}'
        )`;
      }).join(',\n');

      const insertSQL = `
        INSERT INTO local_recurring_plans (
          id, user_id, article_id, financial_center_id, cost_center_id,
          amount, day_of_month, frequency, is_active, created_at
        ) VALUES ${values}
        ON CONFLICT (id) DO UPDATE SET
          user_id = EXCLUDED.user_id,
          article_id = EXCLUDED.article_id,
          financial_center_id = EXCLUDED.financial_center_id,
          cost_center_id = EXCLUDED.cost_center_id,
          amount = EXCLUDED.amount,
          day_of_month = EXCLUDED.day_of_month,
          frequency = EXCLUDED.frequency,
          is_active = EXCLUDED.is_active
      `;

      await db.query(insertSQL);

      logger.info('[PLAN_SYNC] Plans sync completed', { count: plans.length });
      onProgress?.({ phase: 'plans', message: 'Plans synced', current: plans.length, total: plans.length });

      return plans.length;
    },
    {
      maxAttempts: 3,
      baseDelay: 2000,
      operationName: 'sync recurring plans',
      shouldRetry: (error) => {
        // Don't retry for critical authentication errors
        return !error.message?.includes('401') && !error.message?.includes('403');
      }
    }
  );
}

/**
 * Sync both facts and plans
 *
 * @param db - PGlite database instance
 * @param factsWindow - Number of days to sync facts (default: 90 days)
 * @param onProgress - Optional progress callback
 * @returns Object with counts { facts, plans }
 */
export async function syncFactsAndPlans(
  db: PGlite,
  factsWindow = 90,
  onProgress?: FactSyncProgressCallback
): Promise<{ facts: number; plans: number }> {
  logger.info('[FACT_PLAN_SYNC] Starting sync...', { factsWindow });

  const factsCount = await syncFacts(db, factsWindow, onProgress);
  const plansCount = await syncRecurringPlans(db, onProgress);

  logger.info('[FACT_PLAN_SYNC] Sync completed', { factsCount, plansCount });

  return {
    facts: factsCount,
    plans: plansCount
  };
}
