/**
 * Modal Z-Index Fix Tests
 * Tests for modal visibility and z-index values
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import Modal from '../../frontend-svelte/src/lib/components/ui/Modal.svelte';

describe('Modal Z-Index Fix', () => {
  afterEach(() => {
    document.body.style.overflow = 'auto'; // Reset overflow
  });

  it('should have high z-index values for visibility', async () => {
    const { container } = render(Modal, {
      props: {
        show: true,
        title: 'Test Modal'
      }
    });

    const backdrop = container.querySelector('.modal-backdrop');
    const modalContainer = container.querySelector('.modal-container');

    expect(backdrop).toBeInTheDocument();
    expect(modalContainer).toBeInTheDocument();

    const backdropStyles = window.getComputedStyle(backdrop!);
    const containerStyles = window.getComputedStyle(modalContainer!);

    // Check z-index values are high enough
    expect(backdropStyles.zIndex).toBe('50000');
    expect(containerStyles.zIndex).toBe('50001');
  });

  it('should render modal on top of page content', async () => {
    const { container } = render(Modal, {
      props: {
        show: true,
        title: 'Top Level Modal',
        description: 'This should be on top'
      }
    });

    const backdrop = container.querySelector('.modal-backdrop');
    const modalContainer = container.querySelector('.modal-container');

    // Verify positioning
    const backdropStyles = window.getComputedStyle(backdrop!);
    expect(backdropStyles.position).toBe('fixed');
    expect(backdropStyles.inset).toBe('0px'); // Covers entire viewport

    // Verify modal is visible
    expect(modalContainer).toBeVisible();
  });

  it('should lock body scroll when modal is open', async () => {
    const { rerender } = render(Modal, {
      props: {
        show: false,
        title: 'Test Modal'
      }
    });

    // Initially no scroll lock
    expect(document.body.style.overflow).not.toBe('hidden');

    // Open modal
    await rerender({ show: true, title: 'Test Modal' });

    // Body scroll should be locked
    expect(document.body.style.overflow).toBe('hidden');

    // Close modal
    await rerender({ show: false, title: 'Test Modal' });

    // Body scroll should be restored
    expect(document.body.style.overflow).toBe('auto');
  });

  it('should support multiple prop names for backward compatibility', async () => {
    // Test with 'show' prop
    const { container: container1, unmount: unmount1 } = render(Modal, {
      props: { show: true, title: 'Show Prop' }
    });
    expect(container1.querySelector('.modal-backdrop')).toBeInTheDocument();
    unmount1();

    // Test with 'open' prop
    const { container: container2, unmount: unmount2 } = render(Modal, {
      props: { open: true, title: 'Open Prop' }
    });
    expect(container2.querySelector('.modal-backdrop')).toBeInTheDocument();
    unmount2();

    // Test with 'isOpen' prop
    const { container: container3, unmount: unmount3 } = render(Modal, {
      props: { isOpen: true, title: 'IsOpen Prop' }
    });
    expect(container3.querySelector('.modal-backdrop')).toBeInTheDocument();
    unmount3();
  });

  it('should have proper backdrop styling', async () => {
    const { container } = render(Modal, {
      props: {
        show: true,
        title: 'Styled Modal'
      }
    });

    const backdrop = container.querySelector('.modal-backdrop');
    const backdropStyles = window.getComputedStyle(backdrop!);

    // Check backdrop is semi-transparent
    expect(backdropStyles.background).toContain('rgba');

    // Check backdrop has blur effect
    expect(backdropStyles.backdropFilter || backdropStyles.webkitBackdropFilter).toContain('blur');
  });

  it('should close on Escape key', async () => {
    let isOpen = true;
    const { container } = render(Modal, {
      props: {
        show: isOpen,
        title: 'Closeable Modal',
        onclose: () => { isOpen = false; }
      }
    });

    expect(container.querySelector('.modal-backdrop')).toBeInTheDocument();

    // Simulate Escape key press
    const event = new KeyboardEvent('keydown', { key: 'Escape' });
    window.dispatchEvent(event);

    // Modal should request close
    expect(isOpen).toBe(false);
  });

  it('should close on backdrop click', async () => {
    let isOpen = true;
    const { container } = render(Modal, {
      props: {
        show: isOpen,
        title: 'Closeable Modal',
        onclose: () => { isOpen = false; }
      }
    });

    const backdrop = container.querySelector('.modal-backdrop');
    expect(backdrop).toBeInTheDocument();

    // Click on backdrop
    await fireEvent.click(backdrop!);

    // Modal should request close
    expect(isOpen).toBe(false);
  });

  it('should have proper animation classes', async () => {
    const { container } = render(Modal, {
      props: {
        show: true,
        title: 'Animated Modal'
      }
    });

    const backdrop = container.querySelector('.modal-backdrop');
    const modalContainer = container.querySelector('.modal-container');

    const backdropStyles = window.getComputedStyle(backdrop!);
    const containerStyles = window.getComputedStyle(modalContainer!);

    // Check animations are defined
    expect(backdropStyles.animation).toContain('fadeIn');
    expect(containerStyles.animation).toContain('slideUp');
  });

  it('should ensure form elements are interactive', async () => {
    const { container } = render(Modal, {
      props: {
        show: true,
        title: 'Form Modal'
      }
    });

    const modalContent = container.querySelector('.modal-content');
    const contentStyles = window.getComputedStyle(modalContent!);

    // Verify pointer events are enabled
    expect(contentStyles.pointerEvents).toBe('auto');
  });
});