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
  private storage: TelegramCloudStorage;

  /**
   * @param tg - Telegram Web App instance
   */
  constructor(tg: TelegramWebApp) {
    this.storage = tg.CloudStorage;
  }

  /**
   * Get item from CloudStorage.
   *
   * @param key - Storage key
   * @returns Value or null if not found
   */
  async getItem(key: string): Promise<string | null> {
    return new Promise((resolve, reject) => {
      this.storage.getItem(key, (error, value) => {
        if (error) {
          console.error(`Storage: getItem(${key}) error:`, error);
          reject(error);
        } else {
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
  async setItem(key: string, value: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.storage.setItem(key, value, (error, _result) => {
        if (error) {
          console.error(`Storage: setItem(${key}) error:`, error);
          reject(error);
        } else {
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
  async getItems(keys: string[]): Promise<Record<string, string>> {
    return new Promise((resolve, reject) => {
      this.storage.getItems(keys, (error, values) => {
        if (error) {
          console.error('Storage: getItems error:', error);
          reject(error);
        } else {
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
  async setItems(items: Record<string, string>): Promise<void[]> {
    const promises = Object.entries(items).map(([key, value]) =>
      this.setItem(key, value)
    );
    return Promise.all(promises);
  }

  /**
   * Remove item from CloudStorage.
   *
   * @param key - Storage key
   */
  async removeItem(key: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.storage.removeItem(key, (error, _result) => {
        if (error) {
          console.error(`Storage: removeItem(${key}) error:`, error);
          reject(error);
        } else {
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
  async removeItems(keys: string[]): Promise<void> {
    return new Promise((resolve, reject) => {
      this.storage.removeItems(keys, (error, _result) => {
        if (error) {
          console.error('Storage: removeItems error:', error);
          reject(error);
        } else {
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
  async getKeys(): Promise<string[]> {
    return new Promise((resolve, reject) => {
      this.storage.getKeys((error, keys) => {
        if (error) {
          console.error('Storage: getKeys error:', error);
          reject(error);
        } else {
          resolve(keys || []);
        }
      });
    });
  }

  /**
   * Clear all items from CloudStorage.
   */
  async clear(): Promise<void> {
    const keys = await this.getKeys();
    return this.removeItems(keys);
  }

  /**
   * Check if key exists in CloudStorage.
   *
   * @param key - Storage key
   * @returns True if exists
   */
  async hasItem(key: string): Promise<boolean> {
    const value = await this.getItem(key);
    return value !== null;
  }

  /**
   * Get JSON value from CloudStorage.
   *
   * @param key - Storage key
   * @returns Parsed JSON value or null
   */
  async getJSON<T = any>(key: string): Promise<T | null> {
    const value = await this.getItem(key);
    if (!value) return null;

    try {
      return JSON.parse(value) as T;
    } catch (error) {
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
  async setJSON(key: string, value: any): Promise<void> {
    try {
      const jsonString = JSON.stringify(value);
      return this.setItem(key, jsonString);
    } catch (error) {
      console.error(`Storage: setJSON(${key}) stringify error:`, error);
      throw error;
    }
  }
}

// Export to window for global access
if (typeof window !== 'undefined') {
  (window as any).TelegramStorage = TelegramStorage;
}
