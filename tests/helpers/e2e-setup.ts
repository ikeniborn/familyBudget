/**
 * E2E test setup helpers for dashboard testing.
 * Provides database setup, test user creation, and test data generation.
 */

interface TestUser {
  userId: number;
  credentials: {
    username: string;
    password: string;
  };
}

interface TestDataConfig {
  createPeriods?: boolean;
  createNomenclatures?: boolean;
  createFinancialCenters?: boolean;
  createCostCenters?: boolean;
  createBudgetEntries?: boolean;
  createFactEntries?: boolean;
}

/**
 * Setup test database for E2E tests
 */
export async function setupE2EDatabase(): Promise<void> {
  if (process.env.NODE_ENV !== 'test') {
    throw new Error('E2E tests should only run in test environment');
  }

  // This would typically involve:
  // 1. Creating a separate test database
  // 2. Running migrations
  // 3. Seeding minimal required data

  console.log('Setting up E2E test database...');

  try {
    // Mock implementation - in real scenario, you'd:
    // const db = await createTestDatabase();
    // await runMigrations(db);
    // await seedReferenceData(db);
  } catch (error) {
    console.error('Failed to setup E2E database:', error);
    throw error;
  }
}

/**
 * Cleanup test database after E2E tests
 */
export async function cleanupE2EDatabase(): Promise<void> {
  if (process.env.NODE_ENV !== 'test') {
    throw new Error('Database cleanup should only run in test environment');
  }

  console.log('Cleaning up E2E test database...');

  try {
    // Mock implementation - in real scenario, you'd:
    // await dropTestDatabase();
    // or await cleanupTestData();
  } catch (error) {
    console.error('Failed to cleanup E2E database:', error);
    throw error;
  }
}

/**
 * Create a test user with authentication credentials
 */
export async function createTestUser(): Promise<TestUser> {
  const timestamp = Date.now();
  const randomId = Math.floor(Math.random() * 1000);

  const credentials = {
    username: `testuser_${timestamp}_${randomId}`,
    password: `testpass_${timestamp}`
  };

  console.log(`Creating test user: ${credentials.username}`);

  try {
    // Mock implementation - in real scenario, you'd:
    // const response = await fetch('/api/auth/register', {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify({
    //     username: credentials.username,
    //     password: credentials.password,
    //     email: `${credentials.username}@test.com`
    //   })
    // });
    // const userData = await response.json();

    // Mock user ID
    const userId = Math.floor(Math.random() * 10000) + 1000;

    return {
      userId,
      credentials
    };

  } catch (error) {
    console.error('Failed to create test user:', error);
    throw error;
  }
}

/**
 * Create comprehensive test data for a user
 */
export async function createTestData(
  userId: number,
  config: TestDataConfig = {}
): Promise<void> {
  const {
    createPeriods = true,
    createNomenclatures = true,
    createFinancialCenters = true,
    createCostCenters = true,
    createBudgetEntries = true,
    createFactEntries = true
  } = config;

  console.log(`Creating test data for user ${userId}...`);

  try {
    let periodIds: number[] = [];
    let nomenclatureIds: number[] = [];
    let financialCenterIds: number[] = [];
    let costCenterIds: number[] = [];

    // Create periods
    if (createPeriods) {
      periodIds = await createTestPeriods(userId);
    }

    // Create nomenclatures (budget categories)
    if (createNomenclatures) {
      nomenclatureIds = await createTestNomenclatures(userId);
    }

    // Create financial centers
    if (createFinancialCenters) {
      financialCenterIds = await createTestFinancialCenters(userId);
    }

    // Create cost centers
    if (createCostCenters) {
      costCenterIds = await createTestCostCenters(userId);
    }

    // Create budget entries (row_type_id = 1)
    if (createBudgetEntries && periodIds.length && nomenclatureIds.length) {
      await createTestBudgetEntries(userId, periodIds, nomenclatureIds, financialCenterIds, costCenterIds);
    }

    // Create fact entries (row_type_id = 2)
    if (createFactEntries && periodIds.length && nomenclatureIds.length) {
      await createTestFactEntries(userId, periodIds, nomenclatureIds, financialCenterIds, costCenterIds);
    }

    console.log(`Test data created successfully for user ${userId}`);

  } catch (error) {
    console.error('Failed to create test data:', error);
    throw error;
  }
}

/**
 * Create test periods for user
 */
async function createTestPeriods(userId: number): Promise<number[]> {
  const periods = [
    { name: 'Январь 2025', year: 2025, month: 1 },
    { name: 'Февраль 2025', year: 2025, month: 2 },
    { name: 'Март 2025', year: 2025, month: 3 }
  ];

  const periodIds: number[] = [];

  for (const period of periods) {
    // Mock implementation - in real scenario, you'd:
    // const response = await fetch('/api/periods/', {
    //   method: 'POST',
    //   headers: {
    //     'Content-Type': 'application/json',
    //     'Authorization': `Bearer ${userToken}`
    //   },
    //   body: JSON.stringify({
    //     period_name: period.name,
    //     period_year: period.year,
    //     period_month: period.month,
    //     is_active: true
    //   })
    // });
    // const data = await response.json();
    // periodIds.push(data.data.id);

    // Mock period ID
    periodIds.push(Math.floor(Math.random() * 1000) + 1);
  }

  return periodIds;
}

/**
 * Create test nomenclatures (budget categories) for user
 */
async function createTestNomenclatures(userId: number): Promise<number[]> {
  const nomenclatures = [
    { code: 'FOOD', name: 'Продукты питания', description: 'Расходы на продукты' },
    { code: 'TRANSPORT', name: 'Транспорт', description: 'Транспортные расходы' },
    { code: 'UTILITIES', name: 'Коммунальные услуги', description: 'Платежи за ЖКХ' },
    { code: 'ENTERTAINMENT', name: 'Развлечения', description: 'Досуг и развлечения' },
    { code: 'HEALTHCARE', name: 'Медицина', description: 'Медицинские расходы' }
  ];

  const nomenclatureIds: number[] = [];

  for (const nomenclature of nomenclatures) {
    // Mock implementation
    nomenclatureIds.push(Math.floor(Math.random() * 1000) + 1);
  }

  return nomenclatureIds;
}

/**
 * Create test financial centers for user
 */
async function createTestFinancialCenters(userId: number): Promise<number[]> {
  const centers = [
    { code: 'FAMILY', name: 'Семейный бюджет', description: 'Общие семейные расходы' },
    { code: 'PERSONAL', name: 'Личные расходы', description: 'Индивидуальные траты' }
  ];

  const centerIds: number[] = [];

  for (const center of centers) {
    // Mock implementation
    centerIds.push(Math.floor(Math.random() * 1000) + 1);
  }

  return centerIds;
}

/**
 * Create test cost centers for user
 */
async function createTestCostCenters(userId: number): Promise<number[]> {
  const costCenters = [
    { code: 'CC001', name: 'Основные расходы', description: 'Основные бытовые расходы' },
    { code: 'CC002', name: 'Дополнительные расходы', description: 'Дополнительные траты' }
  ];

  const centerIds: number[] = [];

  for (const center of costCenters) {
    // Mock implementation
    centerIds.push(Math.floor(Math.random() * 1000) + 1);
  }

  return centerIds;
}

/**
 * Create test budget entries (planned amounts)
 */
async function createTestBudgetEntries(
  userId: number,
  periodIds: number[],
  nomenclatureIds: number[],
  financialCenterIds: number[],
  costCenterIds: number[]
): Promise<void> {
  const budgetAmounts = [30000, 20000, 15000, 10000, 8000]; // Different amounts for each category

  for (let i = 0; i < Math.min(nomenclatureIds.length, budgetAmounts.length); i++) {
    const entryData = {
      period_id: periodIds[0], // Use first period
      nomenclature_id: nomenclatureIds[i],
      financial_center_id: financialCenterIds[0] || 1,
      cost_center_id: costCenterIds[0] || 1,
      row_type_id: 1, // Budget type
      cost_sum: budgetAmounts[i],
      operation_dttm: new Date().toISOString(),
      comment_description: `Бюджет на ${i + 1}-ю категорию`
    };

    // Mock implementation - in real scenario, you'd:
    // await fetch('/api/registry/', {
    //   method: 'POST',
    //   headers: {
    //     'Content-Type': 'application/json',
    //     'Authorization': `Bearer ${userToken}`
    //   },
    //   body: JSON.stringify(entryData)
    // });
  }
}

/**
 * Create test fact entries (actual expenses)
 */
async function createTestFactEntries(
  userId: number,
  periodIds: number[],
  nomenclatureIds: number[],
  financialCenterIds: number[],
  costCenterIds: number[]
): Promise<void> {
  const actualAmounts = [25000, 18000, 12000, 7500, 6000]; // Slightly less than budget

  for (let i = 0; i < Math.min(nomenclatureIds.length, actualAmounts.length); i++) {
    // Create multiple transactions per category
    const transactionCount = Math.floor(Math.random() * 5) + 1;
    const amountPerTransaction = actualAmounts[i] / transactionCount;

    for (let j = 0; j < transactionCount; j++) {
      const entryData = {
        period_id: periodIds[0], // Use first period
        nomenclature_id: nomenclatureIds[i],
        financial_center_id: financialCenterIds[0] || 1,
        cost_center_id: costCenterIds[0] || 1,
        row_type_id: 2, // Fact type
        cost_sum: Math.round(amountPerTransaction),
        operation_dttm: new Date(Date.now() - j * 86400000).toISOString(), // Spread over last few days
        comment_description: `Расход ${j + 1} по ${i + 1}-й категории`
      };

      // Mock implementation
    }
  }
}

/**
 * Clean up test data for specific user
 */
export async function cleanupUserTestData(userId: number): Promise<void> {
  console.log(`Cleaning up test data for user ${userId}...`);

  try {
    // Mock implementation - in real scenario, you'd:
    // await deleteUserRegistryEntries(userId);
    // await deleteUserNomenclatures(userId);
    // await deleteUserPeriods(userId);
    // await deleteUserFinancialCenters(userId);
    // await deleteUserCostCenters(userId);

    console.log(`Test data cleanup completed for user ${userId}`);
  } catch (error) {
    console.error('Failed to cleanup user test data:', error);
    throw error;
  }
}

/**
 * Verify that test data was created correctly
 */
export async function verifyTestData(userId: number): Promise<boolean> {
  try {
    // Mock implementation - in real scenario, you'd verify:
    // const periods = await fetch(`/api/periods/?user_id=${userId}`);
    // const nomenclatures = await fetch(`/api/nomenclatures/?user_id=${userId}`);
    // const registryEntries = await fetch(`/api/registry/?user_id=${userId}`);

    // Return true if all required data exists
    return true;
  } catch (error) {
    console.error('Failed to verify test data:', error);
    return false;
  }
}

/**
 * Generate realistic test data with proper relationships
 */
export async function generateRealisticTestData(
  userId: number,
  months: number = 3
): Promise<void> {
  console.log(`Generating realistic test data for ${months} months...`);

  // This would create more realistic data patterns:
  // - Seasonal spending variations
  // - Typical household budget distributions
  // - Realistic transaction frequencies
  // - Budget vs actual variances that make sense

  const config: TestDataConfig = {
    createPeriods: true,
    createNomenclatures: true,
    createFinancialCenters: true,
    createCostCenters: true,
    createBudgetEntries: true,
    createFactEntries: true
  };

  await createTestData(userId, config);
}