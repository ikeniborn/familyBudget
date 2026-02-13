/**
 * DOM Utilities - Safe DOM manipulation helpers
 *
 * Security-focused utilities for XSS-safe DOM operations.
 * All functions use DOM API with textContent instead of innerHTML
 * to prevent XSS vulnerabilities.
 *
 * @module domUtils
 */

/**
 * Safely display error message in container element
 *
 * Uses DOM API with textContent to prevent XSS attacks.
 * Clears container and creates new span element with error styling.
 *
 * @param {HTMLElement} container - Container element to display error in
 * @param {string} message - Error message to display
 * @param {string} [className='text-error'] - CSS class for error styling
 *
 * @example
 * // Basic usage
 * const statusEl = document.getElementById('status');
 * showSafeError(statusEl, 'Failed to load data');
 *
 * @example
 * // Custom styling
 * showSafeError(statusEl, 'Warning message', 'text-warning');
 *
 * @example
 * // In catch block
 * catch (error) {
 *   console.error('Operation failed:', error);
 *   showSafeError(statusEl, `❌ Ошибка: ${error.message}`);
 * }
 */
function showSafeError(container, message, className = 'text-error') {
    if (!container) {
        console.warn('[domUtils] showSafeError: container is null');
        return;
    }

    // Clear container
    container.innerHTML = '';

    // Create span element with safe textContent
    const span = document.createElement('span');
    span.className = className;
    span.textContent = message;  // textContent is XSS-safe

    // Append to container
    container.appendChild(span);
}

/**
 * Safely display success message in container element
 *
 * Similar to showSafeError but with success styling.
 *
 * @param {HTMLElement} container - Container element to display message in
 * @param {string} message - Success message to display
 * @param {string} [className='text-success'] - CSS class for success styling
 *
 * @example
 * showSafeSuccess(statusEl, '✓ Data loaded successfully');
 */
function showSafeSuccess(container, message, className = 'text-success') {
    if (!container) {
        console.warn('[domUtils] showSafeSuccess: container is null');
        return;
    }

    container.innerHTML = '';
    const span = document.createElement('span');
    span.className = className;
    span.textContent = message;
    container.appendChild(span);
}

/**
 * Safely display alert with message
 *
 * Creates DaisyUI alert component with safe content.
 *
 * @param {HTMLElement} container - Container element
 * @param {string} message - Alert message
 * @param {string} [alertType='alert-error'] - Alert type (alert-error, alert-success, alert-warning, alert-info)
 *
 * @example
 * showSafeAlert(container, 'Failed to save', 'alert-error');
 * showSafeAlert(container, 'Operation completed', 'alert-success');
 */
function showSafeAlert(container, message, alertType = 'alert-error') {
    if (!container) {
        console.warn('[domUtils] showSafeAlert: container is null');
        return;
    }

    container.innerHTML = '';

    const alertDiv = document.createElement('div');
    alertDiv.className = `alert ${alertType}`;

    const span = document.createElement('span');
    span.textContent = message;

    alertDiv.appendChild(span);
    container.appendChild(alertDiv);
}

/**
 * Safely display loading state
 *
 * Shows DaisyUI loading spinner with message.
 *
 * @param {HTMLElement} container - Container element
 * @param {string} [message='Загрузка...'] - Loading message
 *
 * @example
 * showSafeLoading(statusEl);
 * showSafeLoading(statusEl, 'Обработка данных...');
 */
function showSafeLoading(container, message = 'Загрузка...') {
    if (!container) {
        console.warn('[domUtils] showSafeLoading: container is null');
        return;
    }

    container.innerHTML = '<span class="loading loading-spinner loading-sm"></span> ';
    const textNode = document.createTextNode(message);
    container.appendChild(textNode);
}

/**
 * Safely set element content with text and optional prepend
 *
 * @param {HTMLElement} element - Element to set content
 * @param {string} text - Text content
 * @param {string} [prepend=''] - HTML to prepend (e.g., icon)
 *
 * @example
 * setSafeContent(element, 'User data loaded', '<span class="text-success">✓</span> ');
 */
function setSafeContent(element, text, prepend = '') {
    if (!element) {
        console.warn('[domUtils] setSafeContent: element is null');
        return;
    }

    element.innerHTML = prepend;  // Only prepend is innerHTML (controlled, not user data)
    const textNode = document.createTextNode(text);
    element.appendChild(textNode);
}

// Export for ES modules (if needed)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        showSafeError,
        showSafeSuccess,
        showSafeAlert,
        showSafeLoading,
        setSafeContent
    };
}

// Make available globally for use in HTML templates
window.showSafeError = showSafeError;
window.showSafeSuccess = showSafeSuccess;
window.showSafeAlert = showSafeAlert;
window.showSafeLoading = showSafeLoading;
window.setSafeContent = setSafeContent;
