// Re-export shadcn/ui Select components
export {
  Select as BaseSelect,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import React from 'react';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import {
  Select as ShadcnSelect,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export interface SelectOption {
  value: string | number;
  label: string;
}

export interface SelectProps {
  label?: string;
  error?: string;
  helperText?: string;
  options: SelectOption[];
  placeholder?: string;
  value?: string | number;
  onValueChange?: (value: string) => void;
  className?: string;
  required?: boolean;
  disabled?: boolean;
}

export const Select: React.FC<SelectProps> = ({
  label,
  error,
  helperText,
  options,
  placeholder = "Select an option",
  value,
  onValueChange,
  className,
  required,
  disabled,
}) => {
  return (
    <div className="w-full space-y-2">
      {label && (
        <Label>
          {label}
          {required && <span className="text-destructive ml-1">*</span>}
        </Label>
      )}
      <ShadcnSelect
        value={value?.toString()}
        onValueChange={onValueChange}
        disabled={disabled}
      >
        <SelectTrigger 
          className={cn(
            error && 'border-destructive focus:ring-destructive',
            className
          )}
        >
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value.toString()}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </ShadcnSelect>
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

Select.displayName = 'Select';