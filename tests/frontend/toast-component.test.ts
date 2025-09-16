import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import { tick } from 'svelte';
import Toast from '$lib/components/common/Toast.svelte';
import type { ToastType } from '$lib/stores/toast.store';

// Mock Lucide icons
vi.mock('lucide-svelte', () => ({
  X: vi.fn(() => ({ $$: {} })),
  CheckCircle: vi.fn(() => ({ $$: {} })),
  XCircle: vi.fn(() => ({ $$: {} })),
  AlertCircle: vi.fn(() => ({ $$: {} })),
  Info: vi.fn(() => ({ $$: {} }))
}));

describe('Toast Component', () => {
  let mockOnClose: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockOnClose = vi.fn();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  describe('Basic Rendering', () => {
    it('should render success toast correctly', () => {
      render(Toast, {
        props: {
          id: 'test-toast-1',
          type: 'success' as ToastType,
          title: 'Success Title',
          message: 'Success message',
          onClose: mockOnClose
        }
      });

      expect(screen.getByText('Success Title')).toBeInTheDocument();
      expect(screen.getByText('Success message')).toBeInTheDocument();
    });

    it('should render error toast correctly', () => {
      render(Toast, {
        props: {
          id: 'test-toast-2',
          type: 'error' as ToastType,
          title: 'Error Title',
          message: 'Error message',
          onClose: mockOnClose
        }
      });

      expect(screen.getByText('Error Title')).toBeInTheDocument();
      expect(screen.getByText('Error message')).toBeInTheDocument();
    });

    it('should render warning toast correctly', () => {
      render(Toast, {
        props: {
          id: 'test-toast-3',
          type: 'warning' as ToastType,
          title: 'Warning Title',
          message: 'Warning message',
          onClose: mockOnClose
        }
      });

      expect(screen.getByText('Warning Title')).toBeInTheDocument();
      expect(screen.getByText('Warning message')).toBeInTheDocument();
    });

    it('should render info toast correctly', () => {
      render(Toast, {
        props: {
          id: 'test-toast-4',
          type: 'info' as ToastType,
          title: 'Info Title',
          message: 'Info message',
          onClose: mockOnClose
        }
      });

      expect(screen.getByText('Info Title')).toBeInTheDocument();
      expect(screen.getByText('Info message')).toBeInTheDocument();
    });

    it('should render toast without message', () => {
      render(Toast, {
        props: {
          id: 'test-toast-5',
          type: 'success' as ToastType,
          title: 'Title Only',
          onClose: mockOnClose
        }
      });

      expect(screen.getByText('Title Only')).toBeInTheDocument();
      // Message should not be present
      expect(screen.queryByText('message')).not.toBeInTheDocument();
    });
  });

  describe('Styling and Visual Elements', () => {
    it('should apply correct CSS classes for success toast', () => {
      const { container } = render(Toast, {
        props: {
          id: 'test-toast-success',
          type: 'success' as ToastType,
          title: 'Success',
          onClose: mockOnClose
        }
      });

      const toastElement = container.querySelector('div');
      expect(toastElement).toHaveClass('bg-green-50');
    });

    it('should apply correct CSS classes for error toast', () => {
      const { container } = render(Toast, {
        props: {
          id: 'test-toast-error',
          type: 'error' as ToastType,
          title: 'Error',
          onClose: mockOnClose
        }
      });

      const toastElement = container.querySelector('div');
      expect(toastElement).toHaveClass('bg-red-50');
    });

    it('should apply correct CSS classes for warning toast', () => {
      const { container } = render(Toast, {
        props: {
          id: 'test-toast-warning',
          type: 'warning' as ToastType,
          title: 'Warning',
          onClose: mockOnClose
        }
      });

      const toastElement = container.querySelector('div');
      expect(toastElement).toHaveClass('bg-yellow-50');
    });

    it('should apply correct CSS classes for info toast', () => {
      const { container } = render(Toast, {
        props: {
          id: 'test-toast-info',
          type: 'info' as ToastType,
          title: 'Info',
          onClose: mockOnClose
        }
      });

      const toastElement = container.querySelector('div');
      expect(toastElement).toHaveClass('bg-blue-50');
    });

    it('should have consistent sizing without expansion', () => {
      const { container } = render(Toast, {
        props: {
          id: 'test-toast-sizing',
          type: 'success' as ToastType,
          title: 'Test sizing',
          message: 'This is a longer message to test sizing',
          onClose: mockOnClose
        }
      });

      const toastElement = container.querySelector('div');
      expect(toastElement).toHaveClass('sm:max-w-md');
      expect(toastElement).toHaveClass('w-full');

      // Should not have expansion-related classes
      expect(toastElement).not.toHaveClass('expandable');
      expect(toastElement).not.toHaveClass('collapsed');
      expect(toastElement).not.toHaveClass('expanded');
    });

    it('should have responsive design classes', () => {
      const { container } = render(Toast, {
        props: {
          id: 'test-toast-responsive',
          type: 'info' as ToastType,
          title: 'Responsive test',
          onClose: mockOnClose
        }
      });

      const toastElement = container.querySelector('div');
      expect(toastElement).toHaveClass('sm:max-w-md');
      expect(toastElement).toHaveClass('w-full');
    });
  });

  describe('Close Functionality', () => {
    it('should call onClose when close button is clicked', async () => {
      render(Toast, {
        props: {
          id: 'test-close-1',
          type: 'success' as ToastType,
          title: 'Close Test',
          onClose: mockOnClose
        }
      });

      const closeButton = screen.getByRole('button');
      await fireEvent.click(closeButton);

      expect(mockOnClose).toHaveBeenCalledWith('test-close-1');
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('should have accessible close button', () => {
      render(Toast, {
        props: {
          id: 'test-accessibility',
          type: 'error' as ToastType,
          title: 'Accessibility Test',
          onClose: mockOnClose
        }
      });

      const closeButton = screen.getByRole('button');
      expect(closeButton).toHaveAttribute('type', 'button');
      expect(closeButton).toHaveClass('focus:outline-none');
      expect(closeButton).toHaveClass('focus:ring-2');

      // Check for screen reader text
      expect(screen.getByText('Закрыть')).toBeInTheDocument();
    });
  });

  describe('Auto-dismiss Functionality', () => {
    it('should auto-dismiss after default duration (5000ms)', async () => {
      render(Toast, {
        props: {
          id: 'test-auto-dismiss-1',
          type: 'success' as ToastType,
          title: 'Auto Dismiss Test',
          onClose: mockOnClose
        }
      });

      // Should not be called immediately
      expect(mockOnClose).not.toHaveBeenCalled();

      // Fast forward 5000ms
      vi.advanceTimersByTime(5000);
      await tick();

      expect(mockOnClose).toHaveBeenCalledWith('test-auto-dismiss-1');
    });

    it('should auto-dismiss after custom duration', async () => {
      render(Toast, {
        props: {
          id: 'test-auto-dismiss-2',
          type: 'warning' as ToastType,
          title: 'Custom Duration Test',
          duration: 3000,
          onClose: mockOnClose
        }
      });

      // Should not be called before duration
      vi.advanceTimersByTime(2999);
      await tick();
      expect(mockOnClose).not.toHaveBeenCalled();

      // Should be called after duration
      vi.advanceTimersByTime(1);
      await tick();
      expect(mockOnClose).toHaveBeenCalledWith('test-auto-dismiss-2');
    });

    it('should not auto-dismiss when duration is 0', async () => {
      render(Toast, {
        props: {
          id: 'test-no-auto-dismiss',
          type: 'error' as ToastType,
          title: 'No Auto Dismiss Test',
          duration: 0,
          onClose: mockOnClose
        }
      });

      // Fast forward way past normal duration
      vi.advanceTimersByTime(10000);
      await tick();

      expect(mockOnClose).not.toHaveBeenCalled();
    });

    it('should not auto-dismiss when duration is negative', async () => {
      render(Toast, {
        props: {
          id: 'test-negative-duration',
          type: 'info' as ToastType,
          title: 'Negative Duration Test',
          duration: -1000,
          onClose: mockOnClose
        }
      });

      vi.advanceTimersByTime(5000);
      await tick();

      expect(mockOnClose).not.toHaveBeenCalled();
    });
  });

  describe('Props Validation', () => {
    it('should handle all required props correctly', () => {
      const { component } = render(Toast, {
        props: {
          id: 'test-props',
          type: 'success' as ToastType,
          title: 'Props Test',
          onClose: mockOnClose
        }
      });

      expect(component).toBeTruthy();
      expect(screen.getByText('Props Test')).toBeInTheDocument();
    });

    it('should handle optional props correctly', () => {
      const { component } = render(Toast, {
        props: {
          id: 'test-optional-props',
          type: 'info' as ToastType,
          title: 'Optional Props Test',
          message: 'Optional message',
          duration: 2000,
          onClose: mockOnClose
        }
      });

      expect(component).toBeTruthy();
      expect(screen.getByText('Optional Props Test')).toBeInTheDocument();
      expect(screen.getByText('Optional message')).toBeInTheDocument();
    });

    it('should handle undefined message prop', () => {
      const { component } = render(Toast, {
        props: {
          id: 'test-undefined-message',
          type: 'warning' as ToastType,
          title: 'Undefined Message Test',
          message: undefined,
          onClose: mockOnClose
        }
      });

      expect(component).toBeTruthy();
      expect(screen.getByText('Undefined Message Test')).toBeInTheDocument();
    });
  });

  describe('Transitions and Animations', () => {
    it('should have hover effects', () => {
      const { container } = render(Toast, {
        props: {
          id: 'test-hover',
          type: 'success' as ToastType,
          title: 'Hover Test',
          onClose: mockOnClose
        }
      });

      const toastElement = container.querySelector('div');
      expect(toastElement).toHaveClass('hover:scale-105');
      expect(toastElement).toHaveClass('hover:shadow-xl');
    });

    it('should have transition classes', () => {
      const { container } = render(Toast, {
        props: {
          id: 'test-transitions',
          type: 'error' as ToastType,
          title: 'Transition Test',
          onClose: mockOnClose
        }
      });

      const toastElement = container.querySelector('div');
      expect(toastElement).toHaveClass('transform');
      expect(toastElement).toHaveClass('transition-all');
      expect(toastElement).toHaveClass('duration-300');
      expect(toastElement).toHaveClass('ease-in-out');
    });
  });

  describe('Edge Cases', () => {
    it('should handle very long titles', () => {
      const longTitle = 'This is a very long title that might cause layout issues if not handled properly by the toast component';

      render(Toast, {
        props: {
          id: 'test-long-title',
          type: 'info' as ToastType,
          title: longTitle,
          onClose: mockOnClose
        }
      });

      expect(screen.getByText(longTitle)).toBeInTheDocument();
    });

    it('should handle very long messages', () => {
      const longMessage = 'This is a very long message that might cause layout issues if not handled properly by the toast component. It should wrap nicely and not break the layout.';

      render(Toast, {
        props: {
          id: 'test-long-message',
          type: 'warning' as ToastType,
          title: 'Long Message Test',
          message: longMessage,
          onClose: mockOnClose
        }
      });

      expect(screen.getByText(longMessage)).toBeInTheDocument();
    });

    it('should handle empty title gracefully', () => {
      render(Toast, {
        props: {
          id: 'test-empty-title',
          type: 'error' as ToastType,
          title: '',
          onClose: mockOnClose
        }
      });

      // Component should still render without crashing
      const closeButton = screen.getByRole('button');
      expect(closeButton).toBeInTheDocument();
    });

    it('should handle special characters in content', () => {
      const specialTitle = 'Title with <>&"\'';
      const specialMessage = 'Message with <script>alert("test")</script> and other special chars: !@#$%^&*()';

      render(Toast, {
        props: {
          id: 'test-special-chars',
          type: 'success' as ToastType,
          title: specialTitle,
          message: specialMessage,
          onClose: mockOnClose
        }
      });

      expect(screen.getByText(specialTitle)).toBeInTheDocument();
      expect(screen.getByText(specialMessage)).toBeInTheDocument();
    });
  });

  describe('Cleanup', () => {
    it('should cleanup timer on component destruction', async () => {
      const { unmount } = render(Toast, {
        props: {
          id: 'test-cleanup',
          type: 'success' as ToastType,
          title: 'Cleanup Test',
          duration: 5000,
          onClose: mockOnClose
        }
      });

      // Unmount before timer expires
      unmount();

      // Fast forward past the timer
      vi.advanceTimersByTime(6000);
      await tick();

      // onClose should not be called after unmount
      expect(mockOnClose).not.toHaveBeenCalled();
    });

    it('should handle multiple mounts and unmounts', async () => {
      const { unmount: unmount1 } = render(Toast, {
        props: {
          id: 'test-multi-1',
          type: 'success' as ToastType,
          title: 'Multi Test 1',
          duration: 1000,
          onClose: mockOnClose
        }
      });

      const { unmount: unmount2 } = render(Toast, {
        props: {
          id: 'test-multi-2',
          type: 'error' as ToastType,
          title: 'Multi Test 2',
          duration: 2000,
          onClose: mockOnClose
        }
      });

      unmount1();
      unmount2();

      vi.advanceTimersByTime(3000);
      await tick();

      expect(mockOnClose).not.toHaveBeenCalled();
    });
  });
});