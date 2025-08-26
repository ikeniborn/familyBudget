import { writable, derived, type Writable } from 'svelte/store';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
}

interface ToastState {
  toasts: Toast[];
}

// Create main store
const createToastStore = () => {
  const { subscribe, set, update } = writable<ToastState>({ toasts: [] });
  let toastId = 0;

  // Toast management methods
  const addToast = (toast: Omit<Toast, 'id'>): string => {
    const id = `toast-${++toastId}`;
    const duration = toast.duration ?? 5000;
    
    update(state => ({
      toasts: [...state.toasts, { ...toast, id }]
    }));

    if (duration > 0) {
      setTimeout(() => {
        removeToast(id);
      }, duration);
    }

    return id;
  };

  const removeToast = (id: string): void => {
    update(state => ({
      toasts: state.toasts.filter(t => t.id !== id)
    }));
  };

  return {
    subscribe,
    // Public API methods
    success: (title: string, message?: string, duration?: number): string =>
      addToast({ type: 'success', title, message, duration }),
    
    error: (title: string, message?: string, duration?: number): string =>
      addToast({ type: 'error', title, message, duration }),
    
    warning: (title: string, message?: string, duration?: number): string =>
      addToast({ type: 'warning', title, message, duration }),
    
    info: (title: string, message?: string, duration?: number): string =>
      addToast({ type: 'info', title, message, duration }),
    
    show: (toast: Omit<Toast, 'id'>): string =>
      addToast(toast),
    
    remove: (id: string): void =>
      removeToast(id),
    
    clear: (): void =>
      set({ toasts: [] })
  };
};

// Create singleton instance
export const toastStore = createToastStore();

// Export individual reactive values as store-compatible objects for convenience
export const toasts = derived(
  toastStore,
  ($toastStore) => $toastStore.toasts
);

// Hook-style function for easier use in components
export function useToast() {
  return {
    success: (title: string, message?: string, duration?: number) => toastStore.success(title, message, duration),
    error: (title: string, message?: string, duration?: number) => toastStore.error(title, message, duration),
    warning: (title: string, message?: string, duration?: number) => toastStore.warning(title, message, duration),
    info: (title: string, message?: string, duration?: number) => toastStore.info(title, message, duration),
    show: (toast: Omit<Toast, 'id'>) => toastStore.show(toast),
    remove: (id: string) => toastStore.remove(id),
    clear: () => toastStore.clear()
  };
}

// Legacy exports for backward compatibility with existing components
export { toastStore as default };

// Export the store instance with legacy methods for gradual migration
export const toastStoreCompat = toastStore;