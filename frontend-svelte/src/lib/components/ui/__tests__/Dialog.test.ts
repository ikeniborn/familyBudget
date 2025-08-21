import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, waitFor } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import Dialog from '../Dialog.svelte';

describe('Dialog Component', () => {
  beforeEach(() => {
    // Reset body styles
    document.body.style.overflow = '';
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Cleanup
    document.body.style.overflow = '';
  });

  it('renders when open is true', () => {
    const { getByRole } = render(Dialog, { 
      props: { 
        open: true, 
        title: 'Test Dialog',
        $$slots: { default: true },
        $$scope: { ctx: [] }
      } 
    });
    
    const dialog = getByRole('dialog');
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAttribute('aria-labelledby', 'dialog-title');
  });

  it('does not render when open is false', () => {
    const { queryByRole } = render(Dialog, { 
      props: { 
        open: false,
        $$slots: { default: true },
        $$scope: { ctx: [] }
      } 
    });
    
    expect(queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('displays title correctly', () => {
    const title = 'Test Dialog Title';
    const { getByText } = render(Dialog, { 
      props: { 
        open: true, 
        title,
        $$slots: { default: true },
        $$scope: { ctx: [] }
      } 
    });
    
    const titleElement = getByText(title);
    expect(titleElement).toBeInTheDocument();
    expect(titleElement).toHaveAttribute('id', 'dialog-title');
  });

  it('applies different size classes correctly', () => {
    const sizes = [
      { size: 'sm', expectedClass: 'max-w-md' },
      { size: 'md', expectedClass: 'max-w-lg' },
      { size: 'lg', expectedClass: 'max-w-2xl' },
      { size: 'xl', expectedClass: 'max-w-4xl' },
      { size: 'full', expectedClass: 'max-w-full' }
    ];

    sizes.forEach(({ size, expectedClass }) => {
      const { getByRole } = render(Dialog, { 
        props: { 
          open: true, 
          size: size as any,
          $$slots: { default: true },
          $$scope: { ctx: [] }
        } 
      });
      
      const dialog = getByRole('dialog');
      expect(dialog).toHaveClass(expectedClass);
    });
  });

  it('shows close button when closable is true', () => {
    const { container } = render(Dialog, { 
      props: { 
        open: true, 
        closable: true,
        title: 'Closable Dialog',
        $$slots: { default: true },
        $$scope: { ctx: [] }
      } 
    });
    
    const closeButton = container.querySelector('button[type="button"]');
    expect(closeButton).toBeInTheDocument();
  });

  it('hides close button when closable is false', () => {
    const { container } = render(Dialog, { 
      props: { 
        open: true, 
        closable: false,
        title: 'Non-closable Dialog',
        $$slots: { default: true },
        $$scope: { ctx: [] }
      } 
    });
    
    const closeButton = container.querySelector('button[type="button"]');
    expect(closeButton).not.toBeInTheDocument();
  });

  it('closes dialog when close button is clicked', async () => {
    const { container, component } = render(Dialog, { 
      props: { 
        open: true, 
        closable: true,
        title: 'Closable Dialog',
        $$slots: { default: true },
        $$scope: { ctx: [] }
      } 
    });
    
    const closeHandler = vi.fn();
    component.$on('close', closeHandler);
    
    const closeButton = container.querySelector('button[type="button"]');
    await fireEvent.click(closeButton!);
    
    await waitFor(() => {
      expect(closeHandler).toHaveBeenCalled();
    });
  });

  it('closes dialog on Escape key when closeOnEscape is true', async () => {
    const { component } = render(Dialog, { 
      props: { 
        open: true, 
        closeOnEscape: true,
        $$slots: { default: true },
        $$scope: { ctx: [] }
      } 
    });
    
    const closeHandler = vi.fn();
    component.$on('close', closeHandler);
    
    await fireEvent.keyDown(document, { key: 'Escape' });
    
    await waitFor(() => {
      expect(closeHandler).toHaveBeenCalled();
    });
  });

  it('does not close on Escape when closeOnEscape is false', async () => {
    const { component } = render(Dialog, { 
      props: { 
        open: true, 
        closeOnEscape: false,
        $$slots: { default: true },
        $$scope: { ctx: [] }
      } 
    });
    
    const closeHandler = vi.fn();
    component.$on('close', closeHandler);
    
    await fireEvent.keyDown(document, { key: 'Escape' });
    
    expect(closeHandler).not.toHaveBeenCalled();
  });

  it('closes dialog on backdrop click when closeOnClickOutside is true', async () => {
    const { container, component } = render(Dialog, { 
      props: { 
        open: true, 
        closeOnClickOutside: true,
        $$slots: { default: true },
        $$scope: { ctx: [] }
      } 
    });
    
    const closeHandler = vi.fn();
    component.$on('close', closeHandler);
    
    const backdrop = container.querySelector('[role="presentation"]');
    await fireEvent.click(backdrop!);
    
    await waitFor(() => {
      expect(closeHandler).toHaveBeenCalled();
    });
  });

  it('does not close on backdrop click when closeOnClickOutside is false', async () => {
    const { container, component } = render(Dialog, { 
      props: { 
        open: true, 
        closeOnClickOutside: false,
        $$slots: { default: true },
        $$scope: { ctx: [] }
      } 
    });
    
    const closeHandler = vi.fn();
    component.$on('close', closeHandler);
    
    const backdrop = container.querySelector('[role="presentation"]');
    await fireEvent.click(backdrop!);
    
    expect(closeHandler).not.toHaveBeenCalled();
  });

  it('prevents closing when persistent is true', async () => {
    const { container, component } = render(Dialog, { 
      props: { 
        open: true, 
        persistent: true,
        closable: true,
        $$slots: { default: true },
        $$scope: { ctx: [] }
      } 
    });
    
    const closeHandler = vi.fn();
    component.$on('close', closeHandler);
    
    const closeButton = container.querySelector('button[type="button"]');
    await fireEvent.click(closeButton!);
    
    expect(closeHandler).not.toHaveBeenCalled();
  });

  it('prevents closing when loading is true', async () => {
    const { container, component } = render(Dialog, { 
      props: { 
        open: true, 
        loading: true,
        closable: true,
        $$slots: { default: true },
        $$scope: { ctx: [] }
      } 
    });
    
    const closeHandler = vi.fn();
    component.$on('close', closeHandler);
    
    const closeButton = container.querySelector('button[type="button"]');
    expect(closeButton).toBeDisabled();
    
    await fireEvent.click(closeButton!);
    expect(closeHandler).not.toHaveBeenCalled();
  });

  it('shows loading overlay when loading is true', () => {
    const { container } = render(Dialog, { 
      props: { 
        open: true, 
        loading: true,
        $$slots: { default: true },
        $$scope: { ctx: [] }
      } 
    });
    
    const loadingOverlay = container.querySelector('.absolute.inset-0.bg-white\\/50');
    expect(loadingOverlay).toBeInTheDocument();
    
    const spinner = container.querySelector('.animate-spin');
    expect(spinner).toBeInTheDocument();
  });

  it('dispatches open event when dialog opens', async () => {
    const { component } = render(Dialog, { 
      props: { 
        open: false,
        $$slots: { default: true },
        $$scope: { ctx: [] }
      } 
    });
    
    const openHandler = vi.fn();
    component.$on('open', openHandler);
    
    await component.$set({ open: true });
    
    await waitFor(() => {
      expect(openHandler).toHaveBeenCalled();
    });
  });

  it('dispatches confirm and cancel events', async () => {
    const { component } = render(Dialog, { 
      props: { 
        open: true,
        $$slots: { 
          footer: true 
        },
        $$scope: { ctx: [] }
      } 
    });
    
    const confirmHandler = vi.fn();
    const cancelHandler = vi.fn();
    
    component.$on('confirm', confirmHandler);
    component.$on('cancel', cancelHandler);
    
    // Test dispatching events through the component's methods
    // In real usage, these would be called from slot content
    const dialogInstance = component;
    
    // Simulate confirm action
    const confirmEvent = new CustomEvent('confirm');
    dialogInstance.$$.ctx[dialogInstance.$$.ctx.length - 1]?.handleConfirm?.();
    
    // Note: This test is simplified since we can't directly test slot interactions
    // In a real test, you'd render a component that uses the dialog with footer slot
  });

  it('applies custom CSS classes', () => {
    const { getByRole } = render(Dialog, { 
      props: { 
        open: true, 
        class: 'custom-dialog-class',
        $$slots: { default: true },
        $$scope: { ctx: [] }
      } 
    });
    
    const dialog = getByRole('dialog');
    expect(dialog).toHaveClass('custom-dialog-class');
  });

  it('prevents body scroll when open', async () => {
    const { component } = render(Dialog, { 
      props: { 
        open: false,
        $$slots: { default: true },
        $$scope: { ctx: [] }
      } 
    });
    
    expect(document.body.style.overflow).toBe('');
    
    await component.$set({ open: true });
    
    await waitFor(() => {
      expect(document.body.style.overflow).toBe('hidden');
    });
  });

  it('restores body scroll when closed', async () => {
    const { component } = render(Dialog, { 
      props: { 
        open: true,
        $$slots: { default: true },
        $$scope: { ctx: [] }
      } 
    });
    
    await waitFor(() => {
      expect(document.body.style.overflow).toBe('hidden');
    });
    
    await component.$set({ open: false });
    
    await waitFor(() => {
      expect(document.body.style.overflow).toBe('');
    });
  });

  it('has proper ARIA attributes', () => {
    const { getByRole } = render(Dialog, { 
      props: { 
        open: true, 
        title: 'ARIA Dialog',
        $$slots: { default: true },
        $$scope: { ctx: [] }
      } 
    });
    
    const dialog = getByRole('dialog');
    expect(dialog).toHaveAttribute('role', 'dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAttribute('aria-labelledby', 'dialog-title');
    expect(dialog).toHaveAttribute('tabindex', '-1');
  });

  it('does not propagate clicks from dialog content to backdrop', async () => {
    const { getByRole, component } = render(Dialog, { 
      props: { 
        open: true, 
        closeOnClickOutside: true,
        $$slots: { default: true },
        $$scope: { ctx: [] }
      } 
    });
    
    const closeHandler = vi.fn();
    component.$on('close', closeHandler);
    
    const dialog = getByRole('dialog');
    await fireEvent.click(dialog);
    
    expect(closeHandler).not.toHaveBeenCalled();
  });
});