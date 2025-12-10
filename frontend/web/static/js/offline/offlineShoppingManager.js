/**
 * Offline Shopping Manager
 * Управление shopping lists и items в offline режиме
 *
 * Extension для OfflineManager с методами для shopping lists
 *
 * @version 1.0.0
 */

class OfflineShoppingManager {
    constructor(offlineManager) {
        this.offlineManager = offlineManager;
        this.db = offlineManager.db;
    }

    get isOnline() {
        return this.offlineManager.isOnline;
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
                    throw new Error('Failed to update item online');
                }
            } catch (error) {
                console.error('[OfflineShoppingManager] Error updating item online, saving offline:', error);
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
     * Sync shopping lists (process sync queue)
     * @returns {Promise<void>}
     */
    async sync() {
        if (!this.isOnline || this.offlineManager.syncInProgress) {
            return;
        }

        this.offlineManager.syncInProgress = true;

        try {
            debugLog('[OfflineShoppingManager] Starting sync...');

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
                            // Update local item
                            const localItem = await this.db.getShoppingListItem(queueItem.tempId);
                            if (localItem) {
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

            debugLog('[OfflineShoppingManager] Sync complete');

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
}

// Export as global
if (typeof window !== 'undefined') {
    window.OfflineShoppingManager = OfflineShoppingManager;
}

debugLog('[OfflineShoppingManager] Module loaded');
