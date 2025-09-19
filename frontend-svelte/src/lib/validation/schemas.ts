import { z } from 'zod';

// Russian error messages map
const messages = {
  required_error: 'Поле обязательно для заполнения',
  invalid_type_error: 'Неверный тип данных',
  min_length: (min: number) => `Минимум ${min} символов`,
  max_length: (max: number) => `Максимум ${max} символов`,
  min_value: (min: number) => `Минимальное значение: ${min}`,
  max_value: (max: number) => `Максимальное значение: ${max}`,
  invalid_email: 'Некорректный адрес электронной почты',
  invalid_date: 'Некорректная дата',
  invalid_number: 'Должно быть числом',
  positive_number: 'Число должно быть положительным',
  non_negative: 'Число не может быть отрицательным',
  invalid_enum: 'Недопустимое значение'
};

// Base validation utilities
const createStringField = (minLength = 1, maxLength = 255) =>
  z.string({
    required_error: messages.required_error,
    invalid_type_error: messages.invalid_type_error,
  })
  .trim()
  .min(minLength, messages.min_length(minLength))
  .max(maxLength, messages.max_length(maxLength));

const createOptionalStringField = (maxLength = 255) =>
  z.string()
  .trim()
  .max(maxLength, messages.max_length(maxLength))
  .optional()
  .or(z.literal(''));

const createNumberField = (min?: number, max?: number) => {
  let schema = z.number({
    required_error: messages.required_error,
    invalid_type_error: messages.invalid_number,
  });
  
  if (min !== undefined) {
    schema = schema.min(min, messages.min_value(min));
  }
  
  if (max !== undefined) {
    schema = schema.max(max, messages.max_value(max));
  }
  
  return schema;
};

const createPositiveNumberField = () =>
  z.number({
    required_error: messages.required_error,
    invalid_type_error: messages.invalid_number,
  })
  .positive(messages.positive_number);

const createNonNegativeNumberField = () =>
  z.number({
    required_error: messages.required_error,
    invalid_type_error: messages.invalid_number,
  })
  .nonnegative(messages.non_negative);

// Common field validators
const idField = createPositiveNumberField();
const userIdField = createPositiveNumberField();
const orderField = createPositiveNumberField();
const activeField = z.boolean().default(true);

// Nomenclature validation schema
export const nomenclatureSchema = z.object({
  nomenclature_name: createStringField(3, 100),
  nomenclature_type: z.enum(['INCOME', 'EXPENSE'], {
    required_error: messages.required_error,
    invalid_type_error: messages.invalid_enum,
  }),
  parent_id: z.number().positive().optional().nullable(),
  nomenclature_order: orderField,
  color: z.string()
    .regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, 'Некорректный формат цвета (используйте #RRGGBB)')
    .optional()
    .or(z.literal('')),
  icon: createOptionalStringField(50),
  is_active: activeField,
  user_id: userIdField.optional(), // Added automatically from auth store
});

export type NomenclatureFormData = z.infer<typeof nomenclatureSchema>;

// Financial Center validation schema
export const financialCenterSchema = z.object({
  financial_center_name: createStringField(3, 100),
  financial_center_description: createOptionalStringField(500),
  parent_id: z.number().positive().optional().nullable(),
  financial_center_order: orderField,
  is_active: activeField,
  user_id: userIdField.optional(),
});

export type FinancialCenterFormData = z.infer<typeof financialCenterSchema>;

// Cost Center validation schema
export const costCenterSchema = z.object({
  cost_center_name: createStringField(3, 100),
  cost_center_description: createOptionalStringField(500),
  financial_center_id: z.number().positive().optional().nullable(),
  budget_limit: createNonNegativeNumberField().optional(),
  budget_period: z.enum(['monthly', 'quarterly', 'yearly'], {
    invalid_type_error: messages.invalid_enum,
  }).optional(),
  cost_center_order: orderField,
  is_active: activeField,
  user_id: userIdField.optional(),
});

export type CostCenterFormData = z.infer<typeof costCenterSchema>;

// Period validation schema
export const periodSchema = z.object({
  period_name: createStringField(3, 100),
  period_year: createNumberField(2020, 2030),
  period_month: createNumberField(1, 12),
  period_start_date: z.string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Дата должна быть в формате YYYY-MM-DD')
    .optional(),
  period_end_date: z.string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Дата должна быть в формате YYYY-MM-DD')
    .optional(),
  user_id: userIdField.optional(),
}).refine(
  (data) => {
    if (data.period_start_date && data.period_end_date) {
      return new Date(data.period_start_date) <= new Date(data.period_end_date);
    }
    return true;
  },
  {
    message: 'Дата начала должна быть раньше даты окончания',
    path: ['period_end_date'],
  }
);

export type PeriodFormData = z.infer<typeof periodSchema>;


// Registry (Budget/Fact) validation schema
export const registrySchema = z.object({
  period_id: idField,
  financial_center_id: idField,
  cost_center_id: idField,
  nomenclature_id: idField,
  row_type: z.enum(['plan', 'fact'], {
    required_error: messages.required_error,
    invalid_type_error: messages.invalid_enum,
  }),
  amount: z.number({
    required_error: messages.required_error,
    invalid_type_error: messages.invalid_number,
  }),
  description: createOptionalStringField(1000),
  user_id: userIdField.optional(),
});

export type RegistryFormData = z.infer<typeof registrySchema>;

// User Settings validation schema
export const userSettingsSchema = z.object({
  user_name: createStringField(2, 50),
  first_name: createOptionalStringField(50),
  last_name: createOptionalStringField(50),
  email: z.string()
    .email(messages.invalid_email)
    .optional()
    .or(z.literal('')),
  timezone: z.string()
    .min(1, messages.min_length(1))
    .optional(),
  currency: z.string()
    .length(3, 'Код валюты должен содержать 3 символа')
    .optional(),
  language: z.enum(['ru', 'en'], {
    invalid_type_error: messages.invalid_enum,
  }).default('ru'),
  notifications_enabled: z.boolean().default(true),
  theme: z.enum(['light', 'dark', 'auto'], {
    invalid_type_error: messages.invalid_enum,
  }).default('light'),
});

export type UserSettingsFormData = z.infer<typeof userSettingsSchema>;

// Auto-categorization rule schema
export const autoCategorizationRuleSchema = z.object({
  rule_type: z.enum(['contains', 'starts_with', 'ends_with', 'equals', 'regex'], {
    required_error: messages.required_error,
    invalid_type_error: messages.invalid_enum,
  }),
  pattern: createStringField(1, 200),
  case_sensitive: z.boolean().default(false),
  priority: createNumberField(1, 100),
}).refine(
  (data) => {
    if (data.rule_type === 'regex') {
      try {
        new RegExp(data.pattern);
        return true;
      } catch {
        return false;
      }
    }
    return true;
  },
  {
    message: 'Некорректное регулярное выражение',
    path: ['pattern'],
  }
);

export type AutoCategorizationRuleFormData = z.infer<typeof autoCategorizationRuleSchema>;

// Bulk import schemas
export const bulkImportSchema = z.object({
  file_type: z.enum(['csv', 'json', 'excel'], {
    required_error: messages.required_error,
  }),
  overwrite_existing: z.boolean().default(false),
  validate_references: z.boolean().default(true),
});

export type BulkImportFormData = z.infer<typeof bulkImportSchema>;

// Search and filter schemas
export const searchFilterSchema = z.object({
  query: z.string().optional(),
  status: z.enum(['all', 'active', 'inactive']).default('all'),
  type: z.string().optional(),
  date_from: z.string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Дата должна быть в формате YYYY-MM-DD')
    .optional(),
  date_to: z.string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Дата должна быть в формате YYYY-MM-DD')
    .optional(),
  amount_from: createNonNegativeNumberField().optional(),
  amount_to: createNonNegativeNumberField().optional(),
}).refine(
  (data) => {
    if (data.date_from && data.date_to) {
      return new Date(data.date_from) <= new Date(data.date_to);
    }
    return true;
  },
  {
    message: 'Дата начала должна быть раньше даты окончания',
    path: ['date_to'],
  }
).refine(
  (data) => {
    if (data.amount_from !== undefined && data.amount_to !== undefined) {
      return data.amount_from <= data.amount_to;
    }
    return true;
  },
  {
    message: 'Минимальная сумма должна быть меньше максимальной',
    path: ['amount_to'],
  }
);

export type SearchFilterFormData = z.infer<typeof searchFilterSchema>;

// Password validation for non-Telegram users
export const passwordSchema = z.object({
  current_password: createStringField(1, 255),
  new_password: createStringField(8, 255)
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, 
      'Пароль должен содержать минимум 1 строчную букву, 1 заглавную букву и 1 цифру'),
  confirm_password: createStringField(1, 255),
}).refine((data) => data.new_password === data.confirm_password, {
  message: 'Пароли не совпадают',
  path: ['confirm_password'],
});

export type PasswordFormData = z.infer<typeof passwordSchema>;

// Export all schemas for easy access
export const schemas = {
  nomenclature: nomenclatureSchema,
  financialCenter: financialCenterSchema,
  costCenter: costCenterSchema,
  period: periodSchema,
  registry: registrySchema,
  userSettings: userSettingsSchema,
  autoCategorizationRule: autoCategorizationRuleSchema,
  bulkImport: bulkImportSchema,
  searchFilter: searchFilterSchema,
  password: passwordSchema,
};

// Validation error utility
export class ValidationError extends Error {
  public errors: Record<string, string>;
  
  constructor(errors: Record<string, string>) {
    super('Validation failed');
    this.name = 'ValidationError';
    this.errors = errors;
  }
}

// Helper function to format Zod errors
export function formatZodErrors(error: z.ZodError): Record<string, string> {
  const errors: Record<string, string> = {};
  
  error.errors.forEach((err) => {
    const path = err.path.join('.');
    errors[path] = err.message;
  });
  
  return errors;
}

// Async validation utilities for unique checks
export const asyncValidators = {
  // Check if nomenclature name is unique
  async isNomenclatureNameUnique(name: string, excludeId?: number, userId?: number): Promise<boolean> {
    // This would call the API to check uniqueness
    // Implementation depends on your API service
    return true; // Placeholder
  },
  
  // Check if cost center name is unique within financial center
  async isCostCenterNameUnique(name: string, financialCenterId?: number, excludeId?: number, userId?: number): Promise<boolean> {
    return true; // Placeholder
  },
  
  // Check if period already exists
  async isPeriodUnique(year: number, month: number, excludeId?: number, userId?: number): Promise<boolean> {
    return true; // Placeholder
  },
  
  // Check if product barcode is unique
  async isProductBarcodeUnique(barcode: string, excludeId?: number): Promise<boolean> {
    return true; // Placeholder
  }
};