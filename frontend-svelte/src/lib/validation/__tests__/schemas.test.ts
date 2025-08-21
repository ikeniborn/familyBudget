import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import {
  nomenclatureSchema,
  financialCenterSchema,
  costCenterSchema,
  periodSchema,
  productSchema,
  registrySchema,
  userSettingsSchema,
  passwordSchema,
  formatZodErrors,
  ValidationError,
} from '../schemas';

describe('Validation Schemas', () => {
  describe('nomenclatureSchema', () => {
    const validData = {
      nomenclature_name: 'Test Category',
      nomenclature_type: 'EXPENSE' as const,
      nomenclature_order: 1,
      is_active: true,
    };

    it('should validate correct nomenclature data', () => {
      expect(() => nomenclatureSchema.parse(validData)).not.toThrow();
    });

    it('should require nomenclature_name', () => {
      const { nomenclature_name, ...withoutName } = validData;
      
      expect(() => nomenclatureSchema.parse(withoutName)).toThrow();
    });

    it('should enforce minimum name length', () => {
      const shortName = { ...validData, nomenclature_name: 'ab' };
      
      expect(() => nomenclatureSchema.parse(shortName)).toThrow();
    });

    it('should enforce maximum name length', () => {
      const longName = { ...validData, nomenclature_name: 'a'.repeat(101) };
      
      expect(() => nomenclatureSchema.parse(longName)).toThrow();
    });

    it('should validate nomenclature_type enum', () => {
      const invalidType = { ...validData, nomenclature_type: 'INVALID' };
      
      expect(() => nomenclatureSchema.parse(invalidType)).toThrow();
    });

    it('should accept valid color hex codes', () => {
      const withColor = { ...validData, color: '#FF0000' };
      
      expect(() => nomenclatureSchema.parse(withColor)).not.toThrow();
    });

    it('should reject invalid color formats', () => {
      const invalidColor = { ...validData, color: 'red' };
      
      expect(() => nomenclatureSchema.parse(invalidColor)).toThrow();
    });

    it('should accept optional parent_id', () => {
      const withParent = { ...validData, parent_id: 5 };
      
      expect(() => nomenclatureSchema.parse(withParent)).not.toThrow();
    });

    it('should reject negative parent_id', () => {
      const negativeParent = { ...validData, parent_id: -1 };
      
      expect(() => nomenclatureSchema.parse(negativeParent)).toThrow();
    });
  });

  describe('financialCenterSchema', () => {
    const validData = {
      financial_center_name: 'Test Financial Center',
      financial_center_order: 1,
      is_active: true,
    };

    it('should validate correct financial center data', () => {
      expect(() => financialCenterSchema.parse(validData)).not.toThrow();
    });

    it('should accept optional description', () => {
      const withDescription = {
        ...validData,
        financial_center_description: 'Test description'
      };
      
      expect(() => financialCenterSchema.parse(withDescription)).not.toThrow();
    });

    it('should enforce description length limit', () => {
      const longDescription = {
        ...validData,
        financial_center_description: 'a'.repeat(501)
      };
      
      expect(() => financialCenterSchema.parse(longDescription)).toThrow();
    });
  });

  describe('costCenterSchema', () => {
    const validData = {
      cost_center_name: 'Test Cost Center',
      cost_center_order: 1,
      is_active: true,
    };

    it('should validate correct cost center data', () => {
      expect(() => costCenterSchema.parse(validData)).not.toThrow();
    });

    it('should accept valid budget_limit', () => {
      const withBudget = { ...validData, budget_limit: 10000 };
      
      expect(() => costCenterSchema.parse(withBudget)).not.toThrow();
    });

    it('should reject negative budget_limit', () => {
      const negativeBudget = { ...validData, budget_limit: -100 };
      
      expect(() => costCenterSchema.parse(negativeBudget)).toThrow();
    });

    it('should validate budget_period enum', () => {
      const validPeriods = ['monthly', 'quarterly', 'yearly'];
      
      validPeriods.forEach(period => {
        const withPeriod = { ...validData, budget_period: period };
        expect(() => costCenterSchema.parse(withPeriod)).not.toThrow();
      });
    });

    it('should reject invalid budget_period', () => {
      const invalidPeriod = { ...validData, budget_period: 'daily' };
      
      expect(() => costCenterSchema.parse(invalidPeriod)).toThrow();
    });
  });

  describe('periodSchema', () => {
    const validData = {
      period_name: 'January 2024',
      period_year: 2024,
      period_month: 1,
    };

    it('should validate correct period data', () => {
      expect(() => periodSchema.parse(validData)).not.toThrow();
    });

    it('should enforce year range', () => {
      const invalidYear = { ...validData, period_year: 2019 };
      
      expect(() => periodSchema.parse(invalidYear)).toThrow();
    });

    it('should enforce month range', () => {
      const invalidMonth = { ...validData, period_month: 13 };
      
      expect(() => periodSchema.parse(invalidMonth)).toThrow();
    });

    it('should validate date format', () => {
      const validDates = {
        ...validData,
        period_start_date: '2024-01-01',
        period_end_date: '2024-01-31'
      };
      
      expect(() => periodSchema.parse(validDates)).not.toThrow();
    });

    it('should reject invalid date format', () => {
      const invalidDateFormat = {
        ...validData,
        period_start_date: '01/01/2024'
      };
      
      expect(() => periodSchema.parse(invalidDateFormat)).toThrow();
    });

    it('should validate date range logic', () => {
      const invalidRange = {
        ...validData,
        period_start_date: '2024-01-31',
        period_end_date: '2024-01-01'
      };
      
      expect(() => periodSchema.parse(invalidRange)).toThrow();
    });
  });

  describe('productSchema', () => {
    const validData = {
      name: 'Test Product',
    };

    it('should validate correct product data', () => {
      expect(() => productSchema.parse(validData)).not.toThrow();
    });

    it('should enforce minimum name length', () => {
      const shortName = { ...validData, name: 'a' };
      
      expect(() => productSchema.parse(shortName)).toThrow();
    });

    it('should validate barcode format', () => {
      const validBarcode = { ...validData, barcode: '1234567890123' };
      
      expect(() => productSchema.parse(validBarcode)).not.toThrow();
    });

    it('should reject invalid barcode format', () => {
      const invalidBarcode = { ...validData, barcode: 'abcd' };
      
      expect(() => productSchema.parse(invalidBarcode)).toThrow();
    });

    it('should accept empty barcode', () => {
      const emptyBarcode = { ...validData, barcode: '' };
      
      expect(() => productSchema.parse(emptyBarcode)).not.toThrow();
    });
  });

  describe('registrySchema', () => {
    const validData = {
      period_id: 1,
      financial_center_id: 1,
      cost_center_id: 1,
      nomenclature_id: 1,
      row_type: 'plan' as const,
      amount: 1000,
    };

    it('should validate correct registry data', () => {
      expect(() => registrySchema.parse(validData)).not.toThrow();
    });

    it('should require all required fields', () => {
      const requiredFields = [
        'period_id',
        'financial_center_id', 
        'cost_center_id',
        'nomenclature_id',
        'row_type',
        'amount'
      ];
      
      requiredFields.forEach(field => {
        const { [field]: _, ...withoutField } = validData as any;
        expect(() => registrySchema.parse(withoutField)).toThrow();
      });
    });

    it('should validate row_type enum', () => {
      const validTypes = ['plan', 'fact'];
      
      validTypes.forEach(type => {
        const withType = { ...validData, row_type: type };
        expect(() => registrySchema.parse(withType)).not.toThrow();
      });
    });

    it('should accept negative amounts', () => {
      const negativeAmount = { ...validData, amount: -500 };
      
      expect(() => registrySchema.parse(negativeAmount)).not.toThrow();
    });
  });

  describe('userSettingsSchema', () => {
    const validData = {
      user_name: 'testuser',
    };

    it('should validate correct user settings data', () => {
      expect(() => userSettingsSchema.parse(validData)).not.toThrow();
    });

    it('should validate email format', () => {
      const validEmail = { ...validData, email: 'test@example.com' };
      
      expect(() => userSettingsSchema.parse(validEmail)).not.toThrow();
    });

    it('should reject invalid email format', () => {
      const invalidEmail = { ...validData, email: 'invalid-email' };
      
      expect(() => userSettingsSchema.parse(invalidEmail)).toThrow();
    });

    it('should validate currency code length', () => {
      const validCurrency = { ...validData, currency: 'USD' };
      
      expect(() => userSettingsSchema.parse(validCurrency)).not.toThrow();
    });

    it('should reject invalid currency code length', () => {
      const invalidCurrency = { ...validData, currency: 'US' };
      
      expect(() => userSettingsSchema.parse(invalidCurrency)).toThrow();
    });

    it('should validate language enum', () => {
      const validLanguages = ['ru', 'en'];
      
      validLanguages.forEach(lang => {
        const withLang = { ...validData, language: lang };
        expect(() => userSettingsSchema.parse(withLang)).not.toThrow();
      });
    });
  });

  describe('passwordSchema', () => {
    const validData = {
      current_password: 'currentPass123',
      new_password: 'NewPass123',
      confirm_password: 'NewPass123',
    };

    it('should validate correct password data', () => {
      expect(() => passwordSchema.parse(validData)).not.toThrow();
    });

    it('should enforce password complexity', () => {
      const weakPassword = {
        ...validData,
        new_password: 'weak',
        confirm_password: 'weak'
      };
      
      expect(() => passwordSchema.parse(weakPassword)).toThrow();
    });

    it('should require password confirmation match', () => {
      const mismatchedPasswords = {
        ...validData,
        confirm_password: 'DifferentPass123'
      };
      
      expect(() => passwordSchema.parse(mismatchedPasswords)).toThrow();
    });

    it('should enforce minimum password length', () => {
      const shortPassword = {
        ...validData,
        new_password: 'Pass1',
        confirm_password: 'Pass1'
      };
      
      expect(() => passwordSchema.parse(shortPassword)).toThrow();
    });
  });

  describe('formatZodErrors', () => {
    it('should format Zod errors correctly', () => {
      try {
        nomenclatureSchema.parse({});
      } catch (error) {
        if (error instanceof z.ZodError) {
          const formatted = formatZodErrors(error);
          
          expect(formatted).toHaveProperty('nomenclature_name');
          expect(formatted).toHaveProperty('nomenclature_type');
          expect(formatted).toHaveProperty('nomenclature_order');
          expect(typeof formatted['nomenclature_name']).toBe('string');
        }
      }
    });

    it('should handle nested field errors', () => {
      try {
        periodSchema.parse({
          period_name: 'Test',
          period_year: 2024,
          period_month: 1,
          period_start_date: '2024-01-31',
          period_end_date: '2024-01-01'
        });
      } catch (error) {
        if (error instanceof z.ZodError) {
          const formatted = formatZodErrors(error);
          
          expect(formatted).toHaveProperty('period_end_date');
          expect(formatted['period_end_date']).toContain('раньше');
        }
      }
    });
  });

  describe('ValidationError', () => {
    it('should create validation error with errors object', () => {
      const errors = { field1: 'Error 1', field2: 'Error 2' };
      const validationError = new ValidationError(errors);
      
      expect(validationError.name).toBe('ValidationError');
      expect(validationError.message).toBe('Validation failed');
      expect(validationError.errors).toEqual(errors);
    });
  });

  describe('Russian Error Messages', () => {
    it('should provide Russian error messages', () => {
      try {
        nomenclatureSchema.parse({});
      } catch (error) {
        if (error instanceof z.ZodError) {
          const formatted = formatZodErrors(error);
          
          // Check that error messages are in Russian
          Object.values(formatted).forEach(message => {
            expect(message).toMatch(/[а-яё]/i); // Contains Cyrillic characters
          });
        }
      }
    });

    it('should provide context-specific error messages', () => {
      try {
        nomenclatureSchema.parse({
          nomenclature_name: 'ab', // Too short
          nomenclature_type: 'INCOME',
          nomenclature_order: 1
        });
      } catch (error) {
        if (error instanceof z.ZodError) {
          const formatted = formatZodErrors(error);
          
          expect(formatted['nomenclature_name']).toContain('Минимум 3 символов');
        }
      }
    });
  });

  describe('Optional Fields', () => {
    it('should handle optional fields correctly', () => {
      const dataWithOptionals = {
        nomenclature_name: 'Test',
        nomenclature_type: 'EXPENSE' as const,
        nomenclature_order: 1,
        color: '',
        icon: '',
        parent_id: null
      };
      
      expect(() => nomenclatureSchema.parse(dataWithOptionals)).not.toThrow();
    });

    it('should handle undefined optional fields', () => {
      const dataWithUndefined = {
        nomenclature_name: 'Test',
        nomenclature_type: 'EXPENSE' as const,
        nomenclature_order: 1,
        color: undefined,
        icon: undefined,
        parent_id: undefined
      };
      
      expect(() => nomenclatureSchema.parse(dataWithUndefined)).not.toThrow();
    });
  });
});