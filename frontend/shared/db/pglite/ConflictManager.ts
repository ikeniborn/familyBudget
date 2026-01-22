/**
 * ConflictManager - Unified conflict detection and resolution
 * Task-009: Conflict Resolution LWW (Last Write Wins)
 */

import type { PGlite } from '@electric-sql/pglite';
import type { LocalBudgetFact } from './types/models';
import { logger } from './utils/logger';

/**
 * Default conflict metrics when no data available
 */
const DEFAULT_CONFLICT_METRICS: ConflictMetrics = {
  totalConflicts: 0,
  resolvedConflicts: 0,
  pendingConflicts: 0,
  conflictRate: 0,
  resolutionBreakdown: {
    server: 0,
    client: 0,
    merged: 0,
    pending: 0
  }
};

/**
 * Conflict detection result
 */
export interface ConflictDetection {
  entityType: 'budget_fact';
  entityId: number;
  tempId: string;
  localRecord: LocalBudgetFact;
  serverRecord: ServerBudgetFact;
  localUpdatedAt: Date;
  serverUpdatedAt: Date;
}

/**
 * Server budget fact (from incremental sync response)
 */
export interface ServerBudgetFact extends Omit<LocalBudgetFact, 'temp_id'> {
  id: number;
}

/**
 * Conflict metrics for diagnostic UI
 */
export interface ConflictMetrics {
  totalConflicts: number;
  resolvedConflicts: number;
  pendingConflicts: number;
  conflictRate: number; // percentage
  resolutionBreakdown: {
    server: number;
    client: number;
    merged: number;
    pending: number;
  };
}

/**
 * ConflictManager class
 * Handles conflict detection, resolution, logging, and metrics
 */
export class ConflictManager {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  constructor(private db: PGlite) {}

  /**
   * Detect conflicts between local and server records.
   * Compare sync_hash to identify mismatches.
   *
   * @param localRecords - Local budget facts
   * @param serverRecords - Server budget facts from incremental sync
   * @returns Array of detected conflicts
   */
  async detectConflicts(
    localRecords: LocalBudgetFact[],
    serverRecords: ServerBudgetFact[]
  ): Promise<ConflictDetection[]> {
    const conflicts: ConflictDetection[] = [];

    // Create map of server records by ID for O(1) lookup
    // Filter out records without ID and use Map constructor for performance
    const serverMap = new Map(
      serverRecords
        .filter(record => record.id !== null && record.id !== undefined)
        .map(record => [record.id as number, record])
    );

    // Iterate local records and compare sync_hash
    for (const localRecord of localRecords) {
      // Skip deleted records
      if (localRecord.sync_status === 'deleted') {
        continue;
      }

      // Skip if no server ID (new local record)
      if (!localRecord.id) {
        continue;
      }

      const serverRecord = serverMap.get(localRecord.id);
      if (!serverRecord) {
        continue; // No server counterpart
      }

      // Check for missing sync_hash from server (defensive)
      if (!serverRecord.sync_hash) {
        logger.warn('[CONFLICT_DETECT] Server missing sync_hash, skipping', {
          id: serverRecord.id
        });
        continue;
      }

      // Compare sync_hash
      if (localRecord.sync_hash !== serverRecord.sync_hash) {
        // Conflict detected! Parse timestamps with error handling
        let localUpdatedAt: Date;
        let serverUpdatedAt: Date;

        try {
          localUpdatedAt = new Date(localRecord.updated_at);
          serverUpdatedAt = new Date(serverRecord.updated_at);

          // Validate dates are valid
          if (isNaN(localUpdatedAt.getTime()) || isNaN(serverUpdatedAt.getTime())) {
            throw new Error('Invalid date format');
          }
        } catch (dateError) {
          logger.warn('[CONFLICT_DETECT] Invalid date format, skipping conflict', {
            id: localRecord.id,
            localDate: localRecord.updated_at,
            serverDate: serverRecord.updated_at,
            error: dateError
          });
          continue; // Skip this conflict
        }

        conflicts.push({
          entityType: 'budget_fact',
          entityId: localRecord.id,
          tempId: localRecord.temp_id,
          localRecord,
          serverRecord,
          localUpdatedAt,
          serverUpdatedAt
        });
      }
    }

    if (conflicts.length > 0) {
      logger.info('[CONFLICT_DETECT] Found conflicts', { count: conflicts.length });
    }

    return conflicts;
  }

  /**
   * Resolve conflict using Last-Write-Wins strategy.
   * Compare updated_at timestamps, newer wins.
   *
   * @param conflict - Conflict detection result
   * @returns Resolution decision ('server' or 'client')
   */
  resolveLWW(conflict: ConflictDetection): 'server' | 'client' {
    const localTime = conflict.localUpdatedAt.getTime();
    const serverTime = conflict.serverUpdatedAt.getTime();

    if (serverTime > localTime) {
      logger.info('[CONFLICT_LWW] Server wins (newer)', {
        id: conflict.entityId,
        serverTime: conflict.serverUpdatedAt.toISOString(),
        localTime: conflict.localUpdatedAt.toISOString()
      });
      return 'server';
    } else if (localTime > serverTime) {
      logger.info('[CONFLICT_LWW] Client wins (newer)', {
        id: conflict.entityId,
        localTime: conflict.localUpdatedAt.toISOString(),
        serverTime: conflict.serverUpdatedAt.toISOString()
      });
      return 'client';
    } else {
      // Equal timestamps - default to server for consistency
      logger.info('[CONFLICT_LWW] Equal timestamps, defaulting to server', {
        id: conflict.entityId,
        timestamp: conflict.serverUpdatedAt.toISOString()
      });
      return 'server';
    }
  }

  /**
   * Log conflict to local_sync_conflicts table.
   * Store both versions as JSONB for audit.
   *
   * @param conflict - Conflict detection result
   * @param resolution - Resolution decision
   */
  async logConflict(
    conflict: ConflictDetection,
    resolution: 'server' | 'client' | 'pending'
  ): Promise<void> {
    try {
      // Convert records to plain objects (remove Date objects for JSONB)
      const localVersion = this.serializeRecord(conflict.localRecord);
      const serverVersion = this.serializeRecord(conflict.serverRecord);

      // Serialize to JSON with error handling
      let localJson: string;
      let serverJson: string;

      try {
        localJson = JSON.stringify(localVersion);
        serverJson = JSON.stringify(serverVersion);
      } catch (serializeError) {
        logger.error('[CONFLICT_LWW] Failed to serialize record', serializeError);
        throw new Error('Cannot serialize conflict versions for logging');
      }

      // Use parameterized query to prevent SQL injection
      await this.db.query(`
        INSERT INTO local_sync_conflicts (
          entity_type, entity_id, temp_id,
          local_version, server_version,
          resolution, resolved_at, created_at
        ) VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, $6, $7, NOW())
      `, [
        conflict.entityType,
        conflict.entityId,
        conflict.tempId,
        localJson,
        serverJson,
        resolution,
        resolution === 'pending' ? null : new Date()
      ]);

      logger.info('[CONFLICT_LWW] Logged conflict', {
        id: conflict.entityId,
        resolution
      });
    } catch (error) {
      logger.error('[CONFLICT_LWW] Failed to log conflict', error);
      throw error;
    }
  }

  /**
   * Apply resolution to database.
   * Update local_budget_facts with winning version.
   *
   * @param conflict - Conflict detection result
   * @param resolution - Resolution decision
   */
  async applyResolution(
    conflict: ConflictDetection,
    resolution: 'server' | 'client'
  ): Promise<void> {
    try {
      if (resolution === 'server') {
        // Server wins - update local record with server data
        await this.applyServerResolution(conflict);
      } else {
        // Client wins - keep local, mark sync_status='pending' for re-upload
        await this.applyClientResolution(conflict);
      }
    } catch (error) {
      logger.error('[CONFLICT_LWW] Failed to apply resolution', { error });

      // Log as pending for manual review
      await this.logConflict(conflict, 'pending');
      throw error;
    }
  }

  /**
   * Apply server resolution - update local record with server data.
   * Uses parameterized query to prevent SQL injection.
   *
   * @param conflict - Conflict detection result
   */
  private async applyServerResolution(conflict: ConflictDetection): Promise<void> {
    const server = conflict.serverRecord;

    // Use parameterized query to prevent SQL injection
    await this.db.query(`
      UPDATE local_budget_facts SET
        user_id = $1,
        article_id = $2,
        financial_center_id = $3,
        cost_center_id = $4,
        date = $5,
        amount = $6,
        record_type = $7,
        comment = $8,
        transfer_group_id = $9,
        is_transfer = $10,
        sync_status = $11,
        sync_hash = $12,
        content_hash = $13,
        updated_at = $14::timestamp,
        synced_at = $15::timestamp
      WHERE temp_id = $16
    `, [
      server.user_id,
      server.article_id,
      server.financial_center_id,
      server.cost_center_id,
      server.date,
      server.amount,
      server.record_type,
      server.comment,
      server.transfer_group_id,
      server.is_transfer,
      server.sync_status,
      server.sync_hash,
      server.content_hash,
      server.updated_at,
      server.synced_at,
      conflict.tempId
    ]);

    logger.info('[CONFLICT_LWW] Applied server version', {
      id: conflict.entityId,
      tempId: conflict.tempId
    });
  }

  /**
   * Apply client resolution - keep local, mark for re-upload.
   * Uses parameterized query to prevent SQL injection.
   *
   * @param conflict - Conflict detection result
   */
  private async applyClientResolution(conflict: ConflictDetection): Promise<void> {
    // Use parameterized query to prevent SQL injection
    await this.db.query(`
      UPDATE local_budget_facts SET
        sync_status = $1
      WHERE temp_id = $2
    `, ['pending', conflict.tempId]);

    logger.info('[CONFLICT_LWW] Kept client version, marking for re-upload', {
      id: conflict.entityId,
      tempId: conflict.tempId
    });
  }

  /**
   * Get conflict metrics for diagnostic UI.
   * Query last 30 days of conflicts.
   *
   * @returns Conflict metrics
   */
  async getConflictMetrics(): Promise<ConflictMetrics> {
    try {
      // Query conflicts from last 30 days
      const result = await this.db.query(`
        SELECT
          COUNT(*) as total_conflicts,
          COUNT(CASE WHEN resolution IS NOT NULL THEN 1 END) as resolved_conflicts,
          COUNT(CASE WHEN resolution IS NULL OR resolution = 'pending' THEN 1 END) as pending_conflicts,
          COUNT(CASE WHEN resolution = 'server' THEN 1 END) as server_wins,
          COUNT(CASE WHEN resolution = 'client' THEN 1 END) as client_wins,
          COUNT(CASE WHEN resolution = 'merged' THEN 1 END) as merged_wins,
          COUNT(CASE WHEN resolution = 'pending' THEN 1 END) as pending_resolutions
        FROM local_sync_conflicts
        WHERE created_at > NOW() - INTERVAL '30 days'
      `);

      const row = result.rows[0] as {
        total_conflicts: number;
        resolved_conflicts: number;
        pending_conflicts: number;
        server_wins: number;
        client_wins: number;
        merged_wins: number;
        pending_resolutions: number;
      };

      // Calculate conflict rate (assuming ~100 sync operations per day)
      const estimatedSyncOps = 30 * 100; // 30 days * 100 ops/day
      const conflictRate = estimatedSyncOps > 0
        ? (row.total_conflicts / estimatedSyncOps) * 100
        : 0;

      const metrics: ConflictMetrics = {
        totalConflicts: row.total_conflicts,
        resolvedConflicts: row.resolved_conflicts,
        pendingConflicts: row.pending_conflicts,
        conflictRate: Math.round(conflictRate * 100) / 100, // 2 decimal places
        resolutionBreakdown: {
          server: row.server_wins,
          client: row.client_wins,
          merged: row.merged_wins,
          pending: row.pending_resolutions
        }
      };

      logger.info('[CONFLICT_METRICS] Retrieved metrics', metrics);

      return metrics;
    } catch (error) {
      logger.error('[CONFLICT_METRICS] Failed to get metrics', error);

      // Return default metrics on error
      return DEFAULT_CONFLICT_METRICS;
    }
  }

  /**
   * Serialize record for JSONB storage.
   * Convert Date objects to ISO strings.
   *
   * @param record - Record to serialize
   * @returns Serialized record
   */
  private serializeRecord(record: LocalBudgetFact | ServerBudgetFact): Record<string, unknown> {
    return {
      ...record,
      created_at: record.created_at instanceof Date
        ? record.created_at.toISOString()
        : record.created_at,
      updated_at: record.updated_at instanceof Date
        ? record.updated_at.toISOString()
        : record.updated_at,
      synced_at: record.synced_at instanceof Date
        ? record.synced_at.toISOString()
        : record.synced_at
    };
  }
}
