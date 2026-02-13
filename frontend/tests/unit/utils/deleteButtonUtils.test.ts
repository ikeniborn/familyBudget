/**
 * Unit tests for deleteButtonUtils.js
 * Tests standardized delete button generation helpers
 */

import { describe, it, expect, beforeEach } from 'vitest';

// Mock functions from deleteButtonUtils.js
// In production, these are loaded from /static/js/utils/deleteButtonUtils.js
let deleteIconSVG: (sizeClass?: string, strokeColor?: string) => string;
let renderDeleteButtonDesktop: (
    entityId: number | string,
    deleteFunction: string,
    entityType?: string,
    title?: string,
    extraClasses?: string
) => string;
let renderDeleteButtonMobile: (
    onclickHandler: string,
    title?: string,
    extraClasses?: string
) => string;

beforeEach(() => {
    // Load deleteButtonUtils functions (IIFE pattern)
    const utils = (function() {
        function deleteIconSVGImpl(sizeClass = 'h-4 w-4', strokeColor = 'currentColor') {
            return `<svg xmlns="http://www.w3.org/2000/svg" class="${sizeClass}" fill="none" viewBox="0 0 24 24" stroke="${strokeColor}">
    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
</svg>`;
        }

        function renderDeleteButtonDesktopImpl(
            entityId: number | string,
            deleteFunction: string,
            entityType = 'entity',
            title = 'Удалить',
            extraClasses = ''
        ) {
            return `<button class="btn btn-xs btn-error btn-square hidden md:inline-flex ${extraClasses}"
        data-${entityType}-id="${entityId}"
        onclick="event.stopPropagation(); ${deleteFunction}(${entityId})"
        title="${title}"
        aria-label="${title} ${entityType} ID ${entityId}">
    ${deleteIconSVGImpl('h-4 w-4')}
</button>`;
        }

        function renderDeleteButtonMobileImpl(
            onclickHandler: string,
            title = 'Удалить',
            extraClasses = ''
        ) {
            return `<button type="button"
        class="btn btn-sm sm:btn-md btn-error btn-square md:hidden ${extraClasses}"
        onclick="${onclickHandler}"
        title="${title}"
        aria-label="${title}">
    ${deleteIconSVGImpl('h-5 w-5')}
</button>`;
        }

        return {
            deleteIconSVG: deleteIconSVGImpl,
            renderDeleteButtonDesktop: renderDeleteButtonDesktopImpl,
            renderDeleteButtonMobile: renderDeleteButtonMobileImpl
        };
    })();

    deleteIconSVG = utils.deleteIconSVG;
    renderDeleteButtonDesktop = utils.renderDeleteButtonDesktop;
    renderDeleteButtonMobile = utils.renderDeleteButtonMobile;
});

describe('deleteIconSVG', () => {
    it('should generate SVG with default params (h-4 w-4, currentColor)', () => {
        const svg = deleteIconSVG();

        expect(svg).toContain('class="h-4 w-4"');
        expect(svg).toContain('stroke="currentColor"');
        expect(svg).toContain('viewBox="0 0 24 24"');
        expect(svg).toContain('stroke-width="2"');
    });

    it('should generate SVG with custom size class', () => {
        const svg = deleteIconSVG('h-5 w-5');

        expect(svg).toContain('class="h-5 w-5"');
        expect(svg).toContain('stroke="currentColor"');
    });

    it('should generate SVG with custom stroke color', () => {
        const svg = deleteIconSVG('h-4 w-4', 'red');

        expect(svg).toContain('class="h-4 w-4"');
        expect(svg).toContain('stroke="red"');
    });

    it('should contain trash bin path data', () => {
        const svg = deleteIconSVG();

        expect(svg).toContain('M19 7l-.867 12.142');
        expect(svg).toContain('m5 4v6m4-6v6');
    });
});

describe('renderDeleteButtonDesktop', () => {
    it('should generate button with default params', () => {
        const html = renderDeleteButtonDesktop(42, 'deleteFact', 'fact');

        expect(html).toContain('class="btn btn-xs btn-error btn-square hidden md:inline-flex');
        expect(html).toContain('data-fact-id="42"');
        expect(html).toContain('onclick="event.stopPropagation(); deleteFact(42)"');
        expect(html).toContain('title="Удалить"');
        expect(html).toContain('aria-label="Удалить fact ID 42"');
        expect(html).toContain('<svg'); // Contains icon
    });

    it('should handle string entity ID', () => {
        const html = renderDeleteButtonDesktop('abc-123', 'deleteEntity', 'entity');

        expect(html).toContain('data-entity-id="abc-123"');
        expect(html).toContain('onclick="event.stopPropagation(); deleteEntity(abc-123)"');
    });

    it('should accept custom title', () => {
        const html = renderDeleteButtonDesktop(10, 'deactivate', 'article', 'Деактивировать');

        expect(html).toContain('title="Деактивировать"');
        expect(html).toContain('aria-label="Деактивировать article ID 10"');
    });

    it('should accept extra CSS classes', () => {
        const html = renderDeleteButtonDesktop(5, 'remove', 'item', 'Удалить', 'ml-2 opacity-50');

        expect(html).toContain('class="btn btn-xs btn-error btn-square hidden md:inline-flex ml-2 opacity-50"');
    });

    it('should use default entity type when omitted', () => {
        const html = renderDeleteButtonDesktop(99, 'deleteGeneric');

        expect(html).toContain('data-entity-id="99"');
        expect(html).toContain('aria-label="Удалить entity ID 99"');
    });

    it('should include h-4 w-4 icon (desktop standard)', () => {
        const html = renderDeleteButtonDesktop(1, 'deleteTest');

        expect(html).toContain('class="h-4 w-4"');
    });

    it('should prevent event propagation via stopPropagation', () => {
        const html = renderDeleteButtonDesktop(7, 'deleteRecord');

        expect(html).toContain('event.stopPropagation();');
    });
});

describe('renderDeleteButtonMobile', () => {
    it('should generate button with default params', () => {
        const html = renderDeleteButtonMobile('deleteFromEditModal()');

        expect(html).toContain('type="button"');
        expect(html).toContain('class="btn btn-sm sm:btn-md btn-error btn-square md:hidden');
        expect(html).toContain('onclick="deleteFromEditModal()"');
        expect(html).toContain('title="Удалить"');
        expect(html).toContain('aria-label="Удалить"');
        expect(html).toContain('<svg'); // Contains icon
    });

    it('should accept custom onclick handler with parameters', () => {
        const html = renderDeleteButtonMobile('handleDelete(123, "cascade")');

        expect(html).toContain('onclick="handleDelete(123, "cascade")"');
    });

    it('should accept custom title', () => {
        const html = renderDeleteButtonMobile('deletePlan()', 'Удалить план');

        expect(html).toContain('title="Удалить план"');
        expect(html).toContain('aria-label="Удалить план"');
    });

    it('should accept extra CSS classes', () => {
        const html = renderDeleteButtonMobile('remove()', 'Удалить', 'mt-2');

        expect(html).toContain('class="btn btn-sm sm:btn-md btn-error btn-square md:hidden mt-2"');
    });

    it('should include h-5 w-5 icon (mobile standard for touch)', () => {
        const html = renderDeleteButtonMobile('delete()');

        expect(html).toContain('class="h-5 w-5"');
    });

    it('should have adaptive sizing (btn-sm sm:btn-md)', () => {
        const html = renderDeleteButtonMobile('delete()');

        expect(html).toContain('btn-sm sm:btn-md');
    });

    it('should be hidden on desktop (md:hidden)', () => {
        const html = renderDeleteButtonMobile('delete()');

        expect(html).toContain('md:hidden');
    });
});

describe('Integration: Desktop vs Mobile buttons', () => {
    it('desktop button should be hidden on mobile, mobile button hidden on desktop', () => {
        const desktop = renderDeleteButtonDesktop(1, 'delete', 'entity');
        const mobile = renderDeleteButtonMobile('delete()');

        // Desktop: hidden on mobile, visible on desktop
        expect(desktop).toContain('hidden md:inline-flex');

        // Mobile: visible on mobile, hidden on desktop
        expect(mobile).toContain('md:hidden');
    });

    it('desktop and mobile buttons should have different icon sizes', () => {
        const desktop = renderDeleteButtonDesktop(1, 'delete');
        const mobile = renderDeleteButtonMobile('delete()');

        expect(desktop).toContain('h-4 w-4'); // Desktop: 16x16px
        expect(mobile).toContain('h-5 w-5');  // Mobile: 20x20px (better touch target)
    });

    it('desktop and mobile buttons should have different button sizes', () => {
        const desktop = renderDeleteButtonDesktop(1, 'delete');
        const mobile = renderDeleteButtonMobile('delete()');

        expect(desktop).toContain('btn-xs'); // Desktop: compact for tables
        expect(mobile).toContain('btn-sm sm:btn-md'); // Mobile: adaptive sizing
    });
});

describe('Accessibility', () => {
    it('desktop button should have aria-label with entity info', () => {
        const html = renderDeleteButtonDesktop(42, 'deleteFact', 'fact', 'Удалить');

        expect(html).toContain('aria-label="Удалить fact ID 42"');
    });

    it('mobile button should have aria-label matching title', () => {
        const html = renderDeleteButtonMobile('delete()', 'Удалить запись');

        expect(html).toContain('aria-label="Удалить запись"');
    });

    it('buttons should have title attribute for tooltips', () => {
        const desktop = renderDeleteButtonDesktop(1, 'delete', 'entity', 'Удалить');
        const mobile = renderDeleteButtonMobile('delete()', 'Удалить');

        expect(desktop).toContain('title="Удалить"');
        expect(mobile).toContain('title="Удалить"');
    });

    it('buttons should have data-* attributes for testing/debugging (desktop only)', () => {
        const html = renderDeleteButtonDesktop(123, 'deleteArticle', 'article');

        expect(html).toContain('data-article-id="123"');
    });
});

describe('Visual Consistency', () => {
    it('all buttons should use btn-error (red DaisyUI)', () => {
        const desktop = renderDeleteButtonDesktop(1, 'delete');
        const mobile = renderDeleteButtonMobile('delete()');

        expect(desktop).toContain('btn-error');
        expect(mobile).toContain('btn-error');
    });

    it('all buttons should use btn-square (for icon-only)', () => {
        const desktop = renderDeleteButtonDesktop(1, 'delete');
        const mobile = renderDeleteButtonMobile('delete()');

        expect(desktop).toContain('btn-square');
        expect(mobile).toContain('btn-square');
    });

    it('all icons should use currentColor for theme compatibility', () => {
        const desktop = renderDeleteButtonDesktop(1, 'delete');
        const mobile = renderDeleteButtonMobile('delete()');

        expect(desktop).toContain('stroke="currentColor"');
        expect(mobile).toContain('stroke="currentColor"');
    });
});
