/**
 * Type definitions for UI Components library
 *
 * @module uiComponents/types
 */

/**
 * Validation result from component validation
 */
export interface ValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Base properties for all form field components
 */
export interface BaseFieldProps {
  name: string;
  value?: string | number;
  required?: boolean;
  disabled?: boolean;
  readonly?: boolean;
  placeholder?: string;
  className?: string;
}

/**
 * FormField wrapper properties
 */
export interface FormFieldProps {
  label: string;
  name: string;
  required?: boolean;
  helpText?: string;
  error?: string;
  className?: string;
  children: HTMLElement;
}

/**
 * AmountInput properties
 */
export interface AmountInputProps extends BaseFieldProps {
  min?: number;
  max?: number;
  step?: number;
  onChange?: (value: number) => void;
  onBlur?: (value: number) => void;
}

/**
 * TextInput properties
 */
export interface TextInputProps extends BaseFieldProps {
  type?: 'text' | 'email' | 'tel' | 'url';
  maxLength?: number;
  pattern?: string;
  autocomplete?: string;
  onChange?: (value: string) => void;
}

/**
 * TextareaInput properties
 */
export interface TextareaInputProps extends BaseFieldProps {
  rows?: number;
  maxLength?: number;
  onChange?: (value: string) => void;
}

/**
 * SelectDropdown option
 */
export interface SelectOption {
  value: string | number;
  label: string;
  disabled?: boolean;
  selected?: boolean;
}

/**
 * SelectDropdown properties
 */
export interface SelectDropdownProps extends BaseFieldProps {
  options: SelectOption[];
  multiple?: boolean;
  size?: number;
  onChange?: (value: string | string[]) => void;
}

/**
 * DateInput properties
 */
export interface DateInputProps extends BaseFieldProps {
  mode?: 'single' | 'range';
  quickButtons?: Array<{
    label: string;
    offset: number; // Days offset from today (0 = today, -1 = yesterday, etc.)
  }>;
  onChange?: (date: string | [string, string]) => void;
}

/**
 * HierarchySelect type
 */
export type HierarchyType = 'category' | 'productGroup';

/**
 * HierarchySelect properties (Generic)
 */
export interface HierarchySelectProps<T> {
  name: string;
  type: HierarchyType;
  value?: number | number[];
  multiple?: boolean;

  // Category-specific
  articleType?: 'expense' | 'income';
  financialCenterId?: number | null;

  // Callbacks
  onChange?: (item: T | T[]) => void;
}

/**
 * Article entity (for category hierarchy)
 */
export interface Article {
  id: number;
  name: string;
  type: 'expense' | 'income' | 'debit' | 'credit';
  parent_id: number | null;
  is_active: boolean;
  usage_count?: number;
}

/**
 * Product Group entity (for product hierarchy)
 */
export interface ProductGroup {
  id: number;
  name: string;
  parent_id: number | null;
  is_active: boolean;
}

/**
 * Base modal properties
 */
export interface BaseModalProps {
  id: string;
  title: string;
  size?: string;
  content?: HTMLElement | string;
  hideCloseButton?: boolean;
  disableBackdropClose?: boolean;
  onOpen?: () => void;
  onClose?: () => void;
}

/**
 * Form modal properties
 */
export interface FormModalProps {
  id: string;
  title: string;
  size?: string;
  formContent: HTMLElement;
  submitLabel?: string;
  submitButtonClass?: string;
  cancelLabel?: string;
  hideCloseButton?: boolean;
  disableBackdropClose?: boolean;
  keepOpenOnSuccess?: boolean;
  onValidate?: () => ValidationResult;
  onSubmit: () => Promise<void>;
  onSuccess?: () => void;
  onError?: (error: Error) => void;
  onCancel?: () => void;
  onOpen?: () => void;
  onClose?: () => void;
}
