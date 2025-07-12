// Re-export the shadcn/ui Button component
export { Button, type ButtonProps } from '@/components/ui/button';

// Legacy button component for backward compatibility if needed
import React, { forwardRef } from 'react';
import { Loading } from '../Loading';
import { Button as ShadcnButton } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface LegacyButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children?: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'small' | 'medium' | 'large';
  fullWidth?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
}

// Map legacy props to shadcn variants
const mapVariant = (variant?: string): "default" | "destructive" | "outline" | "secondary" | "ghost" | "link" => {
  switch (variant) {
    case 'primary': return 'default';
    case 'danger': return 'destructive';
    case 'ghost': return 'ghost';
    case 'secondary': return 'secondary';
    default: return 'default';
  }
};

const mapSize = (size?: string): "default" | "sm" | "lg" | "icon" => {
  switch (size) {
    case 'small': return 'sm';
    case 'large': return 'lg';
    case 'medium': 
    default: return 'default';
  }
};

export const LegacyButton = forwardRef<HTMLButtonElement, LegacyButtonProps>(
  ({ 
    children, 
    variant = 'primary', 
    size = 'medium', 
    fullWidth = false,
    loading = false,
    icon,
    className, 
    disabled,
    ...props 
  }, ref) => {
    return (
      <ShadcnButton
        ref={ref}
        variant={mapVariant(variant)}
        size={mapSize(size)}
        className={cn(fullWidth && 'w-full', className)}
        disabled={disabled || loading}
        {...props}
      >
        {loading ? (
          <>
            <Loading size="small" color={variant === 'primary' || variant === 'danger' ? 'white' : 'primary'} />
            <span className="ml-2">{children}</span>
          </>
        ) : (
          <>
            {icon && <span className="mr-2">{icon}</span>}
            {children}
          </>
        )}
      </ShadcnButton>
    );
  }
);

LegacyButton.displayName = 'LegacyButton';