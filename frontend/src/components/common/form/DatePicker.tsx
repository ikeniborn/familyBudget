// Re-export shadcn/ui DatePicker component
export { DatePicker as BaseDatePicker } from '@/components/ui/date-picker';

import React from 'react';
import { DatePicker as ShadcnDatePicker } from '@/components/ui/date-picker';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

export interface DatePickerProps {
  label?: string;
  error?: string;
  helperText?: string;
  value?: Date | string;
  onChange?: (date: Date | undefined) => void;
  placeholder?: string;
  className?: string;
  required?: boolean;
  disabled?: boolean;
}

export const DatePicker: React.FC<DatePickerProps> = ({
  label,
  error,
  helperText,
  value,
  onChange,
  placeholder = "Pick a date",
  className,
  required,
  disabled,
}) => {
  // Convert string date to Date object if needed
  const dateValue = value ? (typeof value === 'string' ? new Date(value) : value) : undefined;

  return (
    <div className="w-full space-y-2">
      {label && (
        <Label>
          {label}
          {required && <span className="text-destructive ml-1">*</span>}
        </Label>
      )}
      <ShadcnDatePicker
        date={dateValue}
        onDateChange={onChange}
        placeholder={placeholder}
        className={cn(
          'w-full',
          error && '[&>button]:border-destructive [&>button]:focus:ring-destructive',
          disabled && '[&>button]:cursor-not-allowed [&>button]:opacity-50',
          className
        )}
      />
      {(error || helperText) && (
        <p className={cn(
          'text-sm',
          error ? 'text-destructive' : 'text-muted-foreground'
        )}>
          {error || helperText}
        </p>
      )}
    </div>
  );
};

DatePicker.displayName = 'DatePicker';