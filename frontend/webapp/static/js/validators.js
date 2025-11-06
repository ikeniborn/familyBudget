/**
 * Form validation utilities.
 *
 * Provides validation functions for form inputs.
 */

class Validators {
  /**
   * Validate required field.
   *
   * @param {any} value - Field value
   * @param {string} fieldName - Field name for error message
   * @returns {string|null} Error message or null if valid
   */
  static required(value, fieldName) {
    if (value === null || value === undefined || value === '') {
      return `Поле "${fieldName}" обязательно`;
    }
    if (typeof value === 'string' && value.trim() === '') {
      return `Поле "${fieldName}" не может быть пустым`;
    }
    return null;
  }

  /**
   * Validate amount.
   *
   * @param {any} value - Amount value
   * @returns {string|null} Error message or null if valid
   */
  static amount(value) {
    const num = parseFloat(value);

    if (isNaN(num)) {
      return 'Сумма должна быть числом';
    }

    if (num <= 0) {
      return 'Сумма должна быть больше 0';
    }

    if (num > 9999999.99) {
      return 'Сумма слишком большая (макс: 9 999 999.99)';
    }

    // Check decimal places (max 2)
    const decimalPart = value.toString().split('.')[1];
    if (decimalPart && decimalPart.length > 2) {
      return 'Максимум 2 знака после запятой';
    }

    return null;
  }

  /**
   * Validate date.
   *
   * @param {any} value - Date value (YYYY-MM-DD or Date object)
   * @returns {string|null} Error message or null if valid
   */
  static date(value) {
    if (!value) {
      return 'Дата обязательна';
    }

    const date = value instanceof Date ? value : new Date(value);
    const today = new Date();
    today.setHours(23, 59, 59, 999); // End of today

    if (isNaN(date.getTime())) {
      return 'Неверный формат даты';
    }

    if (date > today) {
      return 'Дата не может быть в будущем';
    }

    return null;
  }

  /**
   * Validate max length.
   *
   * @param {string} value - String value
   * @param {number} max - Maximum length
   * @param {string} fieldName - Field name for error message
   * @returns {string|null} Error message or null if valid
   */
  static maxLength(value, max, fieldName) {
    if (!value) return null;

    if (value.length > max) {
      return `Поле "${fieldName}" не должно превышать ${max} символов`;
    }

    return null;
  }

  /**
   * Validate min length.
   *
   * @param {string} value - String value
   * @param {number} min - Minimum length
   * @param {string} fieldName - Field name for error message
   * @returns {string|null} Error message or null if valid
   */
  static minLength(value, min, fieldName) {
    if (!value) return null;

    if (value.length < min) {
      return `Поле "${fieldName}" должно содержать минимум ${min} символов`;
    }

    return null;
  }

  /**
   * Validate email format.
   *
   * @param {string} value - Email value
   * @returns {string|null} Error message or null if valid
   */
  static email(value) {
    if (!value) return null;

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(value)) {
      return 'Неверный формат email';
    }

    return null;
  }

  /**
   * Validate positive number.
   *
   * @param {any} value - Number value
   * @returns {string|null} Error message or null if valid
   */
  static positiveNumber(value) {
    const num = parseFloat(value);

    if (isNaN(num)) {
      return 'Должно быть числом';
    }

    if (num <= 0) {
      return 'Должно быть положительным числом';
    }

    return null;
  }

  /**
   * Validate form with multiple rules.
   *
   * @param {Object} formData - Form data object
   * @param {Object} rules - Validation rules
   *   Example: {
   *     amount: [Validators.required, Validators.amount],
   *     description: [(v) => Validators.maxLength(v, 500, 'Описание')]
   *   }
   * @returns {Object|null} Errors object or null if valid
   *   Example: { amount: 'Сумма обязательна', description: 'Слишком длинное' }
   */
  static validateForm(formData, rules) {
    const errors = {};

    for (const [field, validators] of Object.entries(rules)) {
      const value = formData[field];

      for (const validator of validators) {
        const error = validator(value);
        if (error) {
          errors[field] = error;
          break; // Stop at first error for field
        }
      }
    }

    return Object.keys(errors).length > 0 ? errors : null;
  }

  /**
   * Show validation errors on form.
   *
   * @param {Object} errors - Errors object from validateForm
   * @param {string} containerSelector - Form container selector
   */
  static showFormErrors(errors, containerSelector = 'form') {
    // Clear previous errors
    document.querySelectorAll('.error-message').forEach(el => el.remove());
    document.querySelectorAll('.input-error').forEach(el => el.classList.remove('input-error'));

    if (!errors) return;

    for (const [field, error] of Object.entries(errors)) {
      const input = document.querySelector(`[name="${field}"]`);

      if (input) {
        // Add error class to input
        input.classList.add('input-error');

        // Create error message element
        const errorEl = document.createElement('div');
        errorEl.className = 'error-message';
        errorEl.textContent = error;

        // Insert after input
        input.parentNode.insertBefore(errorEl, input.nextSibling);
      }
    }
  }

  /**
   * Clear form validation errors.
   *
   * @param {string} containerSelector - Form container selector
   */
  static clearFormErrors(containerSelector = 'form') {
    document.querySelectorAll('.error-message').forEach(el => el.remove());
    document.querySelectorAll('.input-error').forEach(el => el.classList.remove('input-error'));
  }
}
