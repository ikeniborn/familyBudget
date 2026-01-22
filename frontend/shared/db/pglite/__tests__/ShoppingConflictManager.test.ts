/**
 * Unit tests for ShoppingConflictManager
 * Task-013: Conflict Resolution Modal UI
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { ShoppingConflictManager } from '../ShoppingConflictManager';
import type { LocalShoppingList, LocalShoppingListItem } from '../types/shopping';

describe('ShoppingConflictManager', () => {
  let db: PGlite;
  let manager: ShoppingConflictManager;

  beforeEach(async () => {
    // Create in-memory PGlite instance
    db = new PGlite();

    // Create required tables (simplified schema for testing)
    await db.query(`
      CREATE TABLE IF NOT EXISTS local_shopping_lists (
        id INTEGER,
        temp_id TEXT PRIMARY KEY,
        creator_id INTEGER,
        name TEXT NOT NULL,
        description TEXT,
        is_active BOOLEAN DEFAULT true,
        sync_status TEXT DEFAULT 'synced',
        sync_hash TEXT,
        content_hash TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        synced_at TIMESTAMP
      )
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS local_shopping_list_items (
        id INTEGER,
        temp_id TEXT PRIMARY KEY,
        creator_id INTEGER,
        shopping_list_temp_id TEXT NOT NULL,
        store_id INTEGER NOT NULL,
        product_group_id INTEGER NOT NULL,
        product_name TEXT NOT NULL,
        quantity NUMERIC(10,3),
        unit TEXT,
        comment TEXT,
        is_completed BOOLEAN DEFAULT false,
        completed_at TIMESTAMP,
        sync_status TEXT DEFAULT 'synced',
        sync_hash TEXT,
        content_hash TEXT,
        version INTEGER DEFAULT 1,
        deleted_at TIMESTAMP,
        last_modified_by INTEGER,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        synced_at TIMESTAMP
      )
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS local_sync_conflicts (
        id SERIAL PRIMARY KEY,
        entity_type TEXT NOT NULL,
        entity_id INTEGER,
        temp_id TEXT NOT NULL,
        local_version JSONB NOT NULL,
        server_version JSONB NOT NULL,
        resolution TEXT,
        resolved_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    manager = new ShoppingConflictManager(db);
  });

  describe('detectListConflict', () => {
    it('should detect update_update conflict for shopping list', async () => {
      const localList: LocalShoppingList = {
        id: 1,
        temp_id: 'temp-list-1',
        creator_id: 1,
        name: 'Local List Name',
        description: 'Local description',
        is_active: true,
        sync_status: 'pending', // Pending changes
        sync_hash: 'local-hash-123',
        content_hash: 'local-content-456',
        created_at: new Date('2024-01-01T10:00:00Z'),
        updated_at: new Date('2024-01-01T11:00:00Z'),
        synced_at: new Date('2024-01-01T10:00:00Z'),
      };

      const serverList: LocalShoppingList = {
        ...localList,
        name: 'Server List Name', // Different name
        description: 'Server description', // Different description
        sync_hash: 'server-hash-789', // Different hash
        updated_at: new Date('2024-01-01T10:30:00Z'), // Different timestamp
      };

      const conflict = await manager.detectListConflict(localList, serverList);

      expect(conflict).not.toBeNull();
      expect(conflict?.entityType).toBe('shopping_list');
      expect(conflict?.conflictType).toBe('update_update');
      expect(conflict?.tempId).toBe('temp-list-1');
      expect(conflict?.changedFields).toHaveLength(4); // name, description, updated_at, sync_hash
      expect(conflict?.changedFields.filter(f => f.isDifferent)).toHaveLength(3); // name, description, updated_at different
    });

    it('should return null if no conflict (synced status)', async () => {
      const localList: LocalShoppingList = {
        id: 1,
        temp_id: 'temp-list-1',
        creator_id: 1,
        name: 'List Name',
        description: null,
        is_active: true,
        sync_status: 'synced', // No pending changes
        sync_hash: 'hash-123',
        content_hash: 'content-456',
        created_at: new Date('2024-01-01T10:00:00Z'),
        updated_at: new Date('2024-01-01T10:00:00Z'),
        synced_at: new Date('2024-01-01T10:00:00Z'),
      };

      const serverList = { ...localList };

      const conflict = await manager.detectListConflict(localList, serverList);

      expect(conflict).toBeNull();
    });

    it('should return null if sync_hash matches', async () => {
      const localList: LocalShoppingList = {
        id: 1,
        temp_id: 'temp-list-1',
        creator_id: 1,
        name: 'List Name',
        description: null,
        is_active: true,
        sync_status: 'pending',
        sync_hash: 'same-hash-123', // Same hash
        content_hash: 'content-456',
        created_at: new Date('2024-01-01T10:00:00Z'),
        updated_at: new Date('2024-01-01T10:00:00Z'),
        synced_at: new Date('2024-01-01T10:00:00Z'),
      };

      const serverList = { ...localList, sync_hash: 'same-hash-123' };

      const conflict = await manager.detectListConflict(localList, serverList);

      expect(conflict).toBeNull();
    });
  });

  describe('detectItemConflict', () => {
    it('should detect update_update conflict for shopping list item', async () => {
      const localItem: LocalShoppingListItem = {
        id: 1,
        temp_id: 'temp-item-1',
        creator_id: 1,
        shopping_list_temp_id: 'temp-list-1',
        store_id: 1,
        product_group_id: 1,
        product_name: 'Local Product',
        quantity: 2,
        unit: 'pcs',
        comment: 'Local comment',
        is_completed: false,
        completed_at: null,
        sync_status: 'pending',
        sync_hash: 'local-hash-123',
        content_hash: 'local-content-456',
        version: 1,
        deleted_at: null,
        last_modified_by: null,
        created_at: new Date('2024-01-01T10:00:00Z'),
        updated_at: new Date('2024-01-01T11:00:00Z'),
        synced_at: new Date('2024-01-01T10:00:00Z'),
      };

      const serverItem: LocalShoppingListItem = {
        ...localItem,
        product_name: 'Server Product', // Different name
        quantity: 3, // Different quantity
        sync_hash: 'server-hash-789',
        updated_at: new Date('2024-01-01T10:30:00Z'),
      };

      const conflict = await manager.detectItemConflict(localItem, serverItem);

      expect(conflict).not.toBeNull();
      expect(conflict?.entityType).toBe('shopping_list_item');
      expect(conflict?.conflictType).toBe('update_update');
      expect(conflict?.changedFields.filter(f => f.isDifferent).length).toBeGreaterThan(0);
    });
  });

  describe('computeListDiff', () => {
    it('should compute field-by-field differences', () => {
      const local: LocalShoppingList = {
        id: 1,
        temp_id: 'temp-1',
        creator_id: 1,
        name: 'Local Name',
        description: 'Local desc',
        is_active: true,
        sync_status: 'pending',
        sync_hash: 'hash-1',
        content_hash: 'content-1',
        created_at: new Date('2024-01-01'),
        updated_at: new Date('2024-01-02'),
        synced_at: new Date('2024-01-01'),
      };

      const server: LocalShoppingList = {
        ...local,
        name: 'Server Name',
        description: 'Server desc',
        updated_at: new Date('2024-01-03'),
      };

      const diffs = manager.computeListDiff(local, server);

      expect(diffs).toHaveLength(4); // name, description, is_active, updated_at
      expect(diffs.find(d => d.fieldName === 'name')?.isDifferent).toBe(true);
      expect(diffs.find(d => d.fieldName === 'description')?.isDifferent).toBe(true);
      expect(diffs.find(d => d.fieldName === 'is_active')?.isDifferent).toBe(false);
      expect(diffs.find(d => d.fieldName === 'updated_at')?.isDifferent).toBe(true);
    });
  });

  describe('applyServerResolution', () => {
    it('should update local list with server data', async () => {
      // Insert local list
      await db.query(`
        INSERT INTO local_shopping_lists (id, temp_id, creator_id, name, description, is_active, sync_status, sync_hash, content_hash, updated_at)
        VALUES (1, 'temp-1', 1, 'Local Name', 'Local desc', true, 'pending', 'local-hash', 'local-content', NOW())
      `);

      const listResult = await db.query('SELECT * FROM local_shopping_lists WHERE temp_id = $1', ['temp-1']);
      expect(listResult.rows.length).toBeGreaterThan(0);
      const localList = listResult.rows[0] as LocalShoppingList;

      const serverList: LocalShoppingList = {
        ...localList,
        name: 'Server Name',
        description: 'Server desc',
        sync_hash: 'server-hash',
        updated_at: new Date(),
      };

      const conflict = await manager.detectListConflict(localList, serverList);
      expect(conflict).not.toBeNull();

      await manager.applyServerResolution(conflict!);

      // Verify update
      const result = await db.query('SELECT * FROM local_shopping_lists WHERE temp_id = $1', ['temp-1']);
      expect(result.rows.length).toBeGreaterThan(0);
      const updated = result.rows[0] as LocalShoppingList;

      expect(updated.name).toBe('Server Name');
      expect(updated.description).toBe('Server desc');
      expect(updated.sync_status).toBe('synced');
      expect(updated.sync_hash).toBe('server-hash');
    });

    it('should log conflict to local_sync_conflicts table', async () => {
      await db.query(`
        INSERT INTO local_shopping_lists (id, temp_id, creator_id, name, description, is_active, sync_status, sync_hash, content_hash, updated_at)
        VALUES (1, 'temp-1', 1, 'Local Name', 'Local desc', true, 'pending', 'local-hash', 'local-content', NOW())
      `);

      const listResult = await db.query('SELECT * FROM local_shopping_lists WHERE temp_id = $1', ['temp-1']);
      expect(listResult.rows.length).toBeGreaterThan(0);
      const localList = listResult.rows[0] as LocalShoppingList;
      const serverList: LocalShoppingList = { ...localList, name: 'Server Name', sync_hash: 'server-hash' };

      const conflict = await manager.detectListConflict(localList, serverList);
      await manager.applyServerResolution(conflict!);

      // Verify log entry
      const logs = await db.query('SELECT * FROM local_sync_conflicts WHERE temp_id = $1', ['temp-1']);
      expect(logs.rows.length).toBe(1);
      expect((logs.rows[0] as any).entity_type).toBe('shopping_list');
      expect((logs.rows[0] as any).resolution).toBe('server');
    });
  });

  describe('applyClientResolution', () => {
    it('should mark local list as pending', async () => {
      await db.query(`
        INSERT INTO local_shopping_lists (id, temp_id, creator_id, name, description, is_active, sync_status, sync_hash, content_hash, updated_at)
        VALUES (1, 'temp-1', 1, 'Local Name', 'Local desc', true, 'pending', 'local-hash', 'local-content', NOW())
      `);

      const listResult = await db.query('SELECT * FROM local_shopping_lists WHERE temp_id = $1', ['temp-1']);
      expect(listResult.rows.length).toBeGreaterThan(0);
      const localList = listResult.rows[0] as LocalShoppingList;
      const serverList: LocalShoppingList = { ...localList, name: 'Server Name', sync_hash: 'server-hash' };

      const conflict = await manager.detectListConflict(localList, serverList);
      await manager.applyClientResolution(conflict!);

      // Verify sync_status remains pending
      const result = await db.query('SELECT * FROM local_shopping_lists WHERE temp_id = $1', ['temp-1']);
      expect(result.rows.length).toBeGreaterThan(0);
      expect((result.rows[0] as LocalShoppingList).sync_status).toBe('pending');

      // Verify log entry
      const logs = await db.query('SELECT * FROM local_sync_conflicts WHERE temp_id = $1', ['temp-1']);
      expect(logs.rows.length).toBeGreaterThan(0);
      expect((logs.rows[0] as any).resolution).toBe('client');
    });
  });
});
