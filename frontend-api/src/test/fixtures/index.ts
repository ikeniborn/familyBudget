export const userFixtures = {
  activeUser: {
    user_id: 1,
    user_name: 'Test User',
    user_telegram_id: 123456789,
    first_name: 'Test',
    last_name: 'User',
    username: 'testuser',
    is_admin: false,
  },
  adminUser: {
    user_id: 2,
    user_name: 'Admin User',
    user_telegram_id: 987654321,
    first_name: 'Admin',
    last_name: 'User',
    username: 'adminuser',
    is_admin: true,
  },
};

export const periodFixtures = {
  january2024: {
    period_id: 1,
    period_name: '202401',
    period_ru_name: 'Январь 2024',
    date_start: '2024-01-01',
    date_end: '2024-01-31',
    is_open: true,
  },
  february2024: {
    period_id: 2,
    period_name: '202402',
    period_ru_name: 'Февраль 2024',
    date_start: '2024-02-01',
    date_end: '2024-02-29',
    is_open: false,
  },
};

export const financialCenterFixtures = {
  family: {
    financial_center_id: 1,
    financial_center_name: 'Семья',
  },
  personal: {
    financial_center_id: 2,
    financial_center_name: 'Личный',
  },
};

export const costCenterFixtures = {
  husband: {
    cost_center_id: 1,
    cost_center_name: 'Муж',
    financial_center_id: 1,
  },
  wife: {
    cost_center_id: 2,
    cost_center_name: 'Жена',
    financial_center_id: 1,
  },
};

export const nomenclatureFixtures = {
  food: {
    nomenclature_id: 1,
    nomenclature_name: 'Продукты питания',
    nomenclature_group: 'Расходы',
    nomenclature_parent_id: null,
  },
  transport: {
    nomenclature_id: 2,
    nomenclature_name: 'Транспорт',
    nomenclature_group: 'Расходы',
    nomenclature_parent_id: null,
  },
};

export const rowTypeFixtures = {
  plan: {
    row_type_id: 1,
    row_type_name: 'План',
  },
  fact: {
    row_type_id: 2,
    row_type_name: 'Факт',
  },
};

export const registryFixtures = {
  planEntry: {
    registry_id: 1,
    user_id: 1,
    period_id: 1,
    financial_center_id: 1,
    cost_center_id: 1,
    nomenclature_id: 1,
    row_type_id: 1,
    cost_sum: 5000,
    comment_description: 'План на продукты',
    operation_dttm: '2024-01-01',
  },
  factEntry: {
    registry_id: 2,
    user_id: 1,
    period_id: 1,
    financial_center_id: 1,
    cost_center_id: 1,
    nomenclature_id: 1,
    row_type_id: 2,
    cost_sum: 4500,
    comment_description: 'Покупка продуктов',
    operation_dttm: '2024-01-15',
  },
};

export const productFixtures = {
  milk: {
    product_id: 1,
    product_name: 'Молоко 3.2%',
    barcode: '4607177761516',
    category_name: 'Молочные продукты',
    unit_measure: 'л',
    description: 'Молоко пастеризованное',
    is_active: true,
  },
  bread: {
    product_id: 2,
    product_name: 'Хлеб белый',
    barcode: '4607177761523',
    category_name: 'Хлебобулочные изделия',
    unit_measure: 'шт',
    description: 'Хлеб пшеничный',
    is_active: true,
  },
};

export const sessionFixtures = {
  validSession: {
    id: 'test-session-id',
    sid: 'test-session-sid',
    sess: {
      cookie: {
        originalMaxAge: 86400000,
        expires: new Date(Date.now() + 86400000).toISOString(),
        secure: false,
        httpOnly: true,
        path: '/',
      },
      user: userFixtures.activeUser,
    },
    expire: new Date(Date.now() + 86400000),
  },
};

export const apiResponses = {
  success: <T>(data: T) => ({
    success: true,
    data,
  }),
  
  error: (message: string = 'Internal Server Error', code: string = 'INTERNAL_ERROR') => ({
    success: false,
    error: message,
    code,
  }),
  
  backendError: (status: number = 500, detail: string = 'Backend error') => ({
    response: {
      status,
      data: { detail },
    },
  }),
};

export default {
  users: userFixtures,
  periods: periodFixtures,
  financialCenters: financialCenterFixtures,
  costCenters: costCenterFixtures,
  nomenclatures: nomenclatureFixtures,
  rowTypes: rowTypeFixtures,
  registry: registryFixtures,
  products: productFixtures,
  sessions: sessionFixtures,
  apiResponses,
};