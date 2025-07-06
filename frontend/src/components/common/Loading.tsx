import React from 'react';
import { clsx } from 'clsx';

interface LoadingProps {
  size?: 'small' | 'medium' | 'large';
  color?: 'primary' | 'white';
  fullScreen?: boolean;
  text?: string;
}

export const Loading: React.FC<LoadingProps> = ({ 
  size = 'medium', 
  color = 'primary',
  fullScreen = false,
  text
}) => {
  const sizeClasses = {
    small: 'h-4 w-4 border-2',
    medium: 'h-8 w-8 border-3',
    large: 'h-12 w-12 border-4'
  };

  const colorClasses = {
    primary: 'border-blue-600',
    white: 'border-white'
  };

  const spinner = (
    <div className="flex flex-col items-center">
      <div
        className={clsx(
          'animate-spin rounded-full border-t-transparent',
          sizeClasses[size],
          colorClasses[color]
        )}
      />
      {text && (
        <p className={clsx(
          'mt-2 text-sm',
          color === 'white' ? 'text-white' : 'text-gray-600'
        )}>
          {text}
        </p>
      )}
    </div>
  );

  if (fullScreen) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900 bg-opacity-50">
        {spinner}
      </div>
    );
  }

  return spinner;
};