/**
 * Delete Button Utilities
 *
 * JavaScript helpers для генерации стандартизированных delete buttons.
 * Соответствует Jinja2 macros в components/macros/delete_buttons.html
 *
 * @module deleteButtonUtils
 * @version 1.0.0
 * @created 2026-01-21
 */

/**
 * Delete Icon SVG
 *
 * Генерирует SVG иконку корзины (Heroicons trash icon)
 *
 * @param {string} sizeClass - Tailwind CSS класс размера (default: 'h-4 w-4')
 * @param {string} strokeColor - SVG stroke цвет (default: 'currentColor')
 * @returns {string} SVG element HTML
 *
 * @example
 * const icon = deleteIconSVG('h-4 w-4');
 * // Returns: <svg class="h-4 w-4" stroke="currentColor">...</svg>
 */
function deleteIconSVG(sizeClass = 'h-4 w-4', strokeColor = 'currentColor') {
    return `<svg xmlns="http://www.w3.org/2000/svg" class="${sizeClass}" fill="none" viewBox="0 0 24 24" stroke="${strokeColor}">
    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
</svg>`;
}

/**
 * Desktop Delete Button
 *
 * Генерирует delete button для desktop таблиц.
 * Соответствует Jinja2 macro: delete_button_desktop
 *
 * Visual characteristics:
 * - Size: btn-xs (compact for tables)
 * - Icon size: h-4 w-4 (16x16px)
 * - Color: btn-error (red DaisyUI)
 * - Visibility: hidden md:inline-flex (desktop only >= 768px)
 * - Shape: btn-square
 *
 * Accessibility:
 * - title="{{ title }}" - tooltip
 * - aria-label="{{ title }} {{ entityType }} ID {{ entityId }}" - screen readers
 * - data-{{ entityType }}-id="{{ entityId }}" - testing/debugging
 *
 * @param {number|string} entityId - ID сущности для удаления (required)
 * @param {string} deleteFunction - Имя JavaScript функции удаления (required)
 * @param {string} [entityType='entity'] - Тип сущности для data-* attribute
 * @param {string} [title='Удалить'] - Tooltip текст
 * @param {string} [extraClasses=''] - Дополнительные CSS классы
 * @returns {string} Button element HTML
 *
 * @example
 * // Simple usage
 * const btn = renderDeleteButtonDesktop(42, 'deleteFact', 'fact');
 * // Returns: <button class="btn btn-xs btn-error btn-square hidden md:inline-flex"
 * //                  data-fact-id="42"
 * //                  onclick="event.stopPropagation(); deleteFact(42)"
 * //                  title="Удалить"
 * //                  aria-label="Удалить fact ID 42">...</button>
 *
 * @example
 * // With extra classes
 * const btn = renderDeleteButtonDesktop(
 *     article.id,
 *     'deactivateArticle',
 *     'article',
 *     'Деактивировать',
 *     'ml-2'
 * );
 */
function renderDeleteButtonDesktop(entityId, deleteFunction, entityType = 'entity', title = 'Удалить', extraClasses = '') {
    return `<button class="btn btn-xs btn-error btn-square hidden md:inline-flex ${extraClasses}"
        data-${entityType}-id="${entityId}"
        onclick="event.stopPropagation(); ${deleteFunction}(${entityId})"
        title="${title}"
        aria-label="${title} ${entityType} ID ${entityId}">
    ${deleteIconSVG('h-4 w-4')}
</button>`;
}

/**
 * Mobile Delete Button
 *
 * Генерирует delete button для mobile модалей.
 * Соответствует Jinja2 macro: delete_button_mobile
 *
 * Visual characteristics:
 * - Size: btn-sm sm:btn-md (adaptive - larger on tablets)
 * - Icon size: h-5 w-5 (20x20px - larger for touch)
 * - Color: btn-error (red DaisyUI)
 * - Visibility: md:hidden (mobile only < 768px)
 * - Shape: btn-square
 *
 * Touch Accessibility:
 * - Minimum size: 44x44px (iOS/Android guidelines)
 * - btn-sm (32px) + padding → ~40px on phones ✅
 * - sm:btn-md (48px) + padding → ~56px on tablets ✅
 *
 * Accessibility:
 * - title="{{ title }}" - tooltip
 * - aria-label="{{ title }}" - screen readers
 * - type="button" - prevents form submit
 *
 * @param {string} onclickHandler - JavaScript выражение/вызов функции (required)
 * @param {string} [title='Удалить'] - Tooltip текст
 * @param {string} [extraClasses=''] - Дополнительные CSS классы
 * @returns {string} Button element HTML
 *
 * @example
 * // Simple usage
 * const btn = renderDeleteButtonMobile('deleteFromEditModal()');
 * // Returns: <button type="button"
 * //                  class="btn btn-sm sm:btn-md btn-error btn-square md:hidden"
 * //                  onclick="deleteFromEditModal()"
 * //                  title="Удалить"
 * //                  aria-label="Удалить">...</button>
 *
 * @example
 * // With custom title
 * const btn = renderDeleteButtonMobile('deletePlan(123)', 'Удалить план');
 */
function renderDeleteButtonMobile(onclickHandler, title = 'Удалить', extraClasses = '') {
    return `<button type="button"
        class="btn btn-sm sm:btn-md btn-error btn-square md:hidden ${extraClasses}"
        onclick="${onclickHandler}"
        title="${title}"
        aria-label="${title}">
    ${deleteIconSVG('h-5 w-5')}
</button>`;
}

// Export functions for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        deleteIconSVG,
        renderDeleteButtonDesktop,
        renderDeleteButtonMobile
    };
}

// Make functions globally available for inline usage
window.deleteIconSVG = deleteIconSVG;
window.renderDeleteButtonDesktop = renderDeleteButtonDesktop;
window.renderDeleteButtonMobile = renderDeleteButtonMobile;
