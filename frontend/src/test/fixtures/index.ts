import { User } from '@/types/user';
import { Period } from '@/types/period';
import { FinancialCenter } from '@/types/financialCenter';
import { CostCenter } from '@/types/costCenter';
import { Nomenclature } from '@/types/nomenclature';
import { RowType } from '@/types/rowType';
import { RegistryEntry } from '@/types/registry';
import { Product, ProductPrice, ProductNomenclature } from '@/types/product';

// User fixtures
export const userFixtures = {
  activeUser: {
    id: 1,
    name: 'Test User',
    username: 'testuser',
    email: 'test@example.com',
    telegram_id: 123456789,
    telegram_first_name: 'Test',
    telegram_last_name: 'User',
    telegram_username: 'testuser',
    telegram_photo_url: 'https://example.com/photo.jpg',
    telegram_auth_date: '2024-01-01T00:00:00Z',
    is_active: true,
    is_bot: false,
    language_code: 'en',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  } as User,
  
  inactiveUser: {
    id: 2,
    name: 'Inactive User',
    username: 'inactiveuser',
    email: 'inactive@example.com',
    telegram_id: 987654321,
    telegram_first_name: 'Inactive',
    telegram_last_name: 'User',
    telegram_username: 'inactiveuser',
    telegram_photo_url: null,
    telegram_auth_date: '2024-01-01T00:00:00Z',
    is_active: false,
    is_bot: false,
    language_code: 'ru',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  } as User,
};

// Period fixtures
export const periodFixtures = {
  january2024: {
    id: 1,
    date_start: '2024-01-01',
    date_end: '2024-01-31',
    is_open: true,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  } as Period,
  
  february2024: {
    id: 2,
    date_start: '2024-02-01',
    date_end: '2024-02-29',
    is_open: false,
    created_at: '2024-02-01T00:00:00Z',
    updated_at: '2024-02-01T00:00:00Z',
  } as Period,
};

// Financial Center fixtures
export const financialCenterFixtures = {
  family: {
    id: 1,
    name: 'Семья',
    description: 'Семейный бюджет',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  } as FinancialCenter,
  
  personal: {
    id: 2,
    name: 'Личный',
    description: 'Личные расходы',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  } as FinancialCenter,
};

// Cost Center fixtures
export const costCenterFixtures = {
  husband: {
    id: 1,
    name: 'Муж',
    financial_center_id: 1,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  } as CostCenter,
  
  wife: {
    id: 2,
    name: 'Жена',
    financial_center_id: 1,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  } as CostCenter,
};

// Nomenclature fixtures
export const nomenclatureFixtures = {
  food: {
    id: 1,
    name: 'Продукты питания',
    nomenclature_group: 'Расходы',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  } as Nomenclature,
  
  transport: {
    id: 2,
    name: 'Транспорт',
    nomenclature_group: 'Расходы',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  } as Nomenclature,
  
  salary: {
    id: 3,
    name: 'Зарплата',
    nomenclature_group: 'Доходы',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  } as Nomenclature,
};

// Row Type fixtures
export const rowTypeFixtures = {
  plan: {
    id: 1,
    name: 'План',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  } as RowType,
  
  fact: {
    id: 2,
    name: 'Факт',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  } as RowType,
};

// Registry Entry fixtures
export const registryFixtures = {
  planEntry: {
    id: 1,
    user_id: 1,
    period_id: 1,
    financial_center_id: 1,
    cost_center_id: 1,
    nomenclature_id: 1,
    row_type_id: 1,
    amount: 5000,
    comment: 'Планируемые расходы на продукты',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  } as RegistryEntry,
  
  factEntry: {
    id: 2,
    user_id: 1,
    period_id: 1,
    financial_center_id: 1,
    cost_center_id: 1,
    nomenclature_id: 1,
    row_type_id: 2,
    amount: 4500,
    comment: 'Фактические расходы на продукты',
    created_at: '2024-01-15T00:00:00Z',
    updated_at: '2024-01-15T00:00:00Z',
  } as RegistryEntry,
};

// Product fixtures
export const productFixtures = {
  milk: {
    id: 1,
    name: 'Молоко 3.2%',
    barcode: '4607177761516',
    brand: 'Простоквашино',
    description: 'Молоко пастеризованное 3.2% жирности',
    unit: 'л',
    category: 'Молочные продукты',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  } as Product,
  
  bread: {
    id: 2,
    name: 'Хлеб белый',
    barcode: '4607177761523',
    brand: 'Бородинский',
    description: 'Хлеб пшеничный нарезной',
    unit: 'шт',
    category: 'Хлебобулочные изделия',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  } as Product,
};

// Product Price fixtures
export const productPriceFixtures = {
  milkPrice: {
    id: 1,
    product_id: 1,
    price: 89.99,
    date: '2024-01-01',
    store: 'Пятерочка',
    created_at: '2024-01-01T00:00:00Z',
  } as ProductPrice,
  
  breadPrice: {
    id: 2,
    product_id: 2,
    price: 45.00,
    date: '2024-01-01',
    store: 'Магнит',
    created_at: '2024-01-01T00:00:00Z',
  } as ProductPrice,
};

// Product Nomenclature fixtures
export const productNomenclatureFixtures = {
  milkToFood: {
    product_id: 1,
    nomenclature_id: 1,
    created_at: '2024-01-01T00:00:00Z',
  } as ProductNomenclature,
  
  breadToFood: {
    product_id: 2,
    nomenclature_id: 1,
    created_at: '2024-01-01T00:00:00Z',
  } as ProductNomenclature,
};

// Report fixtures
export const reportFixtures = {
  budgetByNomenclature: [
    {
      nomenclature_name: 'Продукты питания',
      total_budget_value: 50000,
      total_fact_value: 45000,
      diff_value: -5000,
      diff_percentage: -10,
    },
    {
      nomenclature_name: 'Транспорт',
      total_budget_value: 10000,
      total_fact_value: 12000,
      diff_value: 2000,
      diff_percentage: 20,
    },
  ],
  
  emptyReport: [],
};

// API Response fixtures
export const apiResponseFixtures = {
  success: <T>(data: T) => ({
    data,
    status: 200,
    statusText: 'OK',
    headers: {},
    config: {},
  }),
  
  error: (message: string = 'Internal Server Error', status: number = 500) => ({
    response: {
      data: { message },
      status,
      statusText: status === 404 ? 'Not Found' : 'Internal Server Error',
      headers: {},
      config: {},
    },
    isAxiosError: true,
  }),
  
  unauthorized: () => ({
    response: {
      data: { message: 'Unauthorized' },
      status: 401,
      statusText: 'Unauthorized',
      headers: {},
      config: {},
    },
    isAxiosError: true,
  }),
};

// Form data fixtures
export const formDataFixtures = {
  validBudgetForm: {
    period_id: 1,
    financial_center_id: 1,
    cost_center_id: 1,
    nomenclature_id: 1,
    amount: 5000,
    comment: 'Test budget entry',
  },
  
  invalidBudgetForm: {
    period_id: null,
    financial_center_id: null,
    cost_center_id: null,
    nomenclature_id: null,
    amount: -100,
    comment: '',
  },
  
  validProductForm: {
    name: 'Test Product',
    barcode: '1234567890123',
    brand: 'Test Brand',
    description: 'Test description',
    unit: 'шт',
    category: 'Test Category',
  },
};

// Export all fixtures as default
export default {
  users: userFixtures,
  periods: periodFixtures,
  financialCenters: financialCenterFixtures,
  costCenters: costCenterFixtures,
  nomenclatures: nomenclatureFixtures,
  rowTypes: rowTypeFixtures,
  registry: registryFixtures,
  products: productFixtures,
  productPrices: productPriceFixtures,
  productNomenclatures: productNomenclatureFixtures,
  reports: reportFixtures,
  apiResponses: apiResponseFixtures,
  formData: formDataFixtures,
};