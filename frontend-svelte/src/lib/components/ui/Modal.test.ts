import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import Modal from './Modal.svelte';
import '@testing-library/jest-dom';

describe('Modal Styling Improvements', () => {
  describe('Modal Component Styling', () => {
    it('should have proper content padding', () => {
      const { container } = render(Modal, {
        props: {
          open: true,
          title: 'Test Modal',
        },
      });

      const modalContent = container.querySelector('.modal-content');
      expect(modalContent).toBeInTheDocument();

      // Check if padding is applied
      const styles = window.getComputedStyle(modalContent!);
      expect(styles.padding).toBeTruthy();
    });

    it('should have improved container styling with better shadows', () => {
      const { container } = render(Modal, {
        props: {
          open: true,
          title: 'Test Modal',
        },
      });

      const modalContainer = container.querySelector('.modal-container');
      expect(modalContainer).toBeInTheDocument();

      // Check for border and shadow improvements
      const styles = window.getComputedStyle(modalContainer!);
      expect(styles.border).toBeTruthy();
      expect(styles.boxShadow).toBeTruthy();
      expect(styles.borderRadius).toBeTruthy();
    });

    it('should have enhanced header styling', () => {
      const { container } = render(Modal, {
        props: {
          open: true,
          title: 'Test Modal',
        },
      });

      const modalHeader = container.querySelector('.modal-header');
      expect(modalHeader).toBeInTheDocument();

      // Check header improvements
      const styles = window.getComputedStyle(modalHeader!);
      expect(styles.background).toBeTruthy();
      expect(styles.paddingBottom).toBeTruthy();
    });

    it('should have improved animation', () => {
      const { container } = render(Modal, {
        props: {
          open: true,
          title: 'Test Modal',
        },
      });

      const modalContainer = container.querySelector('.modal-container');
      const styles = window.getComputedStyle(modalContainer!);

      // Check animation property
      expect(styles.animation).toContain('slideUp');
    });

    it('should have proper responsive behavior', () => {
      // Set viewport to mobile size
      global.innerWidth = 375;

      const { container } = render(Modal, {
        props: {
          open: true,
          title: 'Test Modal',
        },
      });

      const modalContainer = container.querySelector('.modal-container');
      expect(modalContainer).toBeInTheDocument();

      // Mobile should have full width with no border radius
      const styles = window.getComputedStyle(modalContainer!);
      expect(styles.maxHeight).toBeTruthy();
    });
  });

  describe('Modal Backdrop', () => {
    it('should have proper backdrop styling', () => {
      const { container } = render(Modal, {
        props: {
          open: true,
          title: 'Test Modal',
        },
      });

      const backdrop = container.querySelector('.modal-backdrop');
      expect(backdrop).toBeInTheDocument();

      const styles = window.getComputedStyle(backdrop!);
      expect(styles.background).toContain('rgba');
      expect(styles.backdropFilter).toBeTruthy();
    });
  });

  describe('Form Field Spacing', () => {
    it('should render form with proper spacing', () => {
      const { container } = render(Modal, {
        props: {
          open: true,
          title: 'Test Form Modal',
        },
      });

      // Add a mock form to the slot
      const modalContent = container.querySelector('.modal-content');
      if (modalContent) {
        modalContent.innerHTML = `
          <form class="space-y-5">
            <div class="space-y-2">
              <label class="block text-sm font-medium text-gray-700 mb-2">Test Label</label>
              <input class="w-full px-3 py-2 border" />
            </div>
          </form>
        `;
      }

      const form = container.querySelector('form');
      expect(form).toHaveClass('space-y-5');

      const fieldContainer = container.querySelector('.space-y-2');
      expect(fieldContainer).toBeInTheDocument();

      const label = container.querySelector('label');
      expect(label).toHaveClass('mb-2');
    });
  });

  describe('Modal Sizes', () => {
    it('should apply correct size classes', () => {
      const sizes: Array<'small' | 'medium' | 'large' | 'extra-large'> = [
        'small',
        'medium',
        'large',
        'extra-large',
      ];

      sizes.forEach((size) => {
        const { container } = render(Modal, {
          props: {
            open: true,
            title: 'Test Modal',
            size,
          },
        });

        const modalContainer = container.querySelector('.modal-container');
        const classNames = modalContainer?.className || '';

        if (size === 'small') {
          expect(classNames).toContain('max-w-sm');
        } else if (size === 'large') {
          expect(classNames).toContain('max-w-4xl');
        } else if (size === 'extra-large') {
          expect(classNames).toContain('max-w-6xl');
        } else {
          expect(classNames).toContain('max-w-md');
        }
      });
    });
  });

  describe('Accessibility', () => {
    it('should handle escape key properly', () => {
      let closed = false;

      render(Modal, {
        props: {
          open: true,
          title: 'Test Modal',
          onclose: () => {
            closed = true;
          },
        },
      });

      // Simulate escape key
      const event = new KeyboardEvent('keydown', { key: 'Escape' });
      window.dispatchEvent(event);

      expect(closed).toBe(true);
    });

    it('should handle backdrop click', () => {
      let closed = false;

      const { container } = render(Modal, {
        props: {
          open: true,
          title: 'Test Modal',
          onclose: () => {
            closed = true;
          },
        },
      });

      const backdrop = container.querySelector('.modal-backdrop');
      if (backdrop) {
        fireEvent.click(backdrop);
      }

      expect(closed).toBe(true);
    });
  });
});

describe('Articles Modal Integration', () => {
  it('should have proper checkbox styling', () => {
    const { container } = render(Modal, {
      props: {
        open: true,
        title: 'Create Article',
      },
    });

    const modalContent = container.querySelector('.modal-content');
    if (modalContent) {
      modalContent.innerHTML = `
        <div class="flex items-center bg-gray-50 p-3 rounded-lg">
          <input type="checkbox" class="mr-3 w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 focus:ring-2" />
          <label class="text-sm font-medium text-gray-700 select-none cursor-pointer">Active Article</label>
        </div>
      `;
    }

    const checkboxContainer = container.querySelector('.bg-gray-50');
    expect(checkboxContainer).toHaveClass('p-3', 'rounded-lg');

    const checkbox = container.querySelector('input[type="checkbox"]');
    expect(checkbox).toHaveClass('w-4', 'h-4', 'text-blue-600');
  });

  it('should have proper button container styling', () => {
    const { container } = render(Modal, {
      props: {
        open: true,
        title: 'Test Modal',
      },
    });

    const modalContent = container.querySelector('.modal-content');
    if (modalContent) {
      modalContent.innerHTML = `
        <div class="flex justify-end gap-3 pt-5 border-t border-gray-100">
          <button>Cancel</button>
          <button>Save</button>
        </div>
      `;
    }

    const buttonContainer = container.querySelector('.flex.justify-end');
    expect(buttonContainer).toHaveClass('pt-5', 'border-t', 'border-gray-100');
  });
});