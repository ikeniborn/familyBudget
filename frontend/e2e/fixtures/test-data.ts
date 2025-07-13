/**
 * Test data fixtures for E2E tests
 */

export const testUsers = {
  admin: {
    email: 'admin@familybudget.com',
    password: 'admin123',
    name: 'Admin User',
  },
  regularUser: {
    email: 'user@familybudget.com', 
    password: 'user123',
    name: 'Regular User',
  },
  testUser: {
    email: 'test@example.com',
    password: 'password123',
    name: 'Test User',
  },
};

export const testPeriods = {
  january2025: {
    period_name: 'January 2025',
    period_ru_name: 'Январь 2025',
    start_date: '2025-01-01',
    end_date: '2025-01-31',
  },
  february2025: {
    period_name: 'February 2025', 
    period_ru_name: 'Февраль 2025',
    start_date: '2025-02-01',
    end_date: '2025-02-28',
  },
};

export const testFinancialCenters = {
  administration: {
    financial_center_name: 'Административный центр',
    description: 'Административные расходы компании',
  },
  sales: {
    financial_center_name: 'Отдел продаж',
    description: 'Расходы отдела продаж',
  },
};

export const testCostCenters = {
  management: {
    cost_center_name: 'Управление',
    description: 'Расходы на управление',
  },
  marketing: {
    cost_center_name: 'Маркетинг',
    description: 'Маркетинговые расходы',
  },
};

export const testNomenclatures = {
  officeSupplies: {
    nomenclature_name: 'Канцелярские товары',
    description: 'Офисные и канцелярские принадлежности',
  },
  software: {
    nomenclature_name: 'Программное обеспечение',
    description: 'Лицензии и подписки на ПО',
  },
  advertising: {
    nomenclature_name: 'Реклама',
    description: 'Рекламные расходы',
  },
};

export const testProducts = {
  laptop: {
    name: 'Ноутбук Dell Latitude',
    description: 'Рабочий ноутбук для сотрудников',
    price: 75000,
    unit: 'шт',
    barcode: '1234567890123',
  },
  printer: {
    name: 'Принтер HP LaserJet',
    description: 'Лазерный принтер для офиса',
    price: 25000,
    unit: 'шт', 
    barcode: '2345678901234',
  },
};

export const testBudgetEntries = {
  laptopPurchase: {
    planned_amount: 150000,
    actual_amount: 140000,
    description: 'Покупка ноутбуков для отдела',
    transaction_date: '2025-01-15',
  },
  advertisingCampaign: {
    planned_amount: 50000,
    actual_amount: 65000,
    description: 'Рекламная кампания в социальных сетях',
    transaction_date: '2025-01-20',
  },
};

export const testReportFilters = {
  planFactAnalysis: {
    report_type: 'plan_fact',
    period_id: 1,
    financial_center_id: 1,
  },
  budgetAnalysis: {
    report_type: 'budget',
    period_id: 1,
  },
};

// Page selectors for consistent element targeting
export const pageSelectors = {
  navigation: {
    sidebar: '[data-testid="sidebar"]',
    logo: '[data-testid="logo"]',
    menuItems: '[data-testid="menu-item"]',
    userMenu: '[data-testid="user-menu"]',
  },
  forms: {
    submitButton: 'button[type="submit"]',
    cancelButton: 'button:has-text("Отмена")',
    saveButton: 'button:has-text("Сохранить")',
    deleteButton: 'button:has-text("Удалить")',
  },
  tables: {
    dataTable: '[data-testid="data-table"]',
    tableRows: 'tbody tr',
    tableHeaders: 'thead th',
    pagination: '[data-testid="pagination"]',
  },
  modals: {
    dialog: '[role="dialog"]',
    confirmDialog: '[data-testid="confirm-dialog"]',
    alertDialog: '[data-testid="alert-dialog"]',
  },
  charts: {
    chartContainer: '[data-testid="chart-container"]',
    chartToggle: '[data-testid="view-mode-toggle"]',
    chartSelector: '[data-testid="chart-selector"]',
  },
};

// Common test utilities
export const testUtils = {
  /**
   * Generate random test data
   */
  generateRandomString: (length: number = 8): string => {
    return Math.random().toString(36).substring(2, length + 2);
  },

  /**
   * Generate test email
   */
  generateTestEmail: (): string => {
    return `test-${testUtils.generateRandomString()}@example.com`;
  },

  /**
   * Generate future date
   */
  generateFutureDate: (daysFromNow: number = 30): string => {
    const date = new Date();
    date.setDate(date.getDate() + daysFromNow);
    return date.toISOString().split('T')[0];
  },

  /**
   * Wait for table to load data
   */
  waitForTableData: async (page: any) => {
    await page.waitForSelector(pageSelectors.tables.dataTable);
    await page.waitForFunction(() => {
      const rows = document.querySelectorAll('tbody tr');
      return rows.length > 0 && !rows[0].textContent?.includes('Загрузка');
    });
  },

  /**
   * Wait for chart to render
   */
  waitForChartRender: async (page: any) => {
    await page.waitForSelector(pageSelectors.charts.chartContainer);
    await page.waitForFunction(() => {
      const container = document.querySelector('[data-testid="chart-container"]');
      return container && container.querySelector('svg');
    });
  },
};