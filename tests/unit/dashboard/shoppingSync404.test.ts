/**
 * Unit test: uploadShoppingItem handles PUT 404 by recreating via POST.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DexieManager } from '@db/dexie/DexieManager';
import { db } from '@db/dexie/core/database';

// Mock fetchWithTimeout
vi.mock('@db/dexie/utils/fetchWithTimeout', () => ({
  fetchWithTimeout: vi.fn(),
}));

import { fetchWithTimeout } from '@db/dexie/utils/fetchWithTimeout';
import { uploadPendingShoppingOperations } from '@db/dexie/operations/shoppingSync';

describe('uploadShoppingItem — PUT 404 fallback', () => {
  let manager: DexieManager;

  beforeEach(async () => {
    manager = new DexieManager();
    await manager.init();
    vi.clearAllMocks();
  });

  afterEach(async () => {
    if (manager.isReady()) {
      await manager.clearAll();
      await manager.close();
    }
  });

  it('recreates item via POST when PUT returns 404', async () => {
    // Seed: item with server id (was synced before) but now pending edit
    const tempId = 'test-temp-404';
    await db.shoppingListItems.add({
      temp_id: tempId,
      id: 99,  // server id exists → triggers PUT
      shopping_list_temp_id: 'list-1',
      shopping_list_id: 5,
      product_name: 'Milk',
      quantity: 2,
      unit: 'л',
      comment: null,
      store_id: null,
      product_group_id: null,
      position: 0,
      is_completed: false,
      completed_at: null,
      sync_status: 'pending',
      sync_hash: null,
      content_hash: null,
      created_at: new Date(),
      updated_at: new Date(),
      synced_at: null,
    });

    const fetchMock = vi.mocked(fetchWithTimeout);

    // First call: PUT → 404
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 404,
    } as Response);

    // Second call: POST → 201 with new server id
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 201,
      json: async () => ({ id: 200 }),
    } as Response);

    const result = await uploadPendingShoppingOperations();

    expect(result.uploaded).toBe(1);
    expect(result.failed).toBe(0);

    // Verify PUT was attempted first
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      '/api/v1/shopping-list-items/99',
      expect.objectContaining({ method: 'PUT' })
    );

    // Verify POST was called as fallback
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      '/api/v1/shopping-list-items',
      expect.objectContaining({ method: 'POST' })
    );

    // Verify local record updated with new server id
    const updated = await db.shoppingListItems.where('temp_id').equals(tempId).first();
    expect(updated?.id).toBe(200);
    expect(updated?.sync_status).toBe('synced');
  });

  it('throws on non-404 server error', async () => {
    await db.shoppingListItems.add({
      temp_id: 'test-temp-500',
      id: 99,
      shopping_list_temp_id: 'list-1',
      shopping_list_id: 5,
      product_name: 'Eggs',
      quantity: 12,
      unit: 'шт',
      comment: null,
      store_id: null,
      product_group_id: null,
      position: 0,
      is_completed: false,
      completed_at: null,
      sync_status: 'pending',
      sync_hash: null,
      content_hash: null,
      created_at: new Date(),
      updated_at: new Date(),
      synced_at: null,
    });

    vi.mocked(fetchWithTimeout).mockResolvedValueOnce({
      ok: false,
      status: 500,
    } as Response);

    const result = await uploadPendingShoppingOperations();
    expect(result.failed).toBe(1);
  });
});
