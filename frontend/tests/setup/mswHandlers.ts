/**
 * MSW (Mock Service Worker) handlers for API mocking in tests
 *
 * Provides mock responses for API endpoints used by components
 */

import { http, HttpResponse } from 'msw';

// Mock data
const mockFinancialCenters = [
  {
    id: 1,
    name: 'Сбербанк Основной',
    description: 'Основной банковский счет',
    is_active: true
  },
  {
    id: 2,
    name: 'Тинькофф Накопительный',
    description: 'Накопительный счет',
    is_active: true
  },
  {
    id: 3,
    name: 'Наличные',
    description: 'Наличные средства',
    is_active: true
  },
  {
    id: 4,
    name: 'Закрытый счет',
    description: 'Неактивный счет',
    is_active: false
  }
];

const mockCostCenters = [
  {
    id: 1,
    name: 'Семейный бюджет',
    description: 'Общие семейные расходы',
    is_active: true
  },
  {
    id: 2,
    name: 'Ремонт квартиры',
    description: 'Проект ремонта',
    is_active: true
  },
  {
    id: 3,
    name: 'Отпуск 2026',
    description: 'Планируемый отпуск',
    is_active: true
  },
  {
    id: 4,
    name: 'Закрытый проект',
    description: 'Завершенный проект',
    is_active: false
  }
];

const mockArticles = [
  {
    id: 1,
    name: 'Продукты',
    type: 'expense',
    parent_id: null,
    is_active: true
  },
  {
    id: 2,
    name: 'Транспорт',
    type: 'expense',
    parent_id: null,
    is_active: true
  },
  {
    id: 3,
    name: 'Зарплата',
    type: 'income',
    parent_id: null,
    is_active: true
  }
];

const mockShoppingLists = [
  {
    id: 1,
    name: 'Продукты на неделю',
    is_active: true,
    created_at: '2026-01-20T10:00:00Z',
    updated_at: '2026-01-20T10:00:00Z',
    sync_status: 'synced'
  },
  {
    id: 2,
    name: 'Хозтовары',
    is_active: true,
    created_at: '2026-01-21T12:00:00Z',
    updated_at: '2026-01-21T12:00:00Z',
    sync_status: 'synced'
  }
];

const mockFacts = [
  {
    id: 1,
    user_id: 1,
    financial_center_id: 1,
    article_id: 1,
    cost_center_id: 1,
    amount: 1500.50,
    record_type: 'fact',
    transaction_date: '2026-01-20',
    description: 'Покупка продуктов',
    created_at: '2026-01-20T10:00:00Z'
  },
  {
    id: 2,
    user_id: 1,
    financial_center_id: 1,
    article_id: 3,
    cost_center_id: 1,
    amount: 50000.00,
    record_type: 'fact',
    transaction_date: '2026-01-15',
    description: 'Зарплата',
    created_at: '2026-01-15T09:00:00Z'
  }
];

const mockRecurringPlans = [
  {
    id: 1,
    user_id: 1,
    article_id: 1,
    cost_center_id: 1,
    amount: 5000.00,
    frequency: 'monthly',
    day_of_month: 1,
    is_active: true,
    description: 'Ежемесячные продукты',
    created_at: '2026-01-01T10:00:00Z'
  },
  {
    id: 2,
    user_id: 1,
    article_id: 2,
    cost_center_id: 1,
    amount: 2000.00,
    frequency: 'monthly',
    day_of_month: 10,
    is_active: true,
    description: 'Проездной',
    created_at: '2026-01-01T10:00:00Z'
  }
];

// Handlers
export const handlers = [
  // Financial Centers
  http.get('/api/v1/financial-centers', () => {
    return HttpResponse.json({
      data: mockFinancialCenters
    });
  }),

  // Cost Centers
  http.get('/api/v1/cost-centers', () => {
    return HttpResponse.json({
      data: mockCostCenters
    });
  }),

  // Articles
  http.get('/api/v1/articles', () => {
    return HttpResponse.json({
      data: mockArticles
    });
  }),

  // Shopping Lists
  http.get('/api/v1/shopping-lists', ({ request }) => {
    const url = new URL(request.url);
    const isActive = url.searchParams.get('is_active');

    let filteredLists = mockShoppingLists;
    if (isActive !== null) {
      const isActiveBool = isActive === 'true';
      filteredLists = mockShoppingLists.filter(list => list.is_active === isActiveBool);
    }

    return HttpResponse.json({
      data: filteredLists
    });
  }),

  // Facts
  http.get('/api/v1/facts', ({ request }) => {
    const url = new URL(request.url);
    const recordType = url.searchParams.get('record_type');
    const userId = url.searchParams.get('user_id');

    let filteredFacts = mockFacts;
    if (recordType) {
      filteredFacts = filteredFacts.filter(fact => fact.record_type === recordType);
    }
    if (userId) {
      filteredFacts = filteredFacts.filter(fact => fact.user_id === parseInt(userId));
    }

    return HttpResponse.json({
      data: filteredFacts
    });
  }),

  // Facts Count
  http.get('/api/v1/facts/count', ({ request }) => {
    const url = new URL(request.url);
    const recordType = url.searchParams.get('record_type');
    const userId = url.searchParams.get('user_id');

    let filteredFacts = mockFacts;
    if (recordType) {
      filteredFacts = filteredFacts.filter(fact => fact.record_type === recordType);
    }
    if (userId) {
      filteredFacts = filteredFacts.filter(fact => fact.user_id === parseInt(userId));
    }

    return HttpResponse.json({
      total: filteredFacts.length
    });
  }),

  // Recurring Plans
  http.get('/api/v1/recurring-plans', ({ request }) => {
    const url = new URL(request.url);
    const isActive = url.searchParams.get('is_active');

    let filteredPlans = mockRecurringPlans;
    if (isActive !== null) {
      const isActiveBool = isActive === 'true';
      filteredPlans = mockRecurringPlans.filter(plan => plan.is_active === isActiveBool);
    }

    return HttpResponse.json({
      data: filteredPlans
    });
  }),

  // Error simulation handlers (for testing error cases)
  http.get('/api/v1/financial-centers/error', () => {
    return HttpResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }),

  http.get('/api/v1/cost-centers/error', () => {
    return HttpResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  })
];

// Export mock data for tests
export {
  mockFinancialCenters,
  mockCostCenters,
  mockArticles,
  mockShoppingLists,
  mockFacts,
  mockRecurringPlans
};
