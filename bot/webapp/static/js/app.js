/**
 * Core application initialization.
 *
 * Main entry point for Telegram Web App.
 * Handles initialization, theme setup, authentication, and UI setup.
 *
 * Usage:
 *   const app = new BudgetApp();
 *   app.init();
 */

class BudgetApp {
  constructor() {
    this.tg = window.Telegram.WebApp;
    this.auth = new Auth();
    this.api = new APIClient(this.auth);
    this.ui = new UI(this.tg);
    this.theme = new Theme(this.tg);
  }

  /**
   * Initialize application.
   * Call this on page load.
   */
  async init() {
    try {
      // Step 1: Initialize Telegram Web App SDK
      this.tg.ready();
      console.log('App: Telegram WebApp initialized');

      // Step 2: Setup theme
      this.theme.apply();
      console.log('App: Theme applied');

      // Step 3: Listen for theme changes
      this.tg.onEvent('themeChanged', () => {
        this.theme.apply();
      });

      // Step 4: Expand Web App to fullscreen
      this.tg.expand();

      // Step 5: Validate authentication
      const isValid = await this.auth.validate();

      if (!isValid) {
        this.ui.showError('Ошибка авторизации. Перезапустите бота.');
        console.error('App: Authentication failed');
        // Wait 2 seconds then close
        setTimeout(() => this.tg.close(), 2000);
        return;
      }

      console.log('App: Authentication successful');
      console.log('App: User:', this.auth.getUser());

      // Step 6: Enable haptic feedback
      this.tg.HapticFeedback.impactOccurred('light');

      // Step 7: Call page-specific init (if exists)
      if (typeof window.pageInit === 'function') {
        await window.pageInit(this);
      }

      console.log('App: Initialization complete');

    } catch (error) {
      console.error('App: Initialization error', error);
      this.ui.showError('Ошибка инициализации приложения');
      setTimeout(() => this.tg.close(), 2000);
    }
  }

  /**
   * Setup MainButton.
   *
   * @param {string} text - Button text
   * @param {Function} onClick - Click handler
   * @param {Object} options - Button options
   * @param {string} options.color - Button color (hex)
   * @param {boolean} options.enabled - Initially enabled
   */
  setupMainButton(text, onClick, options = {}) {
    const btn = this.tg.MainButton;

    btn.setText(text);

    if (options.color) {
      btn.setParams({ color: options.color });
    }

    if (options.enabled !== false) {
      btn.enable();
    } else {
      btn.disable();
    }

    // Remove previous listeners (if any)
    btn.offClick(btn._clickHandler);

    // Add new listener
    btn._clickHandler = onClick;
    btn.onClick(onClick);

    btn.show();
  }

  /**
   * Setup BackButton.
   *
   * @param {Function} onClick - Click handler (optional)
   */
  setupBackButton(onClick) {
    const btn = this.tg.BackButton;

    // Default behavior: navigate back or close
    const defaultOnClick = () => {
      if (window.history.length > 1) {
        window.history.back();
      } else {
        this.tg.close();
      }
    };

    const handler = onClick || defaultOnClick;

    // Remove previous listeners
    btn.offClick(btn._clickHandler);

    // Add new listener
    btn._clickHandler = handler;
    btn.onClick(handler);

    btn.show();
  }

  /**
   * Hide MainButton.
   */
  hideMainButton() {
    this.tg.MainButton.hide();
  }

  /**
   * Hide BackButton.
   */
  hideBackButton() {
    this.tg.BackButton.hide();
  }
}

// Global app instance (will be initialized on page load)
let app = null;

// Auto-initialize when DOM ready
document.addEventListener('DOMContentLoaded', async () => {
  app = new BudgetApp();
  await app.init();

  // Make app globally accessible
  window.app = app;
});
