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
export { mockFinancialCenters, mockCostCenters, mockArticles };
