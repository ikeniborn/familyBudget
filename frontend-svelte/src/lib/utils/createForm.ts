import { writable, get, type Writable } from 'svelte/store';

export interface FormConfig<T extends Record<string, any>> {
  initialValues: T;
  validate?: (values: T) => Record<string, string>;
  onSubmit: (values: T) => Promise<void> | void;
}

export interface FormInstance<T extends Record<string, any>> {
  form: Writable<T>;
  errors: Writable<Record<string, string>>;
  touched: Writable<Record<string, boolean>>;
  isSubmitting: Writable<boolean>;
  isValidating: Writable<boolean>;
  handleSubmit: (event?: Event) => Promise<void>;
  updateField: (field: string, value: any) => void;
  updateValidateField: (field: string, validator: () => string) => void;
  setFieldError: (field: string, error: string) => void;
  resetForm: () => void;
  setFieldTouched: (field: string, touched: boolean) => void;
}

/**
 * Native Svelte 5 implementation of createForm to replace svelte-forms-lib
 * This provides the same API as svelte-forms-lib's createForm function
 */
export function createForm<T extends Record<string, any>>(
  config: FormConfig<T>
): FormInstance<T> {
  const { initialValues, validate, onSubmit } = config;
  
  // Create stores for form state
  const form = writable<T>({ ...initialValues });
  const errors = writable<Record<string, string>>({});
  const touched = writable<Record<string, boolean>>({});
  const isSubmitting = writable(false);
  const isValidating = writable(false);
  
  // Internal validation function
  const runValidation = (values: T): Record<string, string> => {
    if (!validate) return {};
    
    isValidating.set(true);
    const validationErrors = validate(values);
    isValidating.set(false);
    
    return validationErrors;
  };
  
  // Handle form submission
  const handleSubmit = async (event?: Event) => {
    if (event) {
      event.preventDefault();
    }
    
    const values = get(form);
    
    // Run validation
    const validationErrors = runValidation(values);
    errors.set(validationErrors);
    
    // If there are errors, don't submit
    if (Object.keys(validationErrors).length > 0) {
      return;
    }
    
    // Mark all fields as touched
    const allTouched: Record<string, boolean> = {};
    Object.keys(values).forEach(key => {
      allTouched[key] = true;
    });
    touched.set(allTouched);
    
    // Submit the form
    isSubmitting.set(true);
    try {
      await onSubmit(values);
    } finally {
      isSubmitting.set(false);
    }
  };
  
  // Update a single field value
  const updateField = (field: string, value: any) => {
    form.update(currentForm => ({
      ...currentForm,
      [field]: value
    }));
    
    // Mark field as touched
    touched.update(currentTouched => ({
      ...currentTouched,
      [field]: true
    }));
    
    // Run validation after update
    const currentValues = get(form);
    const validationErrors = runValidation(currentValues);
    errors.set(validationErrors);
  };
  
  // Update field validation (used for async validation)
  const updateValidateField = (field: string, validator: () => string) => {
    const error = validator();
    
    errors.update(currentErrors => {
      if (error) {
        return { ...currentErrors, [field]: error };
      } else {
        const { [field]: removed, ...rest } = currentErrors;
        return rest;
      }
    });
  };
  
  // Set error for a specific field
  const setFieldError = (field: string, error: string) => {
    errors.update(currentErrors => ({
      ...currentErrors,
      [field]: error
    }));
  };
  
  // Reset form to initial values
  const resetForm = () => {
    form.set({ ...initialValues });
    errors.set({});
    touched.set({});
    isSubmitting.set(false);
    isValidating.set(false);
  };
  
  // Set touched state for a field
  const setFieldTouched = (field: string, touchedState: boolean) => {
    touched.update(currentTouched => ({
      ...currentTouched,
      [field]: touchedState
    }));
  };
  
  return {
    form,
    errors,
    touched,
    isSubmitting,
    isValidating,
    handleSubmit,
    updateField,
    updateValidateField,
    setFieldError,
    resetForm,
    setFieldTouched
  };
}

export default createForm;