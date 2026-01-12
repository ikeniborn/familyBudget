/**
 * Telegram CloudStorage wrapper.
 *
 * Provides promise-based interface for CloudStorage operations.
 *
 * @version 2.0.0
 * @date 2026-01-05
 */
/// <reference types="../../../../types/telegram" />
class TelegramStorage {
    /**
     * @param tg - Telegram Web App instance
     */
    constructor(tg) {
        this.storage = tg.CloudStorage;
    }
    /**
     * Get item from CloudStorage.
     *
     * @param key - Storage key
     * @returns Value or null if not found
     */
    async getItem(key) {
        return new Promise((resolve, reject) => {
            this.storage.getItem(key, (error, value) => {
                if (error) {
                    console.error(`Storage: getItem(${key}) error:`, error);
                    reject(error);
                }
                else {
                    resolve(value || null);
                }
            });
        });
    }
    /**
     * Set item in CloudStorage.
     *
     * @param key - Storage key
     * @param value - Storage value
     */
    async setItem(key, value) {
        return new Promise((resolve, reject) => {
            this.storage.setItem(key, value, (error, _result) => {
                if (error) {
                    console.error(`Storage: setItem(${key}) error:`, error);
                    reject(error);
                }
                else {
                    resolve();
                }
            });
        });
    }
    /**
     * Get multiple items from CloudStorage.
     *
     * @param keys - Array of storage keys
     * @returns Object with key-value pairs
     */
    async getItems(keys) {
        return new Promise((resolve, reject) => {
            this.storage.getItems(keys, (error, values) => {
                if (error) {
                    console.error('Storage: getItems error:', error);
                    reject(error);
                }
                else {
                    resolve(values || {});
                }
            });
        });
    }
    /**
     * Set multiple items in CloudStorage.
     *
     * @param items - Object with key-value pairs
     */
    async setItems(items) {
        const promises = Object.entries(items).map(([key, value]) => this.setItem(key, value));
        return Promise.all(promises);
    }
    /**
     * Remove item from CloudStorage.
     *
     * @param key - Storage key
     */
    async removeItem(key) {
        return new Promise((resolve, reject) => {
            this.storage.removeItem(key, (error, _result) => {
                if (error) {
                    console.error(`Storage: removeItem(${key}) error:`, error);
                    reject(error);
                }
                else {
                    resolve();
                }
            });
        });
    }
    /**
     * Remove multiple items from CloudStorage.
     *
     * @param keys - Array of storage keys
     */
    async removeItems(keys) {
        return new Promise((resolve, reject) => {
            this.storage.removeItems(keys, (error, _result) => {
                if (error) {
                    console.error('Storage: removeItems error:', error);
                    reject(error);
                }
                else {
                    resolve();
                }
            });
        });
    }
    /**
     * Get all keys from CloudStorage.
     *
     * @returns Array of keys
     */
    async getKeys() {
        return new Promise((resolve, reject) => {
            this.storage.getKeys((error, keys) => {
                if (error) {
                    console.error('Storage: getKeys error:', error);
                    reject(error);
                }
                else {
                    resolve(keys || []);
                }
            });
        });
    }
    /**
     * Clear all items from CloudStorage.
     */
    async clear() {
        const keys = await this.getKeys();
        return this.removeItems(keys);
    }
    /**
     * Check if key exists in CloudStorage.
     *
     * @param key - Storage key
     * @returns True if exists
     */
    async hasItem(key) {
        const value = await this.getItem(key);
        return value !== null;
    }
    /**
     * Get JSON value from CloudStorage.
     *
     * @param key - Storage key
     * @returns Parsed JSON value or null
     */
    async getJSON(key) {
        const value = await this.getItem(key);
        if (!value)
            return null;
        try {
            return JSON.parse(value);
        }
        catch (error) {
            console.error(`Storage: getJSON(${key}) parse error:`, error);
            return null;
        }
    }
    /**
     * Set JSON value in CloudStorage.
     *
     * @param key - Storage key
     * @param value - Value to stringify and store
     */
    async setJSON(key, value) {
        try {
            const jsonString = JSON.stringify(value);
            return this.setItem(key, jsonString);
        }
        catch (error) {
            console.error(`Storage: setJSON(${key}) stringify error:`, error);
            throw error;
        }
    }
}
// Export to window for global access (backward compatibility)
if (typeof window !== 'undefined') {
    window.TelegramStorage = TelegramStorage;
}
// ES Module export (Phase 2.5)
export default TelegramStorage;
//# sourceMappingURL=storage.js.map