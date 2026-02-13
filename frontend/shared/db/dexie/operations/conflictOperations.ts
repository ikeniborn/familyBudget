/**
 * Conflict Resolution operations for Dexie.js
 * Detects and resolves sync conflicts
 */

import { db } from '../core/database';
import { logger } from '../utils/logger';
import type { LocalSyncConflict } from '../types/fact';

/**
 * Conflict resolution strategy
 */
export type ConflictStrategy = 'server' | 'client' | 'merged';

/**
 * Detect conflict between local and remote versions
 *
 * @param local - Local version of entity
 * @param remote - Remote version of entity
 * @returns true if conflict detected
 */
export function detectConflict(
  local: Record<string, unknown>,
  remote: Record<string, unknown>
): boolean {
  try {
    logger.debug('[Dexie] Detecting conflict', { local, remote });

    // Simple conflict detection: compare sync_hash or content_hash
    const localHash = local.sync_hash || local.content_hash;
    const remoteHash = remote.sync_hash || remote.content_hash;

    if (!localHash || !remoteHash) {
      logger.warn('[Dexie] Missing hash for conflict detection');
      return false;
    }

    const hasConflict = localHash !== remoteHash;

    if (hasConflict) {
      logger.warn('[Dexie] ⚠️ Conflict detected', { localHash, remoteHash });
    }

    return hasConflict;
  } catch (error) {
    logger.error('[Dexie] ❌ Conflict detection error:', error);
    return false;
  }
}

/**
 * Resolve conflict using specified strategy
 *
 * @param conflict - Conflict record from DB
 * @param strategy - Resolution strategy
 * @returns Resolved entity data
 */
export async function resolveConflict(
  conflict: LocalSyncConflict,
  strategy: ConflictStrategy
): Promise<Record<string, unknown>> {
  try {
    logger.info('[Dexie] Resolving conflict', { conflictId: conflict.id, strategy });

    let resolvedData: Record<string, unknown>;

    switch (strategy) {
      case 'server':
        // Server wins: use remote version
        resolvedData = conflict.server_version;
        logger.info('[Dexie] ✅ Conflict resolved: server wins');
        break;

      case 'client':
        // Client wins: use local version
        resolvedData = conflict.local_version;
        logger.info('[Dexie] ✅ Conflict resolved: client wins');
        break;

      case 'merged':
        // Merge: combine both versions (simple strategy: server overwrites null fields)
        resolvedData = {
          ...conflict.local_version,
          ...Object.fromEntries(
            Object.entries(conflict.server_version).filter(([_, v]) => v !== null)
          )
        };
        logger.info('[Dexie] ✅ Conflict resolved: merged');
        break;

      default:
        throw new Error(`[Dexie] Unknown conflict strategy: ${strategy}`);
    }

    // Mark conflict as resolved
    await db.syncConflicts.update(conflict.id!, {
      resolution: strategy,
      resolved_at: new Date()
    });

    logger.info('[Dexie] ✅ Conflict marked as resolved', { conflictId: conflict.id });

    return resolvedData;
  } catch (error) {
    logger.error('[Dexie] ❌ Conflict resolution error:', error);
    throw error;
  }
}

/**
 * Create conflict record
 *
 * @param entityType - Type of entity (fact, article, etc)
 * @param entityId - Server ID (if exists)
 * @param tempId - Client temp_id (if exists)
 * @param local - Local version
 * @param remote - Remote version
 */
export async function createConflictRecord(
  entityType: string,
  entityId: number | null,
  tempId: number | null,
  local: Record<string, unknown>,
  remote: Record<string, unknown>
): Promise<void> {
  try {
    logger.warn('[Dexie] Creating conflict record', { entityType, entityId, tempId });

    const conflict: LocalSyncConflict = {
      id: 0, // Auto-generated
      entity_type: entityType,
      entity_id: entityId,
      temp_id: tempId,
      local_version: local,
      server_version: remote,
      resolution: null,
      resolved_at: null,
      created_at: new Date()
    };

    await db.syncConflicts.add(conflict);

    logger.info('[Dexie] ✅ Conflict record created');
  } catch (error) {
    logger.error('[Dexie] ❌ Create conflict record error:', error);
    throw error;
  }
}

/**
 * Get conflict metrics for diagnostic modal
 */
export async function getConflictMetrics(): Promise<{
  total: number;
  resolved: number;
  pending: number;
  resolvedConflicts: number;
  pendingConflicts: number;
  totalConflicts: number;
  conflictRate: number;
  resolutionBreakdown: {
    server: number;
    client: number;
    merged: number;
  };
}> {
  try {
    const allConflicts = await db.syncConflicts.toArray();
    const total = allConflicts.length;

    const resolved = allConflicts.filter(c => c.resolved_at !== null).length;
    const pending = total - resolved;

    // Resolution breakdown
    const serverResolutions = allConflicts.filter(c => c.resolution === 'server').length;
    const clientResolutions = allConflicts.filter(c => c.resolution === 'client').length;
    const mergedResolutions = allConflicts.filter(c => c.resolution === 'merged').length;

    // Conflict rate (approximate: conflicts / total synced facts)
    const factsCount = await db.budgetFacts.where('sync_status').equals('synced').count();
    const conflictRate = factsCount > 0 ? (total / factsCount) * 100 : 0;

    return {
      total,
      resolved,
      pending,
      resolvedConflicts: resolved,
      pendingConflicts: pending,
      totalConflicts: total,
      conflictRate: Math.round(conflictRate * 100) / 100, // Round to 2 decimals
      resolutionBreakdown: {
        server: serverResolutions,
        client: clientResolutions,
        merged: mergedResolutions
      }
    };
  } catch (error) {
    logger.error('[Dexie] ❌ Get conflict metrics error:', error);
    return {
      total: 0,
      resolved: 0,
      pending: 0,
      resolvedConflicts: 0,
      pendingConflicts: 0,
      totalConflicts: 0,
      conflictRate: 0,
      resolutionBreakdown: {
        server: 0,
        client: 0,
        merged: 0
      }
    };
  }
}
