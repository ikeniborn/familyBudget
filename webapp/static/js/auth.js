/**
 * Telegram Web Apps authentication module.
 *
 * Handles initData validation and JWT token management.
 *
 * Usage:
 *   const auth = new Auth();
 *   const isValid = await auth.validate();
 *   if (isValid) {
 *     const token = auth.getToken();
 *     // Use token for API calls
 *   }
 */

class Auth {
  constructor() {
    this.token = null;
    this.user = null;
  }

  /**
   * Validate Telegram initData and get JWT token.
   *
   * @returns {Promise<boolean>} True if validation successful
   */
  async validate() {
    try {
      const tg = window.Telegram.WebApp;
      const initData = tg.initData;

      console.log('Auth: Starting validation...');
      console.log('Auth: Telegram WebApp version:', tg.version);
      console.log('Auth: initData length:', initData ? initData.length : 0);
      console.log('Auth: initData preview:', initData ? initData.substring(0, 100) + '...' : 'EMPTY');

      if (!initData) {
        console.error('Auth: initData is empty - WebApp not launched from Telegram?');
        alert('Ошибка: initData пустой. Откройте WebApp через Telegram бота.');
        return false;
      }

      // Call backend validation endpoint
      console.log('Auth: Calling /api/v1/webapp/validate...');
      const response = await fetch('/api/v1/webapp/validate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ initData })
      });

      console.log('Auth: Response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Auth: Validation failed', response.status, errorText);
        alert(`Ошибка авторизации: ${response.status}\n${errorText}`);
        return false;
      }

      const data = await response.json();
      console.log('Auth: Validation successful, user:', data.user);

      // Store token and user data
      this.token = data.access_token;
      this.user = data.user;

      // Store token in CloudStorage for reuse
      await this.saveTokenToStorage();

      return true;

    } catch (error) {
      console.error('Auth: Validation error', error);
      alert(`Ошибка инициализации: ${error.message}`);
      return false;
    }
  }

  /**
   * Save token to Telegram CloudStorage.
   */
  async saveTokenToStorage() {
    if (!this.token) return;

    try {
      await new Promise((resolve, reject) => {
        window.Telegram.WebApp.CloudStorage.setItem(
          'access_token',
          this.token,
          (error, result) => {
            if (error) reject(error);
            else resolve(result);
          }
        );
      });
    } catch (error) {
      console.error('Auth: Failed to save token to storage', error);
    }
  }

  /**
   * Load token from Telegram CloudStorage.
   *
   * @returns {Promise<string|null>} Token or null
   */
  async loadTokenFromStorage() {
    try {
      const token = await new Promise((resolve, reject) => {
        window.Telegram.WebApp.CloudStorage.getItem(
          'access_token',
          (error, value) => {
            if (error) reject(error);
            else resolve(value);
          }
        );
      });

      if (token) {
        this.token = token;
        return token;
      }

      return null;
    } catch (error) {
      console.error('Auth: Failed to load token from storage', error);
      return null;
    }
  }

  /**
   * Get current JWT token.
   *
   * @returns {string|null} JWT token or null
   */
  getToken() {
    return this.token;
  }

  /**
   * Get current user data.
   *
   * @returns {Object|null} User data or null
   */
  getUser() {
    return this.user;
  }

  /**
   * Check if user is authenticated.
   *
   * @returns {boolean} True if authenticated
   */
  isAuthenticated() {
    return this.token !== null;
  }
}
