// Main validation system exports
export * from './schemas';
export * from './serverErrorHandler';

// Re-export form validation hook
export { default as useFormValidation } from '$lib/hooks/useFormValidation';
export type { FormValidationConfig, FormValidationResult, AsyncValidationRule } from '$lib/hooks/useFormValidation';
export { createFieldValidator, mergeServerErrors, handleFormSubmissionError } from '$lib/hooks/useFormValidation';

// Validation utilities
export { ValidationError, formatZodErrors, asyncValidators } from './schemas';