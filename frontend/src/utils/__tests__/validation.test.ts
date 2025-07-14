import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import {
  ValidationResult,
  ValidationRule,
  ValidationConfig,
  createValidator,
  combineValidators,
  createAsyncValidator,
  validateRequired,
  validateMinLength,
  validateMaxLength,
  validatePattern,
  validateEmail,
  validateDateRange,
  validateUnique,
  validateBusinessRules,
  validateReferentialIntegrity,
  createCrossFieldValidator,
  createConditionalValidator,
  batchValidate,
  createValidationSchema,
  cacheAsyncValidation
} from '../validation';
import { Period, FinancialCenter } from '../../services/referenceDataService';

describe('Validation Utils', () => {
  describe('Basic validators', () => {
    describe('validateRequired', () => {
      it('should pass for non-empty values', () => {
        expect(validateRequired('test')).toEqual({ isValid: true });
        expect(validateRequired(123)).toEqual({ isValid: true });
        expect(validateRequired(['item'])).toEqual({ isValid: true });
        expect(validateRequired({ key: 'value' })).toEqual({ isValid: true });
      });

      it('should fail for empty values', () => {
        expect(validateRequired('')).toEqual({
          isValid: false,
          errors: ['Это поле обязательно для заполнения']
        });
        expect(validateRequired(null)).toEqual({
          isValid: false,
          errors: ['Это поле обязательно для заполнения']
        });
        expect(validateRequired(undefined)).toEqual({
          isValid: false,
          errors: ['Это поле обязательно для заполнения']
        });
        expect(validateRequired([])).toEqual({
          isValid: false,
          errors: ['Это поле обязательно для заполнения']
        });
      });

      it('should use custom error message', () => {
        const result = validateRequired('', 'Введите название');
        expect(result.errors).toEqual(['Введите название']);
      });
    });

    describe('validateMinLength', () => {
      it('should pass for valid lengths', () => {
        expect(validateMinLength('test', 3)).toEqual({ isValid: true });
        expect(validateMinLength('test', 4)).toEqual({ isValid: true });
        expect(validateMinLength([1, 2, 3], 2)).toEqual({ isValid: true });
      });

      it('should fail for invalid lengths', () => {
        expect(validateMinLength('hi', 3)).toEqual({
          isValid: false,
          errors: ['Минимальная длина: 3']
        });
        expect(validateMinLength([], 1)).toEqual({
          isValid: false,
          errors: ['Минимальная длина: 1']
        });
      });
    });

    describe('validateMaxLength', () => {
      it('should pass for valid lengths', () => {
        expect(validateMaxLength('test', 5)).toEqual({ isValid: true });
        expect(validateMaxLength('test', 4)).toEqual({ isValid: true });
      });

      it('should fail for invalid lengths', () => {
        expect(validateMaxLength('hello', 4)).toEqual({
          isValid: false,
          errors: ['Максимальная длина: 4']
        });
      });
    });

    describe('validatePattern', () => {
      it('should validate against regex patterns', () => {
        const digitPattern = /^\d+$/;
        
        expect(validatePattern('123', digitPattern)).toEqual({ isValid: true });
        expect(validatePattern('abc', digitPattern)).toEqual({
          isValid: false,
          errors: ['Неверный формат']
        });
      });

      it('should use custom error message', () => {
        const result = validatePattern('abc', /^\d+$/, 'Только цифры');
        expect(result.errors).toEqual(['Только цифры']);
      });
    });

    describe('validateEmail', () => {
      it('should validate email addresses', () => {
        expect(validateEmail('test@example.com')).toEqual({ isValid: true });
        expect(validateEmail('user.name+tag@domain.co.uk')).toEqual({ isValid: true });
        
        expect(validateEmail('invalid')).toEqual({
          isValid: false,
          errors: ['Неверный формат email']
        });
        expect(validateEmail('@example.com')).toEqual({
          isValid: false,
          errors: ['Неверный формат email']
        });
      });
    });

    describe('validateDateRange', () => {
      it('should validate date ranges', () => {
        const startDate = new Date('2024-01-01');
        const endDate = new Date('2024-12-31');
        
        expect(validateDateRange(startDate, endDate)).toEqual({ isValid: true });
        
        expect(validateDateRange(endDate, startDate)).toEqual({
          isValid: false,
          errors: ['Дата начала должна быть раньше даты окончания']
        });
      });
    });
  });

  describe('Business rule validators', () => {
    describe('validateUnique', () => {
      it('should check uniqueness in array', () => {
        const items = [
          { id: 1, name: 'Item 1' },
          { id: 2, name: 'Item 2' }
        ];
        
        expect(validateUnique('Item 3', 'name', items)).toEqual({ isValid: true });
        
        expect(validateUnique('Item 1', 'name', items)).toEqual({
          isValid: false,
          errors: ['Значение должно быть уникальным']
        });
      });

      it('should exclude current item when checking', () => {
        const items = [
          { id: 1, name: 'Item 1' },
          { id: 2, name: 'Item 2' }
        ];
        
        const result = validateUnique('Item 1', 'name', items, 1);
        expect(result.isValid).toBe(true);
      });
    });

    describe('validateBusinessRules', () => {
      it('should validate period dates', () => {
        const period: Period = {
          period_id: 1,
          period_name: 'Январь 2024',
          period_year: 2024,
          period_month: 13, // Invalid month
          period_order: 202413,
          user_id: 1,
          is_active: true,
          created_at: '',
          updated_at: ''
        };
        
        const result = validateBusinessRules(period, 'period');
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Месяц должен быть от 1 до 12');
      });

      it('should validate budget limits', () => {
        const costCenter = {
          cost_center_id: 1,
          cost_center_name: 'Test',
          budget_limit: -1000,
          budget_period: 'monthly'
        };
        
        const result = validateBusinessRules(costCenter, 'cost_center');
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Бюджетный лимит не может быть отрицательным');
      });

      it('should validate nomenclature color format', () => {
        const nomenclature = {
          nomenclature_id: 1,
          nomenclature_name: 'Test',
          color: 'invalid-color'
        };
        
        const result = validateBusinessRules(nomenclature, 'nomenclature');
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Неверный формат цвета');
      });
    });

    describe('validateReferentialIntegrity', () => {
      it('should check cost center references', async () => {
        const costCenter = {
          cost_center_id: 1,
          cost_center_name: 'Test',
          financial_center_id: 99
        };
        
        const financialCenters: FinancialCenter[] = [
          { financial_center_id: 1, financial_center_name: 'FC1' } as FinancialCenter,
          { financial_center_id: 2, financial_center_name: 'FC2' } as FinancialCenter
        ];
        
        const checkExists = jest.fn().mockResolvedValue(false);
        
        const result = await validateReferentialIntegrity(
          costCenter,
          'cost_center',
          { financial_centers: financialCenters },
          checkExists
        );
        
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Финансовый центр не найден');
      });

      it('should pass for valid references', async () => {
        const costCenter = {
          cost_center_id: 1,
          cost_center_name: 'Test',
          financial_center_id: 1
        };
        
        const financialCenters: FinancialCenter[] = [
          { financial_center_id: 1, financial_center_name: 'FC1' } as FinancialCenter
        ];
        
        const checkExists = jest.fn().mockResolvedValue(true);
        
        const result = await validateReferentialIntegrity(
          costCenter,
          'cost_center',
          { financial_centers: financialCenters },
          checkExists
        );
        
        expect(result.isValid).toBe(true);
      });
    });
  });

  describe('Composite validators', () => {
    describe('createValidator', () => {
      it('should create validator with multiple rules', () => {
        const validator = createValidator<{ name: string; age: number }>([
          {
            field: 'name',
            validators: [
              { validate: (value) => validateRequired(value) },
              { validate: (value) => validateMinLength(value, 3) }
            ]
          },
          {
            field: 'age',
            validators: [
              { validate: (value) => validateRequired(value) },
              {
                validate: (value) => 
                  value >= 18 
                    ? { isValid: true } 
                    : { isValid: false, errors: ['Минимальный возраст: 18'] }
              }
            ]
          }
        ]);
        
        const validResult = validator({ name: 'John', age: 25 });
        expect(validResult.isValid).toBe(true);
        
        const invalidResult = validator({ name: 'Jo', age: 16 });
        expect(invalidResult.isValid).toBe(false);
        expect(invalidResult.fieldErrors?.name).toContain('Минимальная длина: 3');
        expect(invalidResult.fieldErrors?.age).toContain('Минимальный возраст: 18');
      });

      it('should stop on first error when configured', () => {
        const validator = createValidator<{ name: string }>([
          {
            field: 'name',
            validators: [
              { validate: (value) => validateRequired(value) },
              { validate: (value) => validateMinLength(value, 10) }
            ],
            stopOnFirstError: true
          }
        ]);
        
        const result = validator({ name: '' });
        expect(result.fieldErrors?.name).toHaveLength(1);
        expect(result.fieldErrors?.name).toContain('Это поле обязательно для заполнения');
      });
    });

    describe('combineValidators', () => {
      it('should combine multiple validators', () => {
        const validator1 = (value: string) => validateRequired(value);
        const validator2 = (value: string) => validateMinLength(value, 5);
        const validator3 = (value: string) => validatePattern(value, /^[A-Z]/, 'Должно начинаться с заглавной буквы');
        
        const combined = combineValidators(validator1, validator2, validator3);
        
        const result = combined('Hello');
        expect(result.isValid).toBe(true);
        
        const invalidResult = combined('hi');
        expect(invalidResult.isValid).toBe(false);
        expect(invalidResult.errors).toHaveLength(2);
      });
    });

    describe('createAsyncValidator', () => {
      it('should handle async validation', async () => {
        const checkUnique = jest.fn().mockResolvedValue(true);
        const validator = createAsyncValidator(checkUnique, 'Значение уже существует');
        
        const result = await validator('test');
        expect(result.isValid).toBe(true);
        
        checkUnique.mockResolvedValue(false);
        const invalidResult = await validator('test');
        expect(invalidResult.isValid).toBe(false);
        expect(invalidResult.errors).toContain('Значение уже существует');
      });

      it('should handle async validation errors', async () => {
        const checkUnique = jest.fn().mockRejectedValue(new Error('Network error'));
        const validator = createAsyncValidator(checkUnique);
        
        const result = await validator('test');
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Ошибка валидации');
      });
    });
  });

  describe('Advanced validators', () => {
    describe('createCrossFieldValidator', () => {
      it('should validate dependencies between fields', () => {
        const validator = createCrossFieldValidator<{
          password: string;
          confirmPassword: string;
        }>((data) => {
          if (data.password !== data.confirmPassword) {
            return {
              isValid: false,
              fieldErrors: {
                confirmPassword: ['Пароли не совпадают']
              }
            };
          }
          return { isValid: true };
        });
        
        const validResult = validator({
          password: 'secret123',
          confirmPassword: 'secret123'
        });
        expect(validResult.isValid).toBe(true);
        
        const invalidResult = validator({
          password: 'secret123',
          confirmPassword: 'different'
        });
        expect(invalidResult.isValid).toBe(false);
        expect(invalidResult.fieldErrors?.confirmPassword).toContain('Пароли не совпадают');
      });
    });

    describe('createConditionalValidator', () => {
      it('should apply validation conditionally', () => {
        const validator = createConditionalValidator<{ type: string; value?: string }>(
          (data) => data.type === 'required',
          (data) => validateRequired(data.value)
        );
        
        expect(validator({ type: 'optional', value: '' }).isValid).toBe(true);
        expect(validator({ type: 'required', value: '' }).isValid).toBe(false);
      });
    });
  });

  describe('Batch validation', () => {
    it('should validate multiple items', () => {
      const items = [
        { id: 1, name: 'Valid Name' },
        { id: 2, name: '' },
        { id: 3, name: 'OK' }
      ];
      
      const validator = (item: any) => {
        const nameValidation = combineValidators(
          (value: string) => validateRequired(value),
          (value: string) => validateMinLength(value, 3)
        );
        
        return {
          isValid: nameValidation(item.name).isValid,
          errors: nameValidation(item.name).errors || [],
          fieldErrors: { name: nameValidation(item.name).errors || [] }
        };
      };
      
      const results = batchValidate(items, validator);
      
      expect(results.valid).toHaveLength(1);
      expect(results.invalid).toHaveLength(2);
      expect(results.errors[0].index).toBe(1);
      expect(results.errors[1].index).toBe(2);
    });
  });

  describe('Validation schema', () => {
    it('should create and use validation schema', () => {
      const schema = createValidationSchema<{
        name: string;
        email: string;
        age: number;
      }>({
        name: {
          required: true,
          minLength: 3,
          maxLength: 50
        },
        email: {
          required: true,
          email: true
        },
        age: {
          required: true,
          min: 18,
          max: 100
        }
      });
      
      const validData = {
        name: 'John Doe',
        email: 'john@example.com',
        age: 25
      };
      
      expect(schema.validate(validData).isValid).toBe(true);
      
      const invalidData = {
        name: 'Jo',
        email: 'invalid-email',
        age: 15
      };
      
      const result = schema.validate(invalidData);
      expect(result.isValid).toBe(false);
      expect(result.fieldErrors?.name).toBeDefined();
      expect(result.fieldErrors?.email).toBeDefined();
      expect(result.fieldErrors?.age).toBeDefined();
    });
  });

  describe('Caching async validation', () => {
    it('should cache async validation results', async () => {
      const expensiveCheck = jest.fn().mockResolvedValue(true);
      const cachedValidator = cacheAsyncValidation(expensiveCheck, 1000);
      
      // First call
      await cachedValidator('test-value');
      expect(expensiveCheck).toHaveBeenCalledTimes(1);
      
      // Second call should use cache
      await cachedValidator('test-value');
      expect(expensiveCheck).toHaveBeenCalledTimes(1);
      
      // Different value should trigger new call
      await cachedValidator('different-value');
      expect(expensiveCheck).toHaveBeenCalledTimes(2);
    });

    it('should expire cache after TTL', async () => {
      jest.useFakeTimers();
      
      const expensiveCheck = jest.fn().mockResolvedValue(true);
      const cachedValidator = cacheAsyncValidation(expensiveCheck, 100); // 100ms TTL
      
      await cachedValidator('test-value');
      expect(expensiveCheck).toHaveBeenCalledTimes(1);
      
      // Advance time past TTL
      jest.advanceTimersByTime(150);
      
      await cachedValidator('test-value');
      expect(expensiveCheck).toHaveBeenCalledTimes(2);
      
      jest.useRealTimers();
    });
  });
});