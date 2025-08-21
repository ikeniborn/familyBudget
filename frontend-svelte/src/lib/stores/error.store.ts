import { writable } from 'svelte/store';

export interface AppError {
  id: string;
  message: string;
  details?: string;
  timestamp: Date;
  stack?: string;
}

function createErrorStore() {
  const { subscribe, set, update } = writable<AppError | null>(null);

  return {
    subscribe,
    
    setError(error: Error | string, details?: string) {
      const appError: AppError = {
        id: Date.now().toString(),
        message: typeof error === 'string' ? error : error.message,
        details,
        timestamp: new Date(),
        stack: typeof error === 'object' ? error.stack : undefined
      };
      
      console.error('Application error:', appError);
      set(appError);
    },
    
    clearError() {
      set(null);
    },
    
    // Handle global errors
    handleGlobalError(error: Error | string, details?: string) {
      this.setError(error, details);
    }
  };
}

export const errorStore = createErrorStore();

// Global error handler setup
if (typeof window !== 'undefined') {
  window.addEventListener('error', (event) => {
    errorStore.handleGlobalError(event.error || event.message, 'Global error');
  });

  window.addEventListener('unhandledrejection', (event) => {
    errorStore.handleGlobalError(event.reason, 'Unhandled promise rejection');
  });
}