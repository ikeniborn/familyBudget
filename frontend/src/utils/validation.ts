import {
  Period,
  FinancialCenter,
  CostCenter,
  Nomenclature,
  Product,
  periodService,
  financialCenterService,
  costCenterService,
  nomenclatureService,
  productService
} from '../services/referenceDataService';

// Validation result types
export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  field: string;
  message: string;
  code: string;
}

export interface ValidationWarning {
  field: string;
  message: string;
  code: string;
}

export interface AsyncValidationResult {
  isValid: boolean;
  error?: ValidationError;
}

// Validation rules interface
export interface ValidationRules<T> {
  required?: (keyof T)[];
  minLength?: Partial<Record<keyof T, number>>;
  maxLength?: Partial<Record<keyof T, number>>;
  min?: Partial<Record<keyof T, number>>;
  max?: Partial<Record<keyof T, number>>;
  pattern?: Partial<Record<keyof T, RegExp>>;
  custom?: Partial<Record<keyof T, (value: any, data: T) => ValidationError | null>>;
  unique?: Partial<Record<keyof T, boolean>>;
  dependencies?: Partial<Record<keyof T, (keyof T)[]>>;
}

// Business rule types
export interface BusinessRule<T> {
  name: string;
  description: string;
  validate: (data: T, context?: any) => ValidationError | ValidationWarning | null;
  type: 'error' | 'warning';
}

export interface ReferentialIntegrityRule {
  sourceField: string;
  targetEntity: string;
  targetField: string;
  cascade?: 'delete' | 'update' | 'restrict';
  message?: string;
}

// Base validator class
abstract class BaseValidator<T> {
  protected abstract rules: ValidationRules<T>;
  protected abstract businessRules: BusinessRule<T>[];
  protected abstract referentialRules: ReferentialIntegrityRule[];

  // Client-side validation
  validate(data: Partial<T>, isUpdate = false): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // Required fields validation
    if (!isUpdate && this.rules.required) {
      for (const field of this.rules.required) {
        if (data[field] === undefined || data[field] === null || data[field] === '') {
          errors.push({
            field: String(field),
            message: `Поле "${String(field)}" обязательно для заполнения`,
            code: 'REQUIRED'
          });
        }
      }
    }

    // Length validation
    if (this.rules.minLength) {
      for (const [field, minLen] of Object.entries(this.rules.minLength)) {
        const value = data[field as keyof T];
        if (typeof value === 'string' && value.length < minLen) {
          errors.push({
            field,
            message: `Минимальная длина поля "${field}": ${minLen} символов`,
            code: 'MIN_LENGTH'
          });
        }
      }
    }

    if (this.rules.maxLength) {
      for (const [field, maxLen] of Object.entries(this.rules.maxLength)) {
        const value = data[field as keyof T];
        if (typeof value === 'string' && value.length > maxLen) {
          errors.push({
            field,
            message: `Максимальная длина поля "${field}": ${maxLen} символов`,
            code: 'MAX_LENGTH'
          });
        }
      }
    }

    // Numeric validation
    if (this.rules.min) {
      for (const [field, minVal] of Object.entries(this.rules.min)) {
        const value = data[field as keyof T];
        if (typeof value === 'number' && value < minVal) {
          errors.push({
            field,
            message: `Минимальное значение поля "${field}": ${minVal}`,
            code: 'MIN_VALUE'
          });
        }
      }
    }

    if (this.rules.max) {
      for (const [field, maxVal] of Object.entries(this.rules.max)) {
        const value = data[field as keyof T];
        if (typeof value === 'number' && value > maxVal) {
          errors.push({
            field,
            message: `Максимальное значение поля "${field}": ${maxVal}`,
            code: 'MAX_VALUE'
          });
        }
      }
    }

    // Pattern validation
    if (this.rules.pattern) {
      for (const [field, pattern] of Object.entries(this.rules.pattern)) {
        const value = data[field as keyof T];
        if (typeof value === 'string' && !pattern.test(value)) {
          errors.push({
            field,
            message: `Неверный формат поля "${field}"`,
            code: 'INVALID_FORMAT'
          });
        }
      }
    }

    // Custom validation
    if (this.rules.custom) {
      for (const [field, validator] of Object.entries(this.rules.custom)) {
        const value = data[field as keyof T];
        const error = validator(value, data as T);
        if (error) {
          errors.push(error);
        }
      }
    }

    // Dependencies validation
    if (this.rules.dependencies) {
      for (const [field, deps] of Object.entries(this.rules.dependencies)) {
        if (data[field as keyof T] !== undefined) {
          for (const dep of deps) {
            if (data[dep] === undefined || data[dep] === null || data[dep] === '') {
              errors.push({
                field: String(dep),
                message: `Поле "${String(dep)}" обязательно при заполнении "${field}"`,
                code: 'DEPENDENCY_REQUIRED'
              });
            }
          }
        }
      }
    }

    // Business rules validation
    for (const rule of this.businessRules) {
      const result = rule.validate(data as T);
      if (result) {
        if (rule.type === 'error') {
          errors.push(result as ValidationError);
        } else {
          warnings.push(result as ValidationWarning);
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  // Async validation for uniqueness and server-side checks
  abstract validateAsync(
    data: Partial<T>,
    userId: number,
    excludeId?: number
  ): Promise<ValidationResult>;

  // Validate referential integrity
  async validateReferentialIntegrity(
    data: T,
    userId: number
  ): Promise<ValidationResult> {
    const errors: ValidationError[] = [];

    for (const rule of this.referentialRules) {
      const sourceValue = (data as any)[rule.sourceField];
      if (sourceValue === null || sourceValue === undefined) continue;

      try {
        let exists = false;
        
        // Check if referenced entity exists
        switch (rule.targetEntity) {
          case 'periods':
            const periods = await periodService.getAll(userId);
            exists = periods.some(p => (p as any)[rule.targetField] === sourceValue);
            break;
          case 'financial_centers':
            const fcs = await financialCenterService.getAll(userId);
            exists = fcs.some(fc => (fc as any)[rule.targetField] === sourceValue);
            break;
          case 'cost_centers':
            const ccs = await costCenterService.getAll(userId);
            exists = ccs.some(cc => (cc as any)[rule.targetField] === sourceValue);
            break;
          case 'nomenclatures':
            const noms = await nomenclatureService.getAll(userId);
            exists = noms.some(n => (n as any)[rule.targetField] === sourceValue);
            break;
          case 'products':
            const products = await productService.getAll(userId);
            exists = products.some(p => (p as any)[rule.targetField] === sourceValue);
            break;
        }

        if (!exists) {
          errors.push({
            field: rule.sourceField,
            message: rule.message || `Ссылка на несуществующий объект в поле "${rule.sourceField}"`,
            code: 'REFERENTIAL_INTEGRITY'
          });
        }
      } catch (error) {
        console.error('Referential integrity check failed:', error);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings: []
    };
  }

  // Check cascade operations
  async checkCascadeOperations(
    id: number,
    operation: 'delete' | 'update',
    userId: number
  ): Promise<{
    canProceed: boolean;
    affectedEntities: string[];
    warnings: string[];
  }> {
    const affectedEntities: string[] = [];
    const warnings: string[] = [];

    // This would be implemented based on specific cascade rules
    // For now, return a basic implementation
    return {
      canProceed: true,
      affectedEntities,
      warnings
    };
  }
}

// Period validator
class PeriodValidator extends BaseValidator<Period> {
  protected rules: ValidationRules<Period> = {
    required: ['period_name', 'period_year', 'period_month', 'period_order'],
    minLength: { period_name: 3 },
    maxLength: { period_name: 100 },
    min: { 
      period_year: new Date().getFullYear() - 5,
      period_month: 1,
      period_order: 1
    },
    max: { 
      period_year: new Date().getFullYear() + 5,
      period_month: 12
    },
    custom: {
      period_year: (value, data) => {
        if (typeof value === 'number' && (value < 2020 || value > 2030)) {
          return {
            field: 'period_year',
            message: 'Год должен быть между 2020 и 2030',
            code: 'INVALID_YEAR'
          };
        }
        return null;
      }
    }
  };

  protected businessRules: BusinessRule<Period>[] = [
    {
      name: 'period_overlap',
      description: 'Периоды не должны пересекаться',
      type: 'error',
      validate: (data) => {
        // This will be checked in async validation
        return null;
      }
    },
    {
      name: 'future_period',
      description: 'Предупреждение о будущих периодах',
      type: 'warning',
      validate: (data) => {
        const currentYear = new Date().getFullYear();
        const currentMonth = new Date().getMonth() + 1;
        
        if (data.period_year > currentYear || 
           (data.period_year === currentYear && data.period_month > currentMonth)) {
          return {
            field: 'period_month',
            message: 'Период относится к будущему времени',
            code: 'FUTURE_PERIOD'
          };
        }
        return null;
      }
    }
  ];

  protected referentialRules: ReferentialIntegrityRule[] = [];

  async validateAsync(
    data: Partial<Period>,
    userId: number,
    excludeId?: number
  ): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    
    // Check for period overlap
    if (data.period_year && data.period_month) {
      try {
        const hasOverlap = await periodService.checkOverlap(
          data.period_year,
          data.period_month,
          userId,
          excludeId
        );
        
        if (hasOverlap) {
          errors.push({
            field: 'period_month',
            message: `Период ${data.period_month}/${data.period_year} уже существует`,
            code: 'PERIOD_OVERLAP'
          });
        }
      } catch (error) {
        console.error('Period overlap check failed:', error);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings: []
    };
  }
}

// Financial Center validator
class FinancialCenterValidator extends BaseValidator<FinancialCenter> {
  protected rules: ValidationRules<FinancialCenter> = {
    required: ['financial_center_name', 'financial_center_order'],
    minLength: { financial_center_name: 3 },
    maxLength: { 
      financial_center_name: 100,
      financial_center_description: 500
    },
    min: { financial_center_order: 1 },
    custom: {
      parent_id: (value, data) => {
        if (value === data.financial_center_id) {
          return {
            field: 'parent_id',
            message: 'ЦФО не может быть родительским для самого себя',
            code: 'CIRCULAR_REFERENCE'
          };
        }
        return null;
      }
    }
  };

  protected businessRules: BusinessRule<FinancialCenter>[] = [
    {
      name: 'max_hierarchy_depth',
      description: 'Максимальная глубина иерархии',
      type: 'warning',
      validate: (data) => {
        // Check hierarchy depth (would need full hierarchy to implement)
        return null;
      }
    }
  ];

  protected referentialRules: ReferentialIntegrityRule[] = [
    {
      sourceField: 'parent_id',
      targetEntity: 'financial_centers',
      targetField: 'financial_center_id',
      cascade: 'restrict'
    }
  ];

  async validateAsync(
    data: Partial<FinancialCenter>,
    userId: number,
    excludeId?: number
  ): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    
    // Check uniqueness of name
    if (data.financial_center_name) {
      try {
        const isUnique = await financialCenterService.validateUnique(
          'financial_center_name',
          data.financial_center_name,
          userId,
          excludeId
        );
        
        if (!isUnique) {
          errors.push({
            field: 'financial_center_name',
            message: 'Финансовый центр с таким названием уже существует',
            code: 'NOT_UNIQUE'
          });
        }
      } catch (error) {
        console.error('Uniqueness check failed:', error);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings: []
    };
  }
}

// Cost Center validator
class CostCenterValidator extends BaseValidator<CostCenter> {
  protected rules: ValidationRules<CostCenter> = {
    required: ['cost_center_name', 'cost_center_order'],
    minLength: { cost_center_name: 3 },
    maxLength: { 
      cost_center_name: 100,
      cost_center_description: 500
    },
    min: { 
      cost_center_order: 1,
      budget_limit: 0
    },
    custom: {
      budget_period: (value, data) => {
        if (data.budget_limit && data.budget_limit > 0 && !value) {
          return {
            field: 'budget_period',
            message: 'Укажите период для бюджетного лимита',
            code: 'BUDGET_PERIOD_REQUIRED'
          };
        }
        return null;
      }
    },
    dependencies: {
      budget_limit: ['budget_period']
    }
  };

  protected businessRules: BusinessRule<CostCenter>[] = [
    {
      name: 'reasonable_budget',
      description: 'Разумный размер бюджета',
      type: 'warning',
      validate: (data) => {
        if (data.budget_limit && data.budget_limit > 10000000) {
          return {
            field: 'budget_limit',
            message: 'Очень большой бюджетный лимит. Проверьте правильность',
            code: 'LARGE_BUDGET'
          };
        }
        return null;
      }
    }
  ];

  protected referentialRules: ReferentialIntegrityRule[] = [
    {
      sourceField: 'financial_center_id',
      targetEntity: 'financial_centers',
      targetField: 'financial_center_id',
      cascade: 'restrict'
    }
  ];

  async validateAsync(
    data: Partial<CostCenter>,
    userId: number,
    excludeId?: number
  ): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    
    // Check uniqueness of name
    if (data.cost_center_name) {
      try {
        const isUnique = await costCenterService.validateUnique(
          'cost_center_name',
          data.cost_center_name,
          userId,
          excludeId
        );
        
        if (!isUnique) {
          errors.push({
            field: 'cost_center_name',
            message: 'Центр затрат с таким названием уже существует',
            code: 'NOT_UNIQUE'
          });
        }
      } catch (error) {
        console.error('Uniqueness check failed:', error);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings: []
    };
  }
}

// Nomenclature validator
class NomenclatureValidator extends BaseValidator<Nomenclature> {
  protected rules: ValidationRules<Nomenclature> = {
    required: ['nomenclature_name', 'nomenclature_type', 'nomenclature_order'],
    minLength: { nomenclature_name: 2 },
    maxLength: { nomenclature_name: 100 },
    min: { nomenclature_order: 1 },
    pattern: {
      color: /^#[0-9A-Fa-f]{6}$/
    },
    custom: {
      parent_id: (value, data) => {
        if (value === data.nomenclature_id) {
          return {
            field: 'parent_id',
            message: 'Категория не может быть родительской для самой себя',
            code: 'CIRCULAR_REFERENCE'
          };
        }
        return null;
      }
    }
  };

  protected businessRules: BusinessRule<Nomenclature>[] = [
    {
      name: 'parent_type_match',
      description: 'Тип родительской категории должен совпадать',
      type: 'error',
      validate: (data) => {
        // This would need to check parent type in async validation
        return null;
      }
    }
  ];

  protected referentialRules: ReferentialIntegrityRule[] = [
    {
      sourceField: 'parent_id',
      targetEntity: 'nomenclatures',
      targetField: 'nomenclature_id',
      cascade: 'restrict'
    }
  ];

  async validateAsync(
    data: Partial<Nomenclature>,
    userId: number,
    excludeId?: number
  ): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    
    // Check uniqueness of name within type
    if (data.nomenclature_name && data.nomenclature_type) {
      try {
        const all = await nomenclatureService.getAll(userId);
        const duplicate = all.find(n => 
          n.nomenclature_name === data.nomenclature_name &&
          n.nomenclature_type === data.nomenclature_type &&
          (excludeId === undefined || n.nomenclature_id !== excludeId)
        );
        
        if (duplicate) {
          errors.push({
            field: 'nomenclature_name',
            message: 'Категория с таким названием уже существует в данном типе',
            code: 'NOT_UNIQUE'
          });
        }
      } catch (error) {
        console.error('Uniqueness check failed:', error);
      }
    }

    // Check parent type compatibility
    if (data.parent_id && data.nomenclature_type) {
      try {
        const parent = await nomenclatureService.getById(data.parent_id, userId);
        if (parent.nomenclature_type !== data.nomenclature_type) {
          errors.push({
            field: 'parent_id',
            message: 'Родительская категория должна быть того же типа',
            code: 'PARENT_TYPE_MISMATCH'
          });
        }
      } catch (error) {
        console.error('Parent type check failed:', error);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings: []
    };
  }
}

// Product validator
class ProductValidator extends BaseValidator<Product> {
  protected rules: ValidationRules<Product> = {
    required: ['product_name'],
    minLength: { product_name: 2 },
    maxLength: { 
      product_name: 200,
      product_description: 1000
    },
    pattern: {
      barcode: /^\d{8,13}$/
    }
  };

  protected businessRules: BusinessRule<Product>[] = [
    {
      name: 'barcode_format',
      description: 'Формат штрихкода',
      type: 'warning',
      validate: (data) => {
        if (data.barcode && data.barcode.length !== 13) {
          return {
            field: 'barcode',
            message: 'Рекомендуется использовать 13-значный штрихкод (EAN-13)',
            code: 'BARCODE_FORMAT'
          };
        }
        return null;
      }
    }
  ];

  protected referentialRules: ReferentialIntegrityRule[] = [
    {
      sourceField: 'category_ids',
      targetEntity: 'nomenclatures',
      targetField: 'nomenclature_id',
      cascade: 'restrict'
    }
  ];

  async validateAsync(
    data: Partial<Product>,
    userId: number,
    excludeId?: number
  ): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    
    // Check barcode uniqueness
    if (data.barcode) {
      try {
        const isUnique = await productService.validateUnique(
          'barcode',
          data.barcode,
          userId,
          excludeId
        );
        
        if (!isUnique) {
          errors.push({
            field: 'barcode',
            message: 'Продукт с таким штрихкодом уже существует',
            code: 'NOT_UNIQUE'
          });
        }
      } catch (error) {
        console.error('Barcode uniqueness check failed:', error);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings: []
    };
  }
}

// Export validators
export const periodValidator = new PeriodValidator();
export const financialCenterValidator = new FinancialCenterValidator();
export const costCenterValidator = new CostCenterValidator();
export const nomenclatureValidator = new NomenclatureValidator();
export const productValidator = new ProductValidator();

// Comprehensive validation function
export async function validateReferenceData<T>(
  type: 'period' | 'financial_center' | 'cost_center' | 'nomenclature' | 'product',
  data: Partial<T>,
  userId: number,
  isUpdate = false,
  excludeId?: number
): Promise<ValidationResult> {
  let validator: BaseValidator<any>;
  
  switch (type) {
    case 'period':
      validator = periodValidator;
      break;
    case 'financial_center':
      validator = financialCenterValidator;
      break;
    case 'cost_center':
      validator = costCenterValidator;
      break;
    case 'nomenclature':
      validator = nomenclatureValidator;
      break;
    case 'product':
      validator = productValidator;
      break;
    default:
      throw new Error(`Unknown validation type: ${type}`);
  }
  
  // Client-side validation
  const clientResult = validator.validate(data, isUpdate);
  if (!clientResult.isValid) {
    return clientResult;
  }
  
  // Async validation
  const asyncResult = await validator.validateAsync(data, userId, excludeId);
  if (!asyncResult.isValid) {
    return {
      isValid: false,
      errors: [...clientResult.errors, ...asyncResult.errors],
      warnings: [...clientResult.warnings, ...asyncResult.warnings]
    };
  }
  
  // Referential integrity validation
  const refResult = await validator.validateReferentialIntegrity(data as T, userId);
  
  return {
    isValid: refResult.isValid,
    errors: [...clientResult.errors, ...asyncResult.errors, ...refResult.errors],
    warnings: [...clientResult.warnings, ...asyncResult.warnings, ...refResult.warnings]
  };
}