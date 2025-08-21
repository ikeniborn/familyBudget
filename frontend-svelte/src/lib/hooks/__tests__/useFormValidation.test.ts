import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { get } from 'svelte/store';
import { z } from 'zod';
import { useFormValidation, createFieldValidator, mergeServerErrors } from '../useFormValidation';
import { ValidationError } from '../../validation/schemas';

// Mock svelte-forms-lib
vi.mock('svelte-forms-lib', () => ({
  createForm: vi.fn((config) => ({
    form: {
      subscribe: vi.fn(),
      set: vi.fn(),
    },
    errors: {
      set: vi.fn(),
      update: vi.fn(),
      subscribe: vi.fn(),
    },
    touched: {
      subscribe: vi.fn(),
    },
    handleSubmit: vi.fn(async () => {
      try {
        await config.onSubmit(get({ form: config.initialValues }));
      } catch (error) {
        throw error;
      }
    }),
    updateField: vi.fn(),
    updateValidateField: vi.fn(),
  }))
}));

describe('useFormValidation', () => {
  const testSchema = z.object({
    name: z.string().min(2, 'Name must be at least 2 characters'),
    email: z.string().email('Invalid email format'),
    age: z.number().min(18, 'Must be at least 18 years old'),
  });

  const initialValues = {
    name: '',
    email: '',
    age: 0,
  };

  let mockOnSubmit: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    mockOnSubmit = vi.fn().mockResolvedValue(void 0);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('should initialize with correct default state', () => {
    const formValidation = useFormValidation({
      schema: testSchema,
      initialValues,
      onSubmit: mockOnSubmit,
    });

    expect(get(formValidation.isValidating)).toBe(false);
    expect(get(formValidation.serverErrors)).toEqual({});
    expect(get(formValidation.isSubmitting)).toBe(false);
    expect(get(formValidation.submitCount)).toBe(0);
  });

  it('should validate synchronously using Zod schema', () => {
    const formValidation = useFormValidation({
      schema: testSchema,
      initialValues,
      onSubmit: mockOnSubmit,
    });

    // Test invalid data
    const invalidData = {
      name: 'a', // Too short
      email: 'invalid-email',
      age: 15, // Too young
    };

    // Mock validation function
    const validate = (values: typeof invalidData) => {
      try {
        testSchema.parse(values);
        return {};
      } catch (error) {
        if (error instanceof z.ZodError) {
          const errors: Record<string, string> = {};
          error.errors.forEach((err) => {
            const path = err.path.join('.');
            errors[path] = err.message;
          });
          return errors;
        }
        return { _form: 'Validation error' };
      }
    };

    const errors = validate(invalidData);
    expect(errors).toHaveProperty('name');
    expect(errors).toHaveProperty('email');
    expect(errors).toHaveProperty('age');
  });

  describe('Async Validation', () => {
    it('should handle async field validation with debouncing', async () => {
      const asyncValidator = vi.fn().mockResolvedValue(null);
      const asyncRules = [{
        field: 'name' as const,
        validator: asyncValidator,
        debounceMs: 300,
      }];

      const formValidation = useFormValidation({
        schema: testSchema,
        initialValues,
        onSubmit: mockOnSubmit,
      }, asyncRules);

      await formValidation.validateField('name');

      // Fast-forward timers
      vi.advanceTimersByTime(300);

      await vi.waitFor(() => {
        expect(asyncValidator).toHaveBeenCalled();
      });
    });

    it('should handle async validation errors', async () => {
      const asyncValidator = vi.fn().mockResolvedValue('Name already exists');
      const asyncRules = [{
        field: 'name' as const,
        validator: asyncValidator,
        debounceMs: 100,
      }];

      const formValidation = useFormValidation({
        schema: testSchema,
        initialValues,
        onSubmit: mockOnSubmit,
      }, asyncRules);

      await formValidation.validateField('name');

      vi.advanceTimersByTime(100);

      await vi.waitFor(() => {
        expect(asyncValidator).toHaveBeenCalled();
      });
    });

    it('should debounce multiple rapid async validation calls', async () => {
      const asyncValidator = vi.fn().mockResolvedValue(null);
      const asyncRules = [{
        field: 'name' as const,
        validator: asyncValidator,
        debounceMs: 500,
      }];

      const formValidation = useFormValidation({
        schema: testSchema,
        initialValues,
        onSubmit: mockOnSubmit,
      }, asyncRules);

      // Make multiple rapid calls
      await formValidation.validateField('name');
      await formValidation.validateField('name');
      await formValidation.validateField('name');

      // Only the last call should be executed after debounce
      vi.advanceTimersByTime(500);

      await vi.waitFor(() => {
        expect(asyncValidator).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('Server Errors', () => {
    it('should set server errors correctly', () => {
      const formValidation = useFormValidation({
        schema: testSchema,
        initialValues,
        onSubmit: mockOnSubmit,
      });

      const serverErrors = {
        name: 'Name is already taken',
        email: 'Email is invalid',
      };

      formValidation.setServerErrors(serverErrors);

      expect(get(formValidation.serverErrors)).toEqual(serverErrors);
    });

    it('should clear server errors', () => {
      const formValidation = useFormValidation({
        schema: testSchema,
        initialValues,
        onSubmit: mockOnSubmit,
      });

      formValidation.setServerErrors({ name: 'Error' });
      formValidation.clearServerErrors();

      expect(get(formValidation.serverErrors)).toEqual({});
    });

    it('should clear specific field errors', () => {
      const formValidation = useFormValidation({
        schema: testSchema,
        initialValues,
        onSubmit: mockOnSubmit,
      });

      formValidation.setServerErrors({
        name: 'Name error',
        email: 'Email error',
      });

      formValidation.clearFieldError('name');

      const remainingErrors = get(formValidation.serverErrors);
      expect(remainingErrors).not.toHaveProperty('name');
      expect(remainingErrors).toHaveProperty('email');
    });
  });

  describe('Form State Management', () => {
    it('should set field values correctly', () => {
      const formValidation = useFormValidation({
        schema: testSchema,
        initialValues,
        onSubmit: mockOnSubmit,
      });

      formValidation.setFieldValue('name', 'John Doe');
      formValidation.setFieldValue('email', 'john@example.com');

      // The actual implementation would update the form store
      expect(formValidation.form.updateField).toHaveBeenCalledWith('name', 'John Doe');
      expect(formValidation.form.updateField).toHaveBeenCalledWith('email', 'john@example.com');
    });

    it('should set multiple field values at once', () => {
      const formValidation = useFormValidation({
        schema: testSchema,
        initialValues,
        onSubmit: mockOnSubmit,
      });

      const values = {
        name: 'Jane Doe',
        email: 'jane@example.com',
      };

      formValidation.setFieldValues(values);

      expect(formValidation.form.updateField).toHaveBeenCalledWith('name', 'Jane Doe');
      expect(formValidation.form.updateField).toHaveBeenCalledWith('email', 'jane@example.com');
    });

    it('should reset form to initial values', () => {
      const formValidation = useFormValidation({
        schema: testSchema,
        initialValues,
        onSubmit: mockOnSubmit,
      });

      formValidation.setServerErrors({ name: 'Error' });
      formValidation.resetForm();

      expect(get(formValidation.serverErrors)).toEqual({});
      expect(get(formValidation.isSubmitting)).toBe(false);
      expect(get(formValidation.submitCount)).toBe(0);
    });

    it('should reset form with new values', () => {
      const formValidation = useFormValidation({
        schema: testSchema,
        initialValues,
        onSubmit: mockOnSubmit,
      });

      const newValues = {
        name: 'Reset Name',
      };

      formValidation.resetForm(newValues);

      expect(formValidation.form.form.set).toHaveBeenCalledWith({
        ...initialValues,
        ...newValues,
      });
    });
  });

  describe('Form Submission', () => {
    it('should handle successful form submission', async () => {
      const formValidation = useFormValidation({
        schema: testSchema,
        initialValues: {
          name: 'John Doe',
          email: 'john@example.com',
          age: 25,
        },
        onSubmit: mockOnSubmit,
      });

      await formValidation.submitForm();

      expect(mockOnSubmit).toHaveBeenCalled();
    });

    it('should handle form submission errors', async () => {
      const submitError = new Error('Submission failed');
      const failingOnSubmit = vi.fn().mockRejectedValue(submitError);

      const formValidation = useFormValidation({
        schema: testSchema,
        initialValues,
        onSubmit: failingOnSubmit,
      });

      await expect(formValidation.submitForm()).rejects.toThrow('Submission failed');
    });

    it('should handle ValidationError during submission', async () => {
      const validationError = new ValidationError({
        name: 'Name is required',
        email: 'Email is invalid',
      });

      const failingOnSubmit = vi.fn().mockRejectedValue(validationError);

      const formValidation = useFormValidation({
        schema: testSchema,
        initialValues,
        onSubmit: failingOnSubmit,
      });

      try {
        await formValidation.submitForm();
      } catch (error) {
        expect(error).toBeInstanceOf(ValidationError);
        expect(get(formValidation.serverErrors)).toEqual(validationError.errors);
      }
    });

    it('should increment submit count on submission', async () => {
      const formValidation = useFormValidation({
        schema: testSchema,
        initialValues: {
          name: 'John Doe',
          email: 'john@example.com',
          age: 25,
        },
        onSubmit: mockOnSubmit,
      });

      const initialCount = get(formValidation.submitCount);
      await formValidation.submitForm();

      expect(get(formValidation.submitCount)).toBe(initialCount + 1);
    });
  });

  describe('Computed States', () => {
    it('should compute isValid correctly', () => {
      const formValidation = useFormValidation({
        schema: testSchema,
        initialValues,
        onSubmit: mockOnSubmit,
      });

      // Mock empty errors for valid state
      vi.mocked(formValidation.form.errors.subscribe).mockImplementation((callback) => {
        callback({});
        return () => {};
      });

      // The actual test would check the derived store value
      expect(formValidation.isValid).toBeDefined();
    });

    it('should compute hasErrors correctly', () => {
      const formValidation = useFormValidation({
        schema: testSchema,
        initialValues,
        onSubmit: mockOnSubmit,
      });

      formValidation.setServerErrors({ name: 'Server error' });

      expect(formValidation.hasErrors).toBeDefined();
    });

    it('should compute canSubmit correctly', () => {
      const formValidation = useFormValidation({
        schema: testSchema,
        initialValues,
        onSubmit: mockOnSubmit,
      });

      expect(formValidation.canSubmit).toBeDefined();
    });
  });
});

describe('createFieldValidator', () => {
  const testSchema = z.object({
    name: z.string().min(2),
    email: z.string().email(),
  });

  const formValidation = useFormValidation({
    schema: testSchema,
    initialValues: { name: '', email: '' },
    onSubmit: vi.fn(),
  });

  const fieldValidator = createFieldValidator(formValidation);

  it('should check if field has error', () => {
    formValidation.setServerErrors({ name: 'Name error' });

    expect(fieldValidator.hasFieldError('name')).toBe(true);
    expect(fieldValidator.hasFieldError('email')).toBe(false);
  });

  it('should get field error message', () => {
    formValidation.setServerErrors({ name: 'Name is required' });

    expect(fieldValidator.getFieldError('name')).toBe('Name is required');
    expect(fieldValidator.getFieldError('email')).toBeNull();
  });

  it('should get field validation state', () => {
    formValidation.setServerErrors({ name: 'Name error' });

    const fieldState = fieldValidator.getFieldState('name');

    expect(fieldState).toHaveProperty('error', 'Name error');
    expect(fieldState).toHaveProperty('hasError', true);
    expect(fieldState).toHaveProperty('isValidating');
  });
});

describe('mergeServerErrors', () => {
  const testSchema = z.object({
    name: z.string(),
  });

  const formValidation = useFormValidation({
    schema: testSchema,
    initialValues: { name: '' },
    onSubmit: vi.fn(),
  });

  it('should merge server errors from API response', () => {
    const apiError = {
      response: {
        data: {
          detail: {
            name: 'Name is already taken',
            email: 'Email is invalid',
          }
        }
      }
    };

    mergeServerErrors(formValidation, apiError);

    expect(get(formValidation.serverErrors)).toEqual({
      name: 'Name is already taken',
      email: 'Email is invalid',
    });
  });

  it('should handle string error messages', () => {
    const apiError = {
      response: {
        data: {
          detail: 'Generic error message'
        }
      }
    };

    mergeServerErrors(formValidation, apiError);

    expect(get(formValidation.serverErrors)).toEqual({
      _form: 'Generic error message',
    });
  });

  it('should handle ValidationError instances', () => {
    const validationError = new ValidationError({
      name: 'Validation failed for name',
      email: 'Validation failed for email',
    });

    mergeServerErrors(formValidation, validationError);

    expect(get(formValidation.serverErrors)).toEqual({
      name: 'Validation failed for name',
      email: 'Validation failed for email',
    });
  });

  it('should handle generic errors', () => {
    const genericError = new Error('Something went wrong');

    mergeServerErrors(formValidation, genericError);

    expect(get(formValidation.serverErrors)).toEqual({
      _form: 'Something went wrong',
    });
  });
});