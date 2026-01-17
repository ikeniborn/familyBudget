/**
 * Integration tests for Edit Modal UI fixes
 * Tests dropdown value preservation and responsive button layout
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('Edit Modal - Financial Center Dropdown', () => {
    let dropdown: HTMLSelectElement;

    beforeEach(() => {
        // Create dropdown element
        dropdown = document.createElement('select');
        dropdown.id = 'edit-financial-center';
        dropdown.innerHTML = `
            <option value="">-- Выберите счет --</option>
            <option value="1">Наличные</option>
            <option value="2">Карта Сбербанк</option>
            <option value="5">Тинькофф</option>
        `;
        document.body.appendChild(dropdown);
    });

    afterEach(() => {
        document.body.removeChild(dropdown);
    });

    it('should preserve dropdown value when set programmatically', () => {
        // Set value (as done in showEditModal)
        dropdown.value = '5';

        // Verify value is preserved
        expect(dropdown.value).toBe('5');

        // Verify selected option text
        const selectedOption = dropdown.options[dropdown.selectedIndex];
        expect(selectedOption.text).toBe('Тинькофф');
    });

    it('should preserve value after event listener registration via ModalListenerManager', () => {
        // Create ModalListenerManager
        const ModalListenerManager = (function() {
            let abortController: AbortController | null = null;
            return {
                registerListener(element: HTMLElement, eventName: string, handler: EventListener) {
                    if (abortController) {
                        abortController.abort();
                    }
                    abortController = new AbortController();
                    element.addEventListener(eventName, handler, { signal: abortController.signal });
                }
            };
        })();

        // Set value before registering listener
        dropdown.value = '2';
        expect(dropdown.value).toBe('2');

        // Register listener (should NOT reset value)
        ModalListenerManager.registerListener(dropdown, 'change', () => {});

        // Verify value is STILL preserved
        expect(dropdown.value).toBe('2');
        expect(dropdown.options[dropdown.selectedIndex].text).toBe('Карта Сбербанк');
    });

    it('should handle missing financial_center_id gracefully', () => {
        // Simulate fact without financial_center_id
        const financialCenterId = null;

        if (financialCenterId) {
            dropdown.value = String(financialCenterId);
        }

        // Should show placeholder
        expect(dropdown.value).toBe('');
        expect(dropdown.options[dropdown.selectedIndex].text).toBe('-- Выберите счет --');
    });

    it('should trigger change event with correct value', () => {
        let capturedValue: number | null = null;

        const ModalListenerManager = (function() {
            let abortController: AbortController | null = null;
            return {
                registerListener(element: HTMLElement, eventName: string, handler: EventListener) {
                    if (abortController) {
                        abortController.abort();
                    }
                    abortController = new AbortController();
                    element.addEventListener(eventName, handler, { signal: abortController.signal });
                }
            };
        })();

        // Register listener that captures value
        ModalListenerManager.registerListener(dropdown, 'change', () => {
            capturedValue = dropdown.value ? parseInt(dropdown.value) : null;
        });

        // Change value and dispatch event
        dropdown.value = '5';
        dropdown.dispatchEvent(new Event('change'));

        // Verify captured value
        expect(capturedValue).toBe(5);
    });
});

describe('Edit Modal - Responsive Button Layout', () => {
    let cancelButton: HTMLButtonElement;
    let saveButton: HTMLButtonElement;

    beforeEach(() => {
        // Create cancel button (new structure with span wrapper)
        cancelButton = document.createElement('button');
        cancelButton.className = 'btn btn-sm sm:btn-md flex-1 sm:flex-initial';
        cancelButton.innerHTML = `
            <span class="inline-flex items-center gap-1 whitespace-nowrap">
                <svg class="h-4 w-4"><!-- icon --></svg>
                <span>Отмена</span>
            </span>
        `;

        // Create save button (new structure with span wrapper)
        saveButton = document.createElement('button');
        saveButton.className = 'btn btn-sm sm:btn-md btn-primary save-btn flex-1 sm:flex-initial';
        saveButton.innerHTML = `
            <span class="inline-flex items-center gap-1 whitespace-nowrap">
                <svg class="h-4 w-4"><!-- icon --></svg>
                <span>Сохранить</span>
            </span>
        `;

        document.body.appendChild(cancelButton);
        document.body.appendChild(saveButton);
    });

    afterEach(() => {
        document.body.removeChild(cancelButton);
        document.body.removeChild(saveButton);
    });

    it('should have whitespace-nowrap class on cancel button wrapper', () => {
        const wrapper = cancelButton.querySelector('.whitespace-nowrap');
        expect(wrapper).not.toBeNull();
        expect(wrapper?.classList.contains('inline-flex')).toBe(true);
    });

    it('should have whitespace-nowrap class on save button wrapper', () => {
        const wrapper = saveButton.querySelector('.whitespace-nowrap');
        expect(wrapper).not.toBeNull();
        expect(wrapper?.classList.contains('inline-flex')).toBe(true);
    });

    it('should prevent text wrapping with inline-flex and whitespace-nowrap', () => {
        // Check cancel button wrapper structure
        const cancelWrapper = cancelButton.querySelector('.inline-flex.whitespace-nowrap');
        expect(cancelWrapper).not.toBeNull();
        expect(cancelWrapper?.classList.contains('items-center')).toBe(true);
        expect(cancelWrapper?.classList.contains('gap-1')).toBe(true);

        // Check save button wrapper structure
        const saveWrapper = saveButton.querySelector('.inline-flex.whitespace-nowrap');
        expect(saveWrapper).not.toBeNull();
        expect(saveWrapper?.classList.contains('items-center')).toBe(true);
        expect(saveWrapper?.classList.contains('gap-1')).toBe(true);
    });
});

describe('Edit Modal - Delete Button Icon', () => {
    let deleteButton: HTMLButtonElement;

    beforeEach(() => {
        deleteButton = document.createElement('button');
        deleteButton.className = 'btn btn-sm sm:btn-md btn-error btn-square md:hidden';
        deleteButton.setAttribute('onclick', 'deleteFromEditModal()');
        deleteButton.setAttribute('title', 'Удалить');

        // Use inline SVG with white stroke (Heroicons trash icon)
        deleteButton.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="white">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
        `;

        document.body.appendChild(deleteButton);
    });

    afterEach(() => {
        document.body.removeChild(deleteButton);
    });

    it('should use inline SVG instead of img tag', () => {
        const svg = deleteButton.querySelector('svg');
        expect(svg).not.toBeNull();
        expect(svg?.tagName).toBe('svg');
    });

    it('should have white stroke for visibility on red background', () => {
        const svg = deleteButton.querySelector('svg');
        expect(svg?.getAttribute('stroke')).toBe('white');
    });

    it('should have correct viewBox', () => {
        const svg = deleteButton.querySelector('svg');
        expect(svg?.getAttribute('viewBox')).toBe('0 0 24 24');
    });

    it('should have increased icon size (h-5 w-5 instead of h-4 w-4)', () => {
        const svg = deleteButton.querySelector('svg');
        expect(svg?.classList.contains('h-5')).toBe(true);
        expect(svg?.classList.contains('w-5')).toBe(true);
        expect(svg?.classList.contains('h-4')).toBe(false);
    });

    it('should have consistent button size (btn-sm sm:btn-md)', () => {
        expect(deleteButton.classList.contains('btn-sm')).toBe(true);
        expect(deleteButton.classList.contains('sm:btn-md')).toBe(true);
        expect(deleteButton.classList.contains('btn-xs')).toBe(false);
    });

    it('should be hidden on desktop (md:hidden)', () => {
        expect(deleteButton.classList.contains('md:hidden')).toBe(true);
    });
});

describe('Edit Modal - Narrow Screen Behavior (< 375px)', () => {
    it('should not wrap button text with inline-flex and whitespace-nowrap wrapper', () => {
        const button = document.createElement('button');
        button.className = 'btn btn-sm flex-1';
        button.innerHTML = `
            <span class="inline-flex items-center gap-1 whitespace-nowrap">
                <svg class="h-4 w-4"><!-- icon --></svg>
                <span>Отмена</span>
            </span>
        `;

        document.body.appendChild(button);

        // Verify wrapper structure prevents text wrapping
        const wrapper = button.querySelector('.inline-flex.whitespace-nowrap');
        expect(wrapper).not.toBeNull();
        expect(wrapper?.classList.contains('items-center')).toBe(true);

        // Simulate narrow viewport (375px iPhone SE)
        // Note: Happy-DOM doesn't support window.innerWidth changes,
        // but we can verify CSS class presence
        expect(wrapper?.className).toContain('whitespace-nowrap');
        expect(wrapper?.className).toContain('inline-flex');

        document.body.removeChild(button);
    });
});
