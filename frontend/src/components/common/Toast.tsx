import React, { useEffect } from 'react';
import { X, CheckCircle, XCircle, AlertCircle, Info } from 'lucide-react';
import { clsx } from 'clsx';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

interface ToastProps {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
  onClose: (id: string) => void;
}

const icons = {
  success: CheckCircle,
  error: XCircle,
  warning: AlertCircle,
  info: Info,
};

const styles = {
  success: {
    bg: 'bg-green-50',
    icon: 'text-green-400',
    title: 'text-green-800',
    message: 'text-green-700',
  },
  error: {
    bg: 'bg-red-50',
    icon: 'text-red-400',
    title: 'text-red-800',
    message: 'text-red-700',
  },
  warning: {
    bg: 'bg-yellow-50',
    icon: 'text-yellow-400',
    title: 'text-yellow-800',
    message: 'text-yellow-700',
  },
  info: {
    bg: 'bg-blue-50',
    icon: 'text-blue-400',
    title: 'text-blue-800',
    message: 'text-blue-700',
  },
};

export const Toast: React.FC<ToastProps> = ({
  id,
  type,
  title,
  message,
  duration = 5000,
  onClose,
}) => {
  const Icon = icons[type];
  const style = styles[type];

  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(() => {
        onClose(id);
      }, duration);

      return () => clearTimeout(timer);
    }
  }, [id, duration, onClose]);

  return (
    <div
      className={clsx(
        'pointer-events-auto w-full max-w-sm overflow-hidden rounded-lg shadow-lg ring-1 ring-black ring-opacity-5',
        style.bg
      )}
    >
      <div className="p-4">
        <div className="flex items-start">
          <div className="flex-shrink-0">
            <Icon className={clsx('h-5 w-5', style.icon)} />
          </div>
          <div className="ml-3 w-0 flex-1">
            <p className={clsx('text-sm font-medium', style.title)}>{title}</p>
            {message && (
              <p className={clsx('mt-1 text-sm', style.message)}>{message}</p>
            )}
          </div>
          <div className="ml-4 flex flex-shrink-0">
            <button
              className={clsx(
                'inline-flex rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2',
                style.title
              )}
              onClick={() => onClose(id)}
            >
              <span className="sr-only">Закрыть</span>
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};