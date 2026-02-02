/**
 * Offline Shopping Manager
 * Управление shopping lists и items в offline режиме
 *
 * Extension для OfflineManager с методами для shopping lists
 *
 * Features:
 * - Offline queue with optimistic locking (version field)
 * - Batch sync with conflict detection
 * - Field-level merge logic (server wins content, is_completed=true wins)
 * - Conflict resolution UI for DELETE vs UPDATE conflicts
 *
 * @version 2.0.0 - Enhanced sync with batch API and conflict resolution
 */

class OfflineShoppingManager {
    constructor(offlineManager) {
        this.offlineManager = offlineManager;
        this.db = offlineManager.db;
        this.pendingConflicts = [];  // Conflicts awaiting user resolution
    }

    get isOnline() {
        return this.offlineManager.isOnline;
    }

    // ==================== MERGE LOGIC ====================

    /**
     * Auto-merge items according to priority rules:
     * - Server wins for content fields (product_name, quantity, unit, comment, store_id, product_group_id)
     * - is_completed=true wins (regardless of source)
     *
     * @param {Object} serverItem - Item from server
     * @param {Object} clientItem - Local item
     * @returns {Object} Merged item
     */
    mergeItems(serverItem, clientItem) {
        // Start with server data (server wins for content)
        const merged = { ...serverItem };

        // is_completed=true wins
        if (clientItem.is_completed && !serverItem.is_completed) {
            merged.is_completed = true;
            merged.completed_at = clientItem.completed_at || new Date().toISOString();
        }

        // Preserve client's tempId and local tracking data
        if (clientItem.tempId) {
            merged.tempId = clientItem.tempId;
        }

        return merged;
    }

    /**
     * Optimize sync queue before sending to server
     * Removes redundant operations:
     * - CREATE + DELETE same item = nothing
     * - CREATE + UPDATE = CREATE with merged data
     * - UPDATE + UPDATE = single UPDATE with merged data
     * - UPDATE + DELETE = DELETE only
     *
     * @param {Array} queue - Raw sync queue items
     * @returns {Array} Optimized queue
     */
    optimizeSyncQueue(queue) {
        // Group by tempId/serverId
        const itemMap = new Map();

        for (const item of queue) {
            const key = item.tempId || `server_${item.serverId}`;
            const existing = itemMap.get(key);

            if (!existing) {
                itemMap.set(key, item);
                continue;
            }

            // CREATE followed by DELETE = remove both
            if (existing.operation === 'CREATE' && item.operation === 'DELETE') {
                itemMap.delete(key);
                continue;
            }

            // CREATE followed by UPDATE = merge into CREATE
            if (existing.operation === 'CREATE' && item.operation === 'UPDATE') {
                existing.data = { ...existing.data, ...item.data };
                continue;
            }

            // UPDATE followed by UPDATE = merge
            if (existing.operation === 'UPDATE' && item.operation === 'UPDATE') {
                existing.data = { ...existing.data, ...item.data };
                continue;
            }

            // UPDATE followed by DELETE = keep DELETE only
            if (existing.operation === 'UPDATE' && item.operation === 'DELETE') {
                itemMap.set(key, item);
                continue;
            }

            // Other cases: keep last operation
            itemMap.set(key, item);
        }

        return Array.from(itemMap.values());
    }

    /**
     * Cache stores and product groups for offline use
     * @returns {Promise<void>}
     */
    async cacheStoresAndGroups() {
        if (!this.isOnline) {
            debugLog('[OfflineShoppingManager] Offline: cannot cache stores/groups');
            return;
        }

        try {
            // Fetch stores
            const storesResponse = await fetch('/api/v1/stores');
            if (storesResponse.ok) {
                const storesData = await storesResponse.json();
                await this.db.cacheStores(storesData.stores || []);
                debugLog('[OfflineShoppingManager] Cached stores:', storesData.stores?.length || 0);
            }

            // Fetch product groups
            const groupsResponse = await fetch('/api/v1/product-groups');
            if (groupsResponse.ok) {
                const groupsData = await groupsResponse.json();
                await this.db.cacheProductGroups(groupsData.product_groups || []);
                debugLog('[OfflineShoppingManager] Cached product groups:', groupsData.product_groups?.length || 0);
            }
        } catch (error) {
            console.error('[OfflineShoppingManager] Error caching stores/groups:', error);
        }
    }

    /**
     * Get cached stores (for offline use)
     * @returns {Promise<Array>}
     */
    async getCachedStores() {
        return await this.db.getCachedStores();
    }

    /**
     * Get cached product groups (for offline use)
     * @returns {Promise<Array>}
     */
    async getCachedProductGroups() {
        return await this.db.getCachedProductGroups();
    }

    /**
     * Create shopping list item (online or offline)
     * @param {Object} itemData - Item data
     * @returns {Promise<Object>} Created item
     */
    async createItem(itemData) {
        if (this.isOnline) {
            // Online: Create via API
            try {
                const response = await fetch('/api/v1/shopping-list-items', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(itemData)
                });

                if (response.ok) {
                    const result = await response.json();
                    debugLog('[OfflineShoppingManager] Created item online:', result);
                    return result;
                } else {
                    throw new Error('Failed to create item online');
                }
            } catch (error) {
                console.error('[OfflineShoppingManager] Error creating item online, saving offline:', error);
                // Fallback to offline
                return await this._createItemOffline(itemData);
            }
        } else {
            // Offline: Save to IndexedDB
            return await this._createItemOffline(itemData);
        }
    }

    /**
     * Create shopping list item offline
     * @private
     */
    async _createItemOffline(itemData) {
        const tempId = `temp_item_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        const offlineItem = {
            tempId,
            ...itemData,
            synced: false,
            syncStatus: 'pending',
            createdAt: new Date().toISOString()
        };

        await this.db.addShoppingListItem(offlineItem);

        // Add to sync queue
        await this.db.addShoppingSyncQueueItem({
            entity: 'shopping_list_item',
            operation: 'CREATE',
            tempId,
            data: itemData,
            status: 'pending'
        });

        debugLog('[OfflineShoppingManager] Created item offline:', offlineItem);

        // Show offline indicator
        this._showOfflineToast('Товар сохранён offline. Синхронизируется при подключении к сети.');

        return offlineItem;
    }

    /**
     * Update shopping list item (online or offline)
     * @param {number|string} itemId - Item ID (serverId or tempId)
     * @param {Object} itemData - Updated data
     * @returns {Promise<Object>} Updated item
     */
    async updateItem(itemId, itemData) {
        if (this.isOnline && !itemId.toString().startsWith('temp_')) {
            // Online: Update via API
            try {
                const response = await fetch(`/api/v1/shopping-list-items/${itemId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(itemData)
                });

                if (response.ok) {
                    const result = await response.json();
                    debugLog('[OfflineShoppingManager] Updated item online:', result);
                    return result;
                } else {
                    // HTTP error (4xx, 5xx) - server error, NOT network error
                    console.error(`[OfflineShoppingManager] Server error: ${response.status}`);
                    this._showServerErrorToast(`Ошибка сервера (${response.status}). Попробуйте ещё раз.`);
                    throw new Error(`Server error: ${response.status}`);
                }
            } catch (error) {
                // Distinguish server errors from network errors
                if (error.message && error.message.startsWith('Server error:')) {
                    // Server returned an error - re-throw, don't save offline
                    throw error;
                }
                // Network error (fetch failed) - save offline
                console.error('[OfflineShoppingManager] Network error, saving offline:', error);
                return await this._updateItemOffline(itemId, itemData);
            }
        } else {
            // Offline: Save to IndexedDB
            return await this._updateItemOffline(itemId, itemData);
        }
    }

    /**
     * Update shopping list item offline
     * @private
     */
    async _updateItemOffline(itemId, itemData) {
        const tempId = itemId.toString().startsWith('temp_') ? itemId : `temp_item_${itemId}`;

        // Get existing item or create new
        let item = await this.db.getShoppingListItem(tempId);

        if (item) {
            // Update existing
            item = {
                ...item,
                ...itemData,
                synced: false,
                syncStatus: 'pending',
                updatedAt: new Date().toISOString()
            };
            await this.db.updateShoppingListItem(item);
        } else {
            // Create new offline item
            item = {
                tempId,
                serverId: itemId,
                ...itemData,
                synced: false,
                syncStatus: 'pending',
                updatedAt: new Date().toISOString()
            };
            await this.db.addShoppingListItem(item);
        }

        // Add to sync queue
        await this.db.addShoppingSyncQueueItem({
            entity: 'shopping_list_item',
            operation: 'UPDATE',
            tempId,
            serverId: itemId,
            data: itemData,
            status: 'pending'
        });

        debugLog('[OfflineShoppingManager] Updated item offline:', item);

        this._showOfflineToast('Изменения сохранены offline. Синхронизируются при подключении к сети.');

        return item;
    }

    /**
     * Delete shopping list item (online or offline)
     * @param {number|string} itemId - Item ID
     * @returns {Promise<void>}
     */
    async deleteItem(itemId) {
        if (this.isOnline && !itemId.toString().startsWith('temp_')) {
            // Online: Delete via API
            try {
                const response = await fetch(`/api/v1/shopping-list-items/${itemId}`, {
                    method: 'DELETE'
                });

                if (response.ok) {
                    debugLog('[OfflineShoppingManager] Deleted item online:', itemId);
                    return;
                } else {
                    throw new Error('Failed to delete item online');
                }
            } catch (error) {
                console.error('[OfflineShoppingManager] Error deleting item online, saving offline:', error);
                await this._deleteItemOffline(itemId);
            }
        } else {
            // Offline: Mark for deletion
            await this._deleteItemOffline(itemId);
        }
    }

    /**
     * Delete shopping list item offline
     * @private
     */
    async _deleteItemOffline(itemId) {
        const tempId = itemId.toString().startsWith('temp_') ? itemId : `temp_item_${itemId}`;

        // Delete from IndexedDB
        await this.db.deleteShoppingListItem(tempId);

        // Add to sync queue
        await this.db.addShoppingSyncQueueItem({
            entity: 'shopping_list_item',
            operation: 'DELETE',
            tempId,
            serverId: itemId,
            status: 'pending'
        });

        debugLog('[OfflineShoppingManager] Deleted item offline:', itemId);

        this._showOfflineToast('Товар удалён offline. Синхронизируется при подключении к сети.');
    }

    /**
     * Sync shopping list with server using batch API
     * @param {number} listId - Shopping list ID
     * @returns {Promise<Object>} Sync result with conflicts
     */
    async syncWithServer(listId) {
        if (!this.isOnline || this.offlineManager.syncInProgress) {
            debugLog('[OfflineShoppingManager] Cannot sync: offline or sync in progress');
            return { success: false, reason: 'offline_or_busy' };
        }

        this.offlineManager.syncInProgress = true;

        try {
            debugLog('[OfflineShoppingManager] Starting batch sync for list:', listId);

            // 1. Get last sync timestamp
            const lastSyncTimestamp = await this.db.getLastSyncTimestamp(listId);

            // 2. Collect and optimize pending changes
            const rawQueue = await this.db.getShoppingSyncQueue('pending');
            const listQueue = rawQueue.filter(q =>
                q.entity === 'shopping_list_item' &&
                (q.data?.shopping_list_id === listId || q.shoppingListId === listId)
            );
            const pendingQueue = this.optimizeSyncQueue(listQueue);

            // 3. Separate by operation type
            const creates = [];
            const updates = [];
            const deletes = [];

            for (const item of pendingQueue) {
                if (item.operation === 'CREATE') {
                    creates.push({
                        temp_id: item.tempId,
                        ...item.data
                    });
                } else if (item.operation === 'UPDATE') {
                    // Get local item for version
                    const localItem = await this.db.getShoppingListItem(item.tempId);
                    updates.push({
                        id: item.serverId,
                        client_version: localItem?.version || 1,
                        changes: item.data
                    });
                } else if (item.operation === 'DELETE') {
                    const localItem = await this.db.getShoppingListItem(item.tempId);
                    deletes.push({
                        id: item.serverId,
                        client_version: localItem?.version || 1
                    });
                }
            }

            // 4. Call batch sync API
            const response = await fetch('/api/v1/shopping-list-items/sync/batch', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    shopping_list_id: listId,
                    creates,
                    updates,
                    deletes,
                    client_last_sync: lastSyncTimestamp
                })
            });

            if (!response.ok) {
                throw new Error(`Batch sync failed: ${response.status}`);
            }

            const result = await response.json();
            debugLog('[OfflineShoppingManager] Batch sync response:', result);

            // 5. Process created items - update local with server IDs
            for (const created of result.created || []) {
                const queueItem = pendingQueue.find(q =>
                    q.operation === 'CREATE' && q.tempId === created.temp_id
                );
                if (queueItem) {
                    const localItem = await this.db.getShoppingListItem(queueItem.tempId);
                    if (localItem) {
                        localItem.serverId = created.id;
                        localItem.version = created.version;
                        localItem.synced = true;
                        localItem.syncStatus = 'synced';
                        await this.db.updateShoppingListItem(localItem);
                    }
                    // Remove from queue
                    await this.db.deleteShoppingSyncQueueItem(queueItem.id);
                }
            }

            // 6. Process updated items
            for (const updated of result.updated || []) {
                const queueItem = pendingQueue.find(q =>
                    q.operation === 'UPDATE' && q.serverId === updated.id
                );
                if (queueItem) {
                    const localItem = await this.db.getShoppingListItem(queueItem.tempId);
                    if (localItem) {
                        // Apply merged data from server
                        Object.assign(localItem, updated);
                        localItem.synced = true;
                        localItem.syncStatus = 'synced';
                        await this.db.updateShoppingListItem(localItem);
                    }
                    await this.db.deleteShoppingSyncQueueItem(queueItem.id);
                }
            }

            // 7. Process deleted items
            for (const deletedId of result.deleted || []) {
                const queueItem = pendingQueue.find(q =>
                    q.operation === 'DELETE' && q.serverId === deletedId
                );
                if (queueItem) {
                    await this.db.deleteShoppingListItem(queueItem.tempId);
                    await this.db.deleteShoppingSyncQueueItem(queueItem.id);
                }
            }

            // 8. Handle conflicts - requires user resolution
            const conflicts = result.conflicts || [];
            if (conflicts.length > 0) {
                this.pendingConflicts = conflicts;
                debugLog('[OfflineShoppingManager] Conflicts detected:', conflicts.length);

                // Show conflict UI for delete conflicts
                for (const conflict of conflicts) {
                    if (conflict.conflict_type === 'update_delete' ||
                        conflict.conflict_type === 'delete_update') {
                        await this._showDeleteConflictModal(conflict);
                    }
                }
            }

            // 9. Update last sync timestamp
            if (result.server_time) {
                await this.db.setSyncMetadata(listId, result.server_time);
            }

            debugLog('[OfflineShoppingManager] Batch sync complete');

            return {
                success: true,
                created: result.created?.length || 0,
                updated: result.updated?.length || 0,
                deleted: result.deleted?.length || 0,
                conflicts: conflicts.length
            };

        } catch (error) {
            console.error('[OfflineShoppingManager] Batch sync error:', error);
            return { success: false, error: error.message };
        } finally {
            this.offlineManager.syncInProgress = false;
        }
    }

    /**
     * Delta sync - fetch changes from server since last sync
     * @param {number} listId - Shopping list ID
     * @returns {Promise<Object>} Sync result
     */
    async deltaSync(listId) {
        if (!this.isOnline) {
            return { success: false, reason: 'offline' };
        }

        try {
            const lastSyncTimestamp = await this.db.getLastSyncTimestamp(listId);
            const url = new URL('/api/v1/shopping-list-items/sync', window.location.origin);
            url.searchParams.set('shopping_list_id', listId);
            if (lastSyncTimestamp) {
                url.searchParams.set('since', lastSyncTimestamp);
            }

            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`Delta sync failed: ${response.status}`);
            }

            const result = await response.json();
            debugLog('[OfflineShoppingManager] Delta sync result:', result);

            // Update local items with server data
            for (const serverItem of result.items || []) {
                const tempId = `temp_item_${serverItem.id}`;
                const localItem = await this.db.getShoppingListItem(tempId);

                if (localItem && localItem.syncStatus === 'pending') {
                    // Local has pending changes - merge
                    const merged = this.mergeItems(serverItem, localItem);
                    merged.syncStatus = 'pending';  // Keep pending for re-sync
                    await this.db.updateShoppingListItem(merged);
                } else {
                    // No local changes - just update/create
                    await this.db.updateShoppingListItem({
                        tempId,
                        serverId: serverItem.id,
                        ...serverItem,
                        synced: true,
                        syncStatus: 'synced'
                    });
                }
            }

            // Mark deleted items
            for (const deletedId of result.deleted_ids || []) {
                const tempId = `temp_item_${deletedId}`;
                await this.db.deleteShoppingListItem(tempId);
            }

            // Update last sync timestamp
            if (result.server_time) {
                await this.db.setSyncMetadata(listId, result.server_time);
            }

            return {
                success: true,
                itemsUpdated: result.items?.length || 0,
                itemsDeleted: result.deleted_ids?.length || 0
            };

        } catch (error) {
            console.error('[OfflineShoppingManager] Delta sync error:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Legacy sync method - processes queue item by item (fallback)
     * @returns {Promise<void>}
     * @deprecated Use syncWithServer() for batch sync
     */
    async sync() {
        if (!this.isOnline || this.offlineManager.syncInProgress) {
            return;
        }

        this.offlineManager.syncInProgress = true;

        try {
            debugLog('[OfflineShoppingManager] Starting legacy sync...');

            const pendingQueue = await this.db.getShoppingSyncQueue('pending');

            if (pendingQueue.length === 0) {
                debugLog('[OfflineShoppingManager] No items to sync');
                this.offlineManager.syncInProgress = false;
                return;
            }

            debugLog('[OfflineShoppingManager] Syncing', pendingQueue.length, 'items');

            for (const queueItem of pendingQueue) {
                try {
                    // Update queue status
                    queueItem.status = 'syncing';
                    await this.db.updateShoppingSyncQueueItem(queueItem);

                    if (queueItem.operation === 'CREATE') {
                        // Create on server
                        const response = await fetch('/api/v1/shopping-list-items', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(queueItem.data)
                        });

                        if (response.ok) {
                            const result = await response.json();

                            // Update local item with serverId
                            const localItem = await this.db.getShoppingListItem(queueItem.tempId);
                            if (localItem) {
                                localItem.serverId = result.id;
                                localItem.version = result.version;
                                localItem.synced = true;
                                localItem.syncStatus = 'synced';
                                await this.db.updateShoppingListItem(localItem);
                            }

                            // Remove from queue
                            await this.db.deleteShoppingSyncQueueItem(queueItem.id);

                            debugLog('[OfflineShoppingManager] Synced CREATE:', result);
                        } else {
                            throw new Error(`Server returned ${response.status}`);
                        }

                    } else if (queueItem.operation === 'UPDATE') {
                        // Update on server
                        const response = await fetch(`/api/v1/shopping-list-items/${queueItem.serverId}`, {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(queueItem.data)
                        });

                        if (response.ok) {
                            const result = await response.json();
                            // Update local item
                            const localItem = await this.db.getShoppingListItem(queueItem.tempId);
                            if (localItem) {
                                localItem.version = result.version;
                                localItem.synced = true;
                                localItem.syncStatus = 'synced';
                                await this.db.updateShoppingListItem(localItem);
                            }

                            // Remove from queue
                            await this.db.deleteShoppingSyncQueueItem(queueItem.id);

                            debugLog('[OfflineShoppingManager] Synced UPDATE:', queueItem.serverId);
                        } else if (response.status === 409) {
                            // Conflict detected
                            queueItem.status = 'conflict';
                            await this.db.updateShoppingSyncQueueItem(queueItem);
                            debugLog('[OfflineShoppingManager] Conflict detected for item:', queueItem.serverId);
                        } else {
                            throw new Error(`Server returned ${response.status}`);
                        }

                    } else if (queueItem.operation === 'DELETE') {
                        // Delete on server
                        const response = await fetch(`/api/v1/shopping-list-items/${queueItem.serverId}`, {
                            method: 'DELETE'
                        });

                        if (response.ok || response.status === 404) {
                            // Remove from queue
                            await this.db.deleteShoppingSyncQueueItem(queueItem.id);

                            debugLog('[OfflineShoppingManager] Synced DELETE:', queueItem.serverId);
                        } else {
                            throw new Error(`Server returned ${response.status}`);
                        }
                    }

                } catch (error) {
                    console.error('[OfflineShoppingManager] Error syncing item:', queueItem, error);

                    // Update queue with failure
                    queueItem.status = 'failed';
                    queueItem.retries = (queueItem.retries || 0) + 1;
                    queueItem.lastError = error.message;

                    if (queueItem.retries >= this.offlineManager.maxRetries) {
                        queueItem.status = 'failed_permanent';
                    }

                    await this.db.updateShoppingSyncQueueItem(queueItem);
                }
            }

            debugLog('[OfflineShoppingManager] Legacy sync complete');

        } catch (error) {
            console.error('[OfflineShoppingManager] Error during sync:', error);
        } finally {
            this.offlineManager.syncInProgress = false;
        }
    }

    /**
     * Resolve conflict for shopping list item
     * @param {string} tempId - Temp item ID
     * @param {string} strategy - 'server', 'client', or 'merge'
     * @returns {Promise<void>}
     */
    async resolveConflict(tempId, strategy) {
        const localItem = await this.db.getShoppingListItem(tempId);

        if (!localItem || !localItem.serverId) {
            throw new Error('Item not found or has no serverId');
        }

        try {
            if (strategy === 'server') {
                // Server wins: fetch from server and overwrite local
                const response = await fetch(`/api/v1/shopping-list-items/${localItem.serverId}`);
                if (response.ok) {
                    const serverItem = await response.json();

                    localItem.synced = true;
                    localItem.syncStatus = 'synced';
                    Object.assign(localItem, serverItem);

                    await this.db.updateShoppingListItem(localItem);

                    // Remove from conflict queue
                    const conflictQueue = await this.db.getShoppingSyncQueue('conflict');
                    const conflictItem = conflictQueue.find(q => q.tempId === tempId);
                    if (conflictItem) {
                        await this.db.deleteShoppingSyncQueueItem(conflictItem.id);
                    }

                    debugLog('[OfflineShoppingManager] Conflict resolved (server wins):', tempId);
                }

            } else if (strategy === 'client') {
                // Client wins: force push local changes to server
                const response = await fetch(`/api/v1/shopping-list-items/${localItem.serverId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(localItem)
                });

                if (response.ok) {
                    localItem.synced = true;
                    localItem.syncStatus = 'synced';
                    await this.db.updateShoppingListItem(localItem);

                    // Remove from conflict queue
                    const conflictQueue = await this.db.getShoppingSyncQueue('conflict');
                    const conflictItem = conflictQueue.find(q => q.tempId === tempId);
                    if (conflictItem) {
                        await this.db.deleteShoppingSyncQueueItem(conflictItem.id);
                    }

                    debugLog('[OfflineShoppingManager] Conflict resolved (client wins):', tempId);
                }

            } else if (strategy === 'merge') {
                // Merge: show UI for user to manually select fields
                // This would require a UI component
                throw new Error('Merge strategy requires UI interaction');
            }

        } catch (error) {
            console.error('[OfflineShoppingManager] Error resolving conflict:', error);
            throw error;
        }
    }

    /**
     * Get items by sync status
     * @param {string} syncStatus - 'synced', 'pending', or 'conflict'
     * @returns {Promise<Array>}
     */
    async getItemsBySyncStatus(syncStatus) {
        return await this.db.getItemsBySyncStatus(syncStatus);
    }

    /**
     * Get pending sync count
     * @returns {Promise<number>}
     */
    async getPendingCount() {
        return await this.db.countShoppingSyncQueue('pending');
    }

    // ==================== CONFLICT RESOLUTION UI ====================

    /**
     * Show conflict resolution modal for DELETE vs UPDATE conflicts
     * No recommendation - user decides
     *
     * @param {Object} conflict - Conflict object from server
     * @returns {Promise<string>} Chosen strategy: 'keep' or 'delete'
     * @private
     */
    async _showDeleteConflictModal(conflict) {
        return new Promise((resolve) => {
            const serverItem = conflict.server_item;
            const productName = serverItem?.product_name || 'Товар';
            const isUpdateDelete = conflict.conflict_type === 'update_delete';

            // Create modal HTML
            const modalHtml = `
                <div id="conflict-modal" class="modal modal-open">
                    <div class="modal-box">
                        <h3 class="font-bold text-lg text-warning">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 inline-block mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                            Конфликт синхронизации
                        </h3>
                        <div class="py-4">
                            <p class="mb-4">
                                ${isUpdateDelete
                                    ? `Вы изменили "<strong>${productName}</strong>", но этот товар был удалён другим пользователем.`
                                    : `Вы удалили "<strong>${productName}</strong>", но этот товар был изменён другим пользователем.`
                                }
                            </p>
                            ${serverItem ? `
                            <div class="bg-base-200 p-3 rounded-lg mb-4">
                                <p class="text-sm font-medium mb-2">Текущее состояние на сервере:</p>
                                <ul class="text-sm space-y-1">
                                    <li><strong>Название:</strong> ${serverItem.product_name}</li>
                                    ${serverItem.quantity ? `<li><strong>Кол-во:</strong> ${serverItem.quantity} ${serverItem.unit || ''}</li>` : ''}
                                    ${serverItem.store_name ? `<li><strong>Магазин:</strong> ${serverItem.store_name}</li>` : ''}
                                    ${serverItem.is_completed ? '<li><span class="badge badge-success badge-sm">Выполнено</span></li>' : ''}
                                </ul>
                            </div>
                            ` : ''}
                            <p class="text-sm text-base-content/70">Выберите действие:</p>
                        </div>
                        <div class="modal-action flex-col sm:flex-row gap-2">
                            <button class="btn btn-outline" id="conflict-btn-keep">
                                ${isUpdateDelete ? 'Восстановить и применить мои изменения' : 'Сохранить (не удалять)'}
                            </button>
                            <button class="btn btn-error" id="conflict-btn-delete">
                                ${isUpdateDelete ? 'Оставить удалённым' : 'Всё равно удалить'}
                            </button>
                        </div>
                    </div>
                    <div class="modal-backdrop" id="conflict-backdrop"></div>
                </div>
            `;

            // Insert modal into DOM
            const modalContainer = document.createElement('div');
            modalContainer.innerHTML = modalHtml;
            document.body.appendChild(modalContainer);

            // Event handlers
            const modal = document.getElementById('conflict-modal');
            const btnKeep = document.getElementById('conflict-btn-keep');
            const btnDelete = document.getElementById('conflict-btn-delete');

            const closeModal = (result) => {
                modal.classList.remove('modal-open');
                setTimeout(() => {
                    modalContainer.remove();
                }, 200);
                resolve(result);
            };

            btnKeep.addEventListener('click', async () => {
                await this._resolveDeleteConflict(conflict, 'keep');
                closeModal('keep');
            });

            btnDelete.addEventListener('click', async () => {
                await this._resolveDeleteConflict(conflict, 'delete');
                closeModal('delete');
            });
        });
    }

    /**
     * Resolve DELETE conflict with chosen strategy
     *
     * @param {Object} conflict - Conflict object
     * @param {string} strategy - 'keep' or 'delete'
     * @private
     */
    async _resolveDeleteConflict(conflict, strategy) {
        try {
            const response = await fetch(`/api/v1/shopping-list-items/${conflict.item_id}/resolve-conflict`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    strategy: strategy === 'keep' ? 'server' : 'client',
                    client_data: strategy === 'keep' ? conflict.server_item : null
                })
            });

            if (response.ok) {
                debugLog('[OfflineShoppingManager] Conflict resolved:', conflict.item_id, strategy);

                // Remove from pending conflicts
                this.pendingConflicts = this.pendingConflicts.filter(c => c.item_id !== conflict.item_id);

                // Update local storage
                const tempId = `temp_item_${conflict.item_id}`;
                if (strategy === 'delete') {
                    await this.db.deleteShoppingListItem(tempId);
                } else {
                    const serverItem = conflict.server_item;
                    await this.db.updateShoppingListItem({
                        tempId,
                        serverId: conflict.item_id,
                        ...serverItem,
                        synced: true,
                        syncStatus: 'synced'
                    });
                }

                // Notify UI to refresh
                if (typeof window.listsManager !== 'undefined') {
                    window.listsManager.loadItems();
                }
            } else {
                throw new Error(`Failed to resolve conflict: ${response.status}`);
            }
        } catch (error) {
            console.error('[OfflineShoppingManager] Error resolving conflict:', error);
            this._showOfflineToast('Ошибка при разрешении конфликта');
        }
    }

    /**
     * Check if there are pending conflicts
     * @returns {boolean}
     */
    hasPendingConflicts() {
        return this.pendingConflicts.length > 0;
    }

    /**
     * Get pending conflicts count
     * @returns {number}
     */
    getPendingConflictsCount() {
        return this.pendingConflicts.length;
    }

    /**
     * Show offline toast (with debounce)
     * @private
     */
    _showOfflineToast(message) {
        const now = Date.now();
        if (now - this.offlineManager.lastToastTime < this.offlineManager.toastDebounceMs) {
            return; // Prevent toast spam
        }

        this.offlineManager.lastToastTime = now;

        if (typeof showToast === 'function') {
            showToast(message, 'warning', 5000);
        }
    }

    /**
     * Show server error toast (for HTTP 4xx/5xx errors)
     * @param {string} message - Error message
     * @private
     */
    _showServerErrorToast(message) {
        if (typeof showToast === 'function') {
            showToast(message, 'error', 5000);
        }
    }
}

// Export as global
if (typeof window !== 'undefined') {
    window.OfflineShoppingManager = OfflineShoppingManager;
}

debugLog('[OfflineShoppingManager] Module loaded');
