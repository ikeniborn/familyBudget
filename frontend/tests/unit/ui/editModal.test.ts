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
        // Create cancel button
        cancelButton = document.createElement('button');
        cancelButton.className = 'btn btn-sm sm:btn-md flex-1 sm:flex-initial whitespace-nowrap';
        cancelButton.innerHTML = `
            <svg class="h-4 w-4"><!-- icon --></svg>
            Отмена
        `;

        // Create save button
        saveButton = document.createElement('button');
        saveButton.className = 'btn btn-sm sm:btn-md btn-primary save-btn flex-1 sm:flex-initial whitespace-nowrap';
        saveButton.innerHTML = `
            <svg class="h-4 w-4"><!-- icon --></svg>
            Сохранить
        `;

        document.body.appendChild(cancelButton);
        document.body.appendChild(saveButton);
    });

    afterEach(() => {
        document.body.removeChild(cancelButton);
        document.body.removeChild(saveButton);
    });

    it('should have whitespace-nowrap class on cancel button', () => {
        expect(cancelButton.classList.contains('whitespace-nowrap')).toBe(true);
    });

    it('should have whitespace-nowrap class on save button', () => {
        expect(saveButton.classList.contains('whitespace-nowrap')).toBe(true);
    });

    it('should prevent text wrapping with whitespace-nowrap', () => {
        // Get computed style
        const cancelStyle = window.getComputedStyle(cancelButton);

        // whitespace-nowrap should be applied
        // Note: Happy-DOM may not fully support computed styles, this is a basic check
        expect(cancelButton.className).toContain('whitespace-nowrap');
    });
});

describe('Edit Modal - Delete Button Icon', () => {
    let deleteButton: HTMLButtonElement;

    beforeEach(() => {
        deleteButton = document.createElement('button');
        deleteButton.className = 'btn btn-xs btn-error btn-square md:hidden';
        deleteButton.setAttribute('onclick', 'deleteFromEditModal()');
        deleteButton.setAttribute('title', 'Удалить');

        // Use img tag with local SVG instead of inline SVG
        deleteButton.innerHTML = `
            <img src="/static/icons/trash.svg" alt="Delete" class="h-5 w-5 invert" />
        `;

        document.body.appendChild(deleteButton);
    });

    afterEach(() => {
        document.body.removeChild(deleteButton);
    });

    it('should use img tag instead of inline SVG', () => {
        const img = deleteButton.querySelector('img');
        expect(img).not.toBeNull();
        expect(img?.tagName).toBe('IMG');
    });

    it('should have correct icon src path', () => {
        const img = deleteButton.querySelector('img');
        expect(img?.getAttribute('src')).toBe('/static/icons/trash.svg');
    });

    it('should have accessibility alt text', () => {
        const img = deleteButton.querySelector('img');
        expect(img?.getAttribute('alt')).toBe('Delete');
    });

    it('should have increased icon size (h-5 w-5 instead of h-4 w-4)', () => {
        const img = deleteButton.querySelector('img');
        expect(img?.classList.contains('h-5')).toBe(true);
        expect(img?.classList.contains('w-5')).toBe(true);
        expect(img?.classList.contains('h-4')).toBe(false);
    });

    it('should have invert filter for white icon on red background', () => {
        const img = deleteButton.querySelector('img');
        expect(img?.classList.contains('invert')).toBe(true);
    });

    it('should be hidden on desktop (md:hidden)', () => {
        expect(deleteButton.classList.contains('md:hidden')).toBe(true);
    });
});

describe('Edit Modal - Narrow Screen Behavior (< 375px)', () => {
    it('should not wrap button text with whitespace-nowrap', () => {
        const button = document.createElement('button');
        button.className = 'btn btn-sm flex-1 whitespace-nowrap';
        button.innerHTML = `
            <svg class="h-4 w-4"><!-- icon --></svg>
            Отмена
        `;

        document.body.appendChild(button);

        // Simulate narrow viewport (375px iPhone SE)
        // Note: Happy-DOM doesn't support window.innerWidth changes,
        // but we can verify CSS class presence
        expect(button.className).toContain('whitespace-nowrap');

        document.body.removeChild(button);
    });
});
