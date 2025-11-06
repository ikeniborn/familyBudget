/**
 * Telegram theme management.
 *
 * Applies Telegram theme colors to Web App.
 */

class Theme {
  /**
   * @param {TelegramWebApp} tg - Telegram Web App instance
   */
  constructor(tg) {
    this.tg = tg;
  }

  /**
   * Apply Telegram theme to document.
   * Sets CSS variables from themeParams.
   */
  apply() {
    const params = this.tg.themeParams;
    const root = document.documentElement;

    // Primary colors
    root.style.setProperty('--tg-theme-bg-color', params.bg_color || '#ffffff');
    root.style.setProperty('--tg-theme-text-color', params.text_color || '#000000');
    root.style.setProperty('--tg-theme-hint-color', params.hint_color || '#999999');
    root.style.setProperty('--tg-theme-link-color', params.link_color || '#2678b6');

    // Button colors
    root.style.setProperty('--tg-theme-button-color', params.button_color || '#2678b6');
    root.style.setProperty('--tg-theme-button-text-color', params.button_text_color || '#ffffff');

    // Secondary colors
    root.style.setProperty('--tg-theme-secondary-bg-color', params.secondary_bg_color || '#f0f0f0');

    // Header colors (if available)
    if (params.header_bg_color) {
      root.style.setProperty('--tg-theme-header-bg-color', params.header_bg_color);
    }

    // Section colors (if available)
    if (params.section_bg_color) {
      root.style.setProperty('--tg-theme-section-bg-color', params.section_bg_color);
    }
    if (params.section_header_text_color) {
      root.style.setProperty('--tg-theme-section-header-text-color', params.section_header_text_color);
    }

    // Accent colors (if available)
    if (params.accent_text_color) {
      root.style.setProperty('--tg-theme-accent-text-color', params.accent_text_color);
    }

    // Destructive colors (if available)
    if (params.destructive_text_color) {
      root.style.setProperty('--tg-theme-destructive-text-color', params.destructive_text_color);
    }

    // Subtitle colors (if available)
    if (params.subtitle_text_color) {
      root.style.setProperty('--tg-theme-subtitle-text-color', params.subtitle_text_color);
    }

    // Apply color scheme class
    this.applyColorScheme();

    console.log('Theme: Applied Telegram theme', params);
  }

  /**
   * Apply color scheme class to body (light/dark).
   */
  applyColorScheme() {
    const colorScheme = this.tg.colorScheme || 'light';
    document.body.className = `theme-${colorScheme}`;
  }

  /**
   * Check if dark theme is active.
   *
   * @returns {boolean} True if dark theme
   */
  isDark() {
    return this.tg.colorScheme === 'dark';
  }

  /**
   * Check if light theme is active.
   *
   * @returns {boolean} True if light theme
   */
  isLight() {
    return this.tg.colorScheme === 'light';
  }

  /**
   * Get current theme parameters.
   *
   * @returns {Object} Theme parameters object
   */
  getParams() {
    return this.tg.themeParams;
  }

  /**
   * Get specific theme color.
   *
   * @param {string} key - Color key (e.g., 'bg_color', 'button_color')
   * @returns {string} Color hex value
   */
  getColor(key) {
    return this.tg.themeParams[key];
  }
}
