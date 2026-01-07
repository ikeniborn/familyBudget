/**
 * Telegram CloudStorage wrapper.
 *
 * Provides promise-based interface for CloudStorage operations.
 */

class Storage {
  /**
   * @param {TelegramWebApp} tg - Telegram Web App instance
   */
  constructor(tg) {
    this.tg = tg;
    this.storage = tg.CloudStorage;
  }

  /**
   * Get item from CloudStorage.
   *
   * @param {string} key - Storage key
   * @returns {Promise<string|null>} Value or null if not found
   */
  async getItem(key) {
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
   * @param {string} key - Storage key
   * @param {string} value - Storage value
   * @returns {Promise<void>}
   */
  async setItem(key, value) {
    return new Promise((resolve, reject) => {
      this.storage.setItem(key, value, (error, result) => {
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
   * @param {string[]} keys - Array of storage keys
   * @returns {Promise<Object>} Object with key-value pairs
   */
  async getItems(keys) {
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
   * @param {Object} items - Object with key-value pairs
   * @returns {Promise<void>}
   */
  async setItems(items) {
    const promises = Object.entries(items).map(([key, value]) =>
      this.setItem(key, value)
    );
    return Promise.all(promises);
  }

  /**
   * Remove item from CloudStorage.
   *
   * @param {string} key - Storage key
   * @returns {Promise<void>}
   */
  async removeItem(key) {
    return new Promise((resolve, reject) => {
      this.storage.removeItem(key, (error, result) => {
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
   * @param {string[]} keys - Array of storage keys
   * @returns {Promise<void>}
   */
  async removeItems(keys) {
    return new Promise((resolve, reject) => {
      this.storage.removeItems(keys, (error, result) => {
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
   * @returns {Promise<string[]>} Array of keys
   */
  async getKeys() {
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
   *
   * @returns {Promise<void>}
   */
  async clear() {
    const keys = await this.getKeys();
    return this.removeItems(keys);
  }

  /**
   * Check if key exists in CloudStorage.
   *
   * @param {string} key - Storage key
   * @returns {Promise<boolean>} True if exists
   */
  async hasItem(key) {
    const value = await this.getItem(key);
    return value !== null;
  }

  /**
   * Get JSON value from CloudStorage.
   *
   * @param {string} key - Storage key
   * @returns {Promise<any>} Parsed JSON value or null
   */
  async getJSON(key) {
    const value = await this.getItem(key);
    if (!value) return null;

    try {
      return JSON.parse(value);
    } catch (error) {
      console.error(`Storage: getJSON(${key}) parse error:`, error);
      return null;
    }
  }

  /**
   * Set JSON value in CloudStorage.
   *
   * @param {string} key - Storage key
   * @param {any} value - Value to stringify and store
   * @returns {Promise<void>}
   */
  async setJSON(key, value) {
    try {
      const jsonString = JSON.stringify(value);
      return this.setItem(key, jsonString);
    } catch (error) {
      console.error(`Storage: setJSON(${key}) stringify error:`, error);
      throw error;
    }
  }
}

export default Storage;
