/**
 * UI helper utilities.
 *
 * Provides common UI operations like alerts, loading states, formatting.
 */

class UI {
  /**
   * @param {TelegramWebApp} tg - Telegram Web App instance
   */
  constructor(tg) {
    this.tg = tg;
  }

  // ==================== MainButton Helpers ====================

  /**
   * Show loading state on MainButton.
   *
   * @param {string} text - Loading text (default: "Загрузка...")
   */
  showLoading(text = 'Загрузка...') {
    const btn = this.tg.MainButton;
    btn.setText(text);
    btn.showProgress();
    btn.disable();
  }

  /**
   * Hide loading state on MainButton.
   *
   * @param {string} text - Button text to restore
   */
  hideLoading(text = 'Сохранить') {
    const btn = this.tg.MainButton;
    btn.hideProgress();
    btn.setText(text);
    btn.enable();
  }

  // ==================== Alerts & Popups ====================

  /**
   * Show success message.
   *
   * @param {string} message - Success message
   * @param {Function} callback - Callback after closing (optional)
   */
  showSuccess(message, callback) {
    this.tg.showAlert(message, callback);
    this.tg.HapticFeedback.notificationOccurred('success');
  }

  /**
   * Show error message.
   *
   * @param {string} message - Error message
   */
  showError(message) {
    this.tg.showAlert(message);
    this.tg.HapticFeedback.notificationOccurred('error');
  }

  /**
   * Show warning message.
   *
   * @param {string} message - Warning message
   */
  showWarning(message) {
    this.tg.showAlert(message);
    this.tg.HapticFeedback.notificationOccurred('warning');
  }

  /**
   * Show confirmation popup.
   *
   * @param {string} message - Confirmation message
   * @param {Function} onConfirm - Callback if user confirms
   */
  confirmAction(message, onConfirm) {
    this.tg.showConfirm(message, (confirmed) => {
      if (confirmed) {
        onConfirm();
      }
    });
  }

  /**
   * Show popup with custom buttons.
   *
   * @param {Object} params - Popup parameters
   * @param {string} params.title - Popup title
   * @param {string} params.message - Popup message
   * @param {Array} params.buttons - Array of button objects
   */
  showPopup(params) {
    this.tg.showPopup(params);
  }

  // ==================== Haptic Feedback ====================

  /**
   * Trigger light impact haptic feedback.
   */
  hapticLight() {
    this.tg.HapticFeedback.impactOccurred('light');
  }

  /**
   * Trigger medium impact haptic feedback.
   */
  hapticMedium() {
    this.tg.HapticFeedback.impactOccurred('medium');
  }

  /**
   * Trigger heavy impact haptic feedback.
   */
  hapticHeavy() {
    this.tg.HapticFeedback.impactOccurred('heavy');
  }

  /**
   * Trigger selection changed haptic feedback.
   */
  hapticSelection() {
    this.tg.HapticFeedback.selectionChanged();
  }

  // ==================== Formatting Helpers ====================

  /**
   * Format amount for display.
   *
   * @param {number} amount - Amount to format
   * @returns {string} Formatted amount (e.g., "1 234.56")
   */
  formatAmount(amount) {
    return new Intl.NumberFormat('ru-RU', {
      style: 'decimal',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(Math.abs(amount));
  }

  /**
   * Format date for display.
   *
   * @param {string|Date} dateString - Date to format
   * @returns {string} Formatted date (e.g., "24 октября 2025")
   */
  formatDate(dateString) {
    const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
    return new Intl.DateTimeFormat('ru-RU', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    }).format(date);
  }

  /**
   * Format date short (without year).
   *
   * @param {string|Date} dateString - Date to format
   * @returns {string} Formatted date (e.g., "24 окт")
   */
  formatDateShort(dateString) {
    const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
    return new Intl.DateTimeFormat('ru-RU', {
      day: 'numeric',
      month: 'short'
    }).format(date);
  }

  /**
   * Format time for display.
   *
   * @param {string|Date} dateString - Date to format
   * @returns {string} Formatted time (e.g., "14:30")
   */
  formatTime(dateString) {
    const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
    return new Intl.DateTimeFormat('ru-RU', {
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  }

  // ==================== Element Helpers ====================

  /**
   * Show element.
   *
   * @param {string|Element} element - Element or selector
   */
  show(element) {
    const el = typeof element === 'string' ? document.querySelector(element) : element;
    if (el) el.style.display = '';
  }

  /**
   * Hide element.
   *
   * @param {string|Element} element - Element or selector
   */
  hide(element) {
    const el = typeof element === 'string' ? document.querySelector(element) : element;
    if (el) el.style.display = 'none';
  }

  /**
   * Toggle element visibility.
   *
   * @param {string|Element} element - Element or selector
   */
  toggle(element) {
    const el = typeof element === 'string' ? document.querySelector(element) : element;
    if (el) {
      el.style.display = el.style.display === 'none' ? '' : 'none';
    }
  }
}
