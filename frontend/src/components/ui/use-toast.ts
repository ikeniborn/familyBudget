import { useToastStore } from '../common/ToastContainer';

// Singleton toast function that can be used outside of components
export const toast = ({ title, description, variant }: {
  title: string;
  description?: string;
  variant?: 'default' | 'destructive';
}) => {
  const addToast = useToastStore.getState().addToast;
  
  if (variant === 'destructive') {
    addToast({ type: 'error', title, message: description });
  } else {
    addToast({ type: 'info', title, message: description });
  }
};

// Add helper methods
toast.success = (title: string, description?: string) => {
  const addToast = useToastStore.getState().addToast;
  addToast({ type: 'success', title, message: description });
};

toast.error = (title: string, description?: string) => {
  const addToast = useToastStore.getState().addToast;
  addToast({ type: 'error', title, message: description });
};

toast.warning = (title: string, description?: string) => {
  const addToast = useToastStore.getState().addToast;
  addToast({ type: 'warning', title, message: description });
};

toast.info = (title: string, description?: string) => {
  const addToast = useToastStore.getState().addToast;
  addToast({ type: 'info', title, message: description });
};

// Also export the hook for components that need it
export { useToast } from '../common/ToastContainer';