import { createForm } from '$lib/utils/createForm';
import { writable, derived, get } from 'svelte/store';
import type { z } from 'zod';
import { formatZodErrors, ValidationError } from '$lib/validation/schemas';

export interface FormValidationConfig<T extends Record<string, any>> {
  schema: z.ZodSchema<T>;
  initialValues: T;
  onSubmit: (values: T) => Promise<void> | void;
  validateOnChange?: boolean;
  validateOnBlur?: boolean;
  enableReinitialize?: boolean;
}

export interface AsyncValidationRule<T> {
  field: keyof T;
  validator: (value: any, values: T) => Promise<string | null>;
  debounceMs?: number;
}

export interface FormValidationResult<T extends Record<string, any>> {
  // Form state
  form: ReturnType<typeof createForm<T>>;
  
  // Additional reactive stores
  isValidating: typeof writable<boolean>;
  serverErrors: typeof writable<Record<string, string>>;
  isSubmitting: typeof writable<boolean>;
  submitCount: typeof writable<number>;
  
  // Computed states
  isValid: ReturnType<typeof derived<any[], boolean>>;
  hasErrors: ReturnType<typeof derived<any[], boolean>>;
  canSubmit: ReturnType<typeof derived<any[], boolean>>;
  
  // Methods
  validateField: (field: keyof T) => Promise<void>;
  validateForm: () => Promise<boolean>;
  clearFieldError: (field: keyof T) => void;
  clearServerErrors: () => void;
  setServerErrors: (errors: Record<string, string>) => void;
  setFieldValue: (field: keyof T, value: any) => void;
  setFieldValues: (values: Partial<T>) => void;
  resetForm: (values?: Partial<T>) => void;
  submitForm: () => Promise<void>;
}

/**
 * Creates a form with integrated Zod validation and enhanced error handling
 */
export function useFormValidation<T extends Record<string, any>>(
  config: FormValidationConfig<T>,
  asyncRules: AsyncValidationRule<T>[] = []
): FormValidationResult<T> {
  const {
    schema,
    initialValues,
    onSubmit,
    validateOnChange = true,
    validateOnBlur = true,
    enableReinitialize = false
  } = config;

  // Additional stores for enhanced functionality
  const isValidating = writable(false);
  const serverErrors = writable<Record<string, string>>({});
  const isSubmitting = writable(false);
  const submitCount = writable(0);

  // Debounce timers for async validation
  const debounceTimers = new Map<keyof T, NodeJS.Timeout>();

  // Validate function using Zod
  const validate = (values: T) => {
    try {
      schema.parse(values);
      return {};
    } catch (error) {
      if (error instanceof z.ZodError) {
        return formatZodErrors(error);
      }
      return { _form: 'Ошибка валидации формы' };
    }
  };

  // Create the form with svelte-forms-lib
  const form = createForm({
    initialValues,
    validate,
    onSubmit: async (values) => {
      isSubmitting.set(true);
      submitCount.update(count => count + 1);
      
      try {
        // Clear server errors before submitting
        serverErrors.set({});
        
        // Final validation before submit
        const isFormValid = await validateForm();
        if (!isFormValid) {
          return;
        }
        
        await onSubmit(values);
      } catch (error: any) {
        // Handle server validation errors
        if (error.response?.data?.detail) {
          if (typeof error.response.data.detail === 'object') {
            serverErrors.set(error.response.data.detail);
          } else {
            serverErrors.set({ _form: error.response.data.detail });
          }
        } else if (error instanceof ValidationError) {
          serverErrors.set(error.errors);
        } else {
          serverErrors.set({ _form: error.message || 'Произошла ошибка при отправке формы' });
        }
        throw error;
      } finally {
        isSubmitting.set(false);
      }
    }
  });

  // Computed states
  const isValid = derived(
    [form.errors, serverErrors],
    ([formErrors, svrErrors]) => {
      const hasFormErrors = Object.keys(formErrors).length > 0;
      const hasServerErrors = Object.keys(svrErrors).length > 0;
      return !hasFormErrors && !hasServerErrors;
    }
  );

  const hasErrors = derived(
    [form.errors, serverErrors],
    ([formErrors, svrErrors]) => {
      return Object.keys(formErrors).length > 0 || Object.keys(svrErrors).length > 0;
    }
  );

  const canSubmit = derived(
    [isValid, isSubmitting, isValidating],
    ([valid, submitting, validating]) => {
      return valid && !submitting && !validating;
    }
  );

  // Async field validation
  const validateField = async (field: keyof T): Promise<void> => {
    const values = get(form.form);
    const fieldValue = values[field];

    // Find async rules for this field
    const fieldRules = asyncRules.filter(rule => rule.field === field);
    
    if (fieldRules.length === 0) {
      return;
    }

    // Clear existing timer
    const existingTimer = debounceTimers.get(field);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Set new timer for debounced validation
    const timer = setTimeout(async () => {
      isValidating.set(true);
      
      try {
        for (const rule of fieldRules) {
          const error = await rule.validator(fieldValue, values);
          
          if (error) {
            form.updateValidateField(field as string, () => error);
            break;
          } else {
            // Clear field error if validation passes
            form.updateValidateField(field as string, () => '');
          }
        }
      } catch (error) {
        console.error('Async validation error:', error);
        form.updateValidateField(field as string, () => 'Ошибка проверки данных');
      } finally {
        isValidating.set(false);
        debounceTimers.delete(field);
      }
    }, fieldRules[0].debounceMs || 500);

    debounceTimers.set(field, timer);
  };

  // Validate entire form
  const validateForm = async (): Promise<boolean> => {
    // First, run synchronous Zod validation
    const values = get(form.form);
    const syncErrors = validate(values);
    
    // Update form errors
    form.errors.set(syncErrors);
    
    // If sync validation fails, don't proceed with async
    if (Object.keys(syncErrors).length > 0) {
      return false;
    }

    // Run async validation for all fields with async rules
    if (asyncRules.length > 0) {
      isValidating.set(true);
      
      try {
        const asyncErrors: Record<string, string> = {};
        
        for (const rule of asyncRules) {
          const fieldValue = values[rule.field];
          const error = await rule.validator(fieldValue, values);
          
          if (error) {
            asyncErrors[rule.field as string] = error;
          }
        }
        
        // Update form with async errors
        if (Object.keys(asyncErrors).length > 0) {
          form.errors.update(current => ({ ...current, ...asyncErrors }));
          return false;
        }
      } catch (error) {
        console.error('Async form validation error:', error);
        form.errors.update(current => ({ ...current, _form: 'Ошибка проверки данных' }));
        return false;
      } finally {
        isValidating.set(false);
      }
    }

    return true;
  };

  // Clear specific field error
  const clearFieldError = (field: keyof T) => {
    form.errors.update(current => {
      const updated = { ...current };
      delete updated[field as string];
      return updated;
    });
    
    serverErrors.update(current => {
      const updated = { ...current };
      delete updated[field as string];
      return updated;
    });
  };

  // Clear server errors
  const clearServerErrors = () => {
    serverErrors.set({});
  };

  // Set server errors from API response
  const setServerErrors = (errors: Record<string, string>) => {
    serverErrors.set(errors);
  };

  // Set field value with optional validation
  const setFieldValue = (field: keyof T, value: any) => {
    form.updateField(field as string, value);
    
    if (validateOnChange) {
      // Clear existing error first
      clearFieldError(field);
      
      // Run validation after a brief delay
      setTimeout(() => {
        validateField(field);
      }, 100);
    }
  };

  // Set multiple field values
  const setFieldValues = (values: Partial<T>) => {
    Object.entries(values).forEach(([field, value]) => {
      form.updateField(field, value);
    });
    
    if (validateOnChange) {
      setTimeout(() => {
        Object.keys(values).forEach(field => {
          validateField(field as keyof T);
        });
      }, 100);
    }
  };

  // Reset form with optional new values
  const resetForm = (values?: Partial<T>) => {
    const newValues = values ? { ...initialValues, ...values } : initialValues;
    
    form.form.set(newValues);
    form.errors.set({});
    serverErrors.set({});
    isSubmitting.set(false);
    isValidating.set(false);
    submitCount.set(0);
    
    // Clear any pending debounce timers
    debounceTimers.forEach(timer => clearTimeout(timer));
    debounceTimers.clear();
  };

  // Submit form manually
  const submitForm = async () => {
    await form.handleSubmit();
  };

  // Auto-validation on field changes
  if (validateOnChange) {
    form.form.subscribe((values) => {
      // Only validate if not in initial state
      if (get(submitCount) > 0 || get(hasErrors)) {
        Object.keys(values).forEach(field => {
          const fieldRules = asyncRules.filter(rule => rule.field === field);
          if (fieldRules.length > 0) {
            validateField(field as keyof T);
          }
        });
      }
    });
  }

  return {
    // Form state
    form,
    
    // Additional reactive stores
    isValidating,
    serverErrors,
    isSubmitting,
    submitCount,
    
    // Computed states
    isValid,
    hasErrors,
    canSubmit,
    
    // Methods
    validateField,
    validateForm,
    clearFieldError,
    clearServerErrors,
    setServerErrors,
    setFieldValue,
    setFieldValues,
    resetForm,
    submitForm,
  };
}

/**
 * Higher-order function to create field-specific validation composables
 */
export function createFieldValidator<T extends Record<string, any>>(
  form: FormValidationResult<T>
) {
  return {
    // Get field error (combines form errors and server errors)
    getFieldError: (field: keyof T): string | null => {
      const formErrors = get(form.form.errors);
      const svrErrors = get(form.serverErrors);
      
      return formErrors[field as string] || svrErrors[field as string] || null;
    },
    
    // Check if field has error
    hasFieldError: (field: keyof T): boolean => {
      const formErrors = get(form.form.errors);
      const svrErrors = get(form.serverErrors);
      
      return !!(formErrors[field as string] || svrErrors[field as string]);
    },
    
    // Check if field is validating
    isFieldValidating: (field: keyof T): boolean => {
      return get(form.isValidating);
    },
    
    // Get field validation state
    getFieldState: (field: keyof T) => {
      const formErrors = get(form.form.errors);
      const svrErrors = get(form.serverErrors);
      const value = get(form.form.form)[field];
      
      return {
        value,
        error: formErrors[field as string] || svrErrors[field as string] || null,
        hasError: !!(formErrors[field as string] || svrErrors[field as string]),
        isValidating: get(form.isValidating),
        touched: get(form.form.touched)[field as string] || false,
      };
    }
  };
}

// Utility to merge server errors with existing form errors
export function mergeServerErrors(
  formResult: FormValidationResult<any>,
  apiError: any
): void {
  let errors: Record<string, string> = {};
  
  if (apiError.response?.data?.detail) {
    if (typeof apiError.response.data.detail === 'object') {
      errors = apiError.response.data.detail;
    } else {
      errors._form = apiError.response.data.detail;
    }
  } else if (apiError.response?.data?.errors) {
    errors = apiError.response.data.errors;
  } else if (apiError instanceof ValidationError) {
    errors = apiError.errors;
  } else {
    errors._form = apiError.message || 'Произошла ошибка при обработке запроса';
  }
  
  formResult.setServerErrors(errors);
}

// Enhanced server error handling with better error mapping
export function handleFormSubmissionError<T extends Record<string, any>>(
  formResult: FormValidationResult<T>,
  apiError: any,
  entityType?: string
): void {
  // Import the server error handler dynamically to avoid circular imports
  import('$lib/validation/serverErrorHandler').then((errorHandler) => {
    errorHandler.handleFormSubmissionError(apiError, formResult, entityType || 'generic', {
      operation: 'submit',
      resource: entityType || 'form'
    });
  }).catch(() => {
    // Fallback to simple error handling if import fails
    mergeServerErrors(formResult, apiError);
  });
}

export default useFormValidation;