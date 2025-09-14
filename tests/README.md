# Dashboard Testing Documentation

This directory contains comprehensive tests for the new dashboard functionality, covering all aspects from unit testing to end-to-end user workflows.

## Test Structure

```
tests/
├── frontend/                      # Frontend tests
│   ├── dashboard.service.test.ts   # Unit tests for dashboard service
│   └── dashboard.component.test.ts # Component tests for dashboard page
├── backend/                       # Backend tests
│   └── test_dashboard_api.py      # Integration tests for dashboard APIs
├── e2e/                           # End-to-end tests
│   └── dashboard.e2e.test.ts      # Full user workflow tests
├── helpers/                       # Test utilities
│   └── e2e-setup.ts              # E2E test setup and data generation
└── README.md                      # This documentation
```

## Test Coverage Overview

### Frontend Unit Tests (`dashboard.service.test.ts`)

**Coverage:** Dashboard service API integration and data transformation
- ✅ **API Calls**: All service methods (`getDashboardStats`, `getDashboardData`, etc.)
- ✅ **Error Handling**: Network errors, API failures, missing data scenarios
- ✅ **Data Transformation**: `getDashboardSummary` data formatting and mapping
- ✅ **Parameter Handling**: Optional filters, period selection, pagination
- ✅ **Response Validation**: Type checking and data structure validation

**Key Test Scenarios:**
- Successful API responses with various data configurations
- Error scenarios with proper error message handling
- Data transformation accuracy (category colors, transaction amounts)
- Color cycling for categories exceeding available color palette
- Handling of missing or null data fields

### Frontend Component Tests (`dashboard.component.test.ts`)

**Coverage:** Dashboard page rendering, user interactions, and state management
- ✅ **Authentication Flow**: Session validation, login/logout handling
- ✅ **Loading States**: Loading indicators, data fetching progress
- ✅ **Error States**: API failures, retry functionality, error messages
- ✅ **Data Display**: Statistics cards, category progress, recent transactions
- ✅ **Navigation**: Quick action links, routing verification
- ✅ **Responsive Design**: Mobile, tablet, and desktop layouts
- ✅ **Accessibility**: Keyboard navigation, ARIA labels, heading structure

**Key Test Scenarios:**
- Complete authentication and authorization workflow
- Loading state transitions and user feedback
- Error handling with retry mechanisms
- Data formatting and currency display
- Over-budget warning indicators
- Empty state handling for new users

### Backend Integration Tests (`test_dashboard_api.py`)

**Coverage:** All dashboard API endpoints with comprehensive validation
- ✅ **Endpoints Tested**:
  - `/reports/dashboard-stats` - Core dashboard statistics
  - `/reports/dashboard` - Dashboard data with top categories
  - `/reports/category-analysis` - Category breakdown and progress
  - `/reports/spending-trends` - Historical spending patterns
  - `/reports/period-stats` - Period-wise summaries
  - `/reports/analytics` - Chart and visualization data

**Key Test Scenarios:**
- **Data Accuracy**: Variance calculations, percentage computations
- **User Isolation**: Proper data filtering by user_id
- **Parameter Validation**: Filter combinations, invalid inputs
- **Performance**: Response time limits, data volume handling
- **Consistency**: Cross-endpoint data matching
- **Edge Cases**: Zero values, negative amounts, missing references

### End-to-End Tests (`dashboard.e2e.test.ts`)

**Coverage:** Complete user workflows from authentication to dashboard interaction
- ✅ **User Authentication**: Login flow, session persistence, multi-user isolation
- ✅ **Dashboard Loading**: Page load performance, API orchestration
- ✅ **User Interactions**: Navigation, quick actions, error recovery
- ✅ **Visual Verification**: Layout correctness, responsive design
- ✅ **Accessibility**: Keyboard navigation, screen reader compatibility
- ✅ **Performance**: Load times, API call efficiency

**Key Test Scenarios:**
- Complete user journey from login to dashboard usage
- Multi-device responsiveness testing
- Error scenarios with user-friendly recovery
- Data isolation between different users
- Performance benchmarking and optimization validation

## Running the Tests

### Prerequisites

```bash
# Frontend dependencies
cd frontend-svelte
npm install

# Backend dependencies
cd backend-fastapi
pip install -r requirements-dev.txt

# E2E testing (Playwright)
cd frontend-svelte
npx playwright install
```

### Frontend Tests

```bash
# Run dashboard service tests
docker exec budget-frontend npm run test dashboard.service.test.ts

# Run dashboard component tests
docker exec budget-frontend npm run test dashboard.component.test.ts

# Run with coverage
docker exec budget-frontend npm run test:coverage -- dashboard

# Run in watch mode for development
docker exec budget-frontend npm run test:watch dashboard
```

### Backend Tests

```bash
# Run dashboard API tests
docker exec budget-backend python -m pytest tests/backend/test_dashboard_api.py -v

# Run with coverage reporting
docker exec budget-backend python -m pytest tests/backend/test_dashboard_api.py --cov=app.api.v1.endpoints.reports --cov-report=html

# Run specific test classes
docker exec budget-backend python -m pytest tests/backend/test_dashboard_api.py::TestDashboardStatsEndpoint -v
```

### End-to-End Tests

```bash
# Run E2E tests (requires running application)
docker exec budget-frontend npx playwright test dashboard.e2e.test.ts

# Run in headed mode for debugging
docker exec budget-frontend npx playwright test dashboard.e2e.test.ts --headed

# Run with specific browser
docker exec budget-frontend npx playwright test dashboard.e2e.test.ts --project=chromium
```

### All Dashboard Tests

```bash
# Run complete test suite for dashboard
./scripts/test-dashboard.sh

# Or manually run all test types
docker exec budget-frontend npm run test dashboard
docker exec budget-backend python -m pytest tests/backend/test_dashboard_api.py
docker exec budget-frontend npx playwright test dashboard.e2e.test.ts
```

## Test Data and Fixtures

### Mock Data Patterns

The tests use realistic mock data that reflects actual usage:

```typescript
// Realistic dashboard summary
const mockDashboardSummary = {
  totalBudget: 100000,    // 100k budget
  totalSpent: 75000,      // 75% utilization
  remaining: 25000,       // 25k remaining
  categories: [
    { name: 'Продукты', budget: 30000, spent: 25000 },     // 83% used
    { name: 'Транспорт', budget: 20000, spent: 18000 },    // 90% used
    { name: 'Развлечения', budget: 15000, spent: 12000 }   // 80% used
  ],
  recentTransactions: [
    { amount: -1500, description: 'Покупка продуктов' },   // Expense
    { amount: 30000, description: 'Бюджет на продукты' }   // Budget entry
  ]
};
```

### Test Database Setup

E2E tests use isolated test data:
- Separate test database or schemas
- Generated test users with unique credentials
- Realistic financial data patterns
- Proper cleanup after test completion

## Coverage Metrics

### Current Test Coverage

| Component | Lines | Functions | Branches | Statements |
|-----------|--------|-----------|----------|------------|
| Dashboard Service | 95%+ | 100% | 90%+ | 95%+ |
| Dashboard Component | 90%+ | 95%+ | 85%+ | 90%+ |
| Dashboard APIs | 95%+ | 100% | 90%+ | 95%+ |

### Coverage Goals

- **Unit Tests**: 95%+ line coverage, 100% function coverage
- **Integration Tests**: 100% endpoint coverage, all error paths tested
- **E2E Tests**: All critical user workflows covered

## Quality Gates

### Automated Checks

All tests must pass before merge:

```bash
# Pre-commit hook runs:
npm run test:dashboard          # Frontend tests
python -m pytest tests/backend/test_dashboard_api.py  # Backend tests
npm run lint                    # Code quality
npm run type-check             # TypeScript validation
```

### Performance Benchmarks

- **Dashboard Load Time**: < 2 seconds on average
- **API Response Time**: < 500ms for dashboard endpoints
- **Memory Usage**: Minimal memory leaks in component tests

### Accessibility Standards

- **WCAG 2.1 AA Compliance**: Keyboard navigation, screen readers
- **Semantic HTML**: Proper heading hierarchy, ARIA labels
- **Color Contrast**: Sufficient contrast ratios for text and UI elements

## Troubleshooting

### Common Issues

1. **Mock API Responses**
   ```typescript
   // Ensure mocks are properly reset between tests
   beforeEach(() => {
     vi.clearAllMocks();
   });
   ```

2. **Async Test Timing**
   ```typescript
   // Use proper async/await patterns
   await waitFor(() => {
     expect(screen.getByText('Dashboard')).toBeVisible();
   });
   ```

3. **E2E Test Stability**
   ```typescript
   // Wait for elements to be available
   await expect(page.getByText('Dashboard')).toBeVisible();
   ```

### Debugging Tips

- **Frontend**: Use `screen.debug()` to see DOM structure in component tests
- **Backend**: Add `--pdb` flag to pytest for interactive debugging
- **E2E**: Run with `--headed --slowMo=1000` for visual debugging

### Test Environment Setup

```bash
# Ensure test environment variables are set
export NODE_ENV=test
export TEST_DATABASE_URL=postgresql://test_user:test_pass@localhost/test_db
export E2E_BASE_URL=http://localhost:5173
export E2E_API_URL=http://localhost:4000
```

## Contributing

### Adding New Tests

1. **Follow Existing Patterns**: Use established test structure and naming
2. **Comprehensive Coverage**: Test happy paths, edge cases, and error scenarios
3. **Clear Descriptions**: Use descriptive test names and comments
4. **Mock Appropriately**: Mock external dependencies, use realistic data
5. **Maintain Performance**: Keep tests fast and reliable

### Test Review Checklist

- ✅ Tests follow established patterns and conventions
- ✅ All critical functionality is covered
- ✅ Edge cases and error scenarios are tested
- ✅ Performance and accessibility are validated
- ✅ Tests are deterministic and don't rely on external services
- ✅ Documentation is updated to reflect new functionality

## Integration with CI/CD

The dashboard tests are integrated into the continuous integration pipeline:

```yaml
# .github/workflows/test.yml
- name: Frontend Dashboard Tests
  run: npm run test dashboard

- name: Backend Dashboard Tests
  run: python -m pytest tests/backend/test_dashboard_api.py

- name: E2E Dashboard Tests
  run: npx playwright test dashboard.e2e.test.ts
```

This ensures that any changes to the dashboard functionality are thoroughly validated before deployment.