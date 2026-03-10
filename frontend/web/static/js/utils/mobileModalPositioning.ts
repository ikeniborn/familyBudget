/**
 * Mobile Modal Positioning Utility
 *
 * Shifts a modal's .modal-box to the top of the screen when a Choices.js
 * dropdown opens, so the dropdown list remains visible above the virtual keyboard.
 *
 * Responsive rules:
 *   - Mobile  (< 768px)    : ALWAYS shift
 *   - Tablet  (768–1023px) : shift only if dropdown won't fit below the select
 *   - Desktop (>= 1024px)  : NEVER shift
 *
 * Note: we target .modal-box with inline styles, not the <dialog> element,
 * because CSS Grid auto-margins (my-auto on .modal-box) override align-items
 * set on the parent <dialog>.
 */

const MOBILE_BREAKPOINT  = 768;   // px — below this: always shift
const DESKTOP_BREAKPOINT = 1024;  // px — above this: never shift
const DROPDOWN_MIN_HEIGHT = 280;  // px — minimum vertical space needed below select

/**
 * Decide at the moment of showDropdown whether to shift the modal.
 * Re-evaluated on every open so it reacts to window resize between opens.
 */
export function shouldShiftModal(selectElement: HTMLElement): boolean {
    const width = window.innerWidth;
    if (width >= DESKTOP_BREAKPOINT) return false;  // desktop: never
    if (width < MOBILE_BREAKPOINT)   return true;   // mobile: always

    // Tablet: shift only if there is not enough space below the select element
    const rect = selectElement.getBoundingClientRect();
    return (window.innerHeight - rect.bottom) < DROPDOWN_MIN_HEIGHT;
}

/**
 * Attach Choices.js showDropdown/hideDropdown listeners to a ChoicesCategoryTree
 * instance to dynamically reposition the modal on mobile/tablet.
 *
 * Guard: uses dataset.mobilePositioningAttached to prevent duplicate listeners
 * across multiple modal opens (instance persists, DOM element persists).
 *
 * @param instance      ChoicesCategoryTree instance (must expose .element)
 * @param modalSelector CSS selector for the <dialog> element
 */
export function setupMobileModalPositioning(instance: any, modalSelector: string): void {
    if (!instance?.element) return;

    // Guard against duplicate listeners on the same element
    if (instance.element.dataset.mobilePositioningAttached === 'true') return;

    const modal = document.querySelector<HTMLDialogElement>(modalSelector);
    if (!modal) return;

    // Target .modal-box directly — inline style overrides class-based margins
    const modalBox = modal.querySelector<HTMLElement>('.modal-box');
    if (!modalBox) return;

    instance.element.addEventListener('showDropdown', () => {
        if (shouldShiftModal(instance.element)) {
            modalBox.style.marginTop    = '0';
            modalBox.style.marginBottom = 'auto';
        }
    });

    instance.element.addEventListener('hideDropdown', () => {
        modalBox.style.marginTop    = '';
        modalBox.style.marginBottom = '';
    });

    instance.element.dataset.mobilePositioningAttached = 'true';
}
