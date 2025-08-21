import { writable } from 'svelte/store';

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

function createToastStore() {
  const { subscribe, update } = writable<ToastState>({
    toasts: []
  });

  let toastId = 0;

  function addToast(toast: Omit<Toast, 'id'>) {
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
  }

  function removeToast(id: string) {
    update(state => ({
      toasts: state.toasts.filter(t => t.id !== id)
    }));
  }

  return {
    subscribe,
    
    success(title: string, message?: string, duration?: number) {
      return addToast({ type: 'success', title, message, duration });
    },

    error(title: string, message?: string, duration?: number) {
      return addToast({ type: 'error', title, message, duration });
    },

    warning(title: string, message?: string, duration?: number) {
      return addToast({ type: 'warning', title, message, duration });
    },

    info(title: string, message?: string, duration?: number) {
      return addToast({ type: 'info', title, message, duration });
    },

    show(toast: Omit<Toast, 'id'>) {
      return addToast(toast);
    },

    remove(id: string) {
      removeToast(id);
    },

    clear() {
      update(() => ({ toasts: [] }));
    }
  };
}

export const toastStore = createToastStore();