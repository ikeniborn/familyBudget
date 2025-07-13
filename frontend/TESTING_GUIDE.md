# Frontend Testing Guide

## Overview

This guide covers testing best practices and patterns for the Family Budget frontend application. We use Jest for unit tests, React Testing Library for component tests, and Playwright for E2E tests.

## Test Structure

```
frontend/src/
├── test/
│   ├── fixtures/         # Test data and fixtures
│   ├── mocks/           # API mocks and handlers
│   └── utils/           # Test utilities and helpers
├── components/
│   └── Button/
│       ├── Button.tsx
│       └── Button.test.tsx
└── services/
    └── userService/
        ├── userService.ts
        └── userService.test.ts
```

## Testing Stack

- **Jest**: Test runner and assertion library
- **React Testing Library**: Component testing utilities
- **MSW (Mock Service Worker)**: API mocking
- **Playwright**: End-to-end testing
- **@testing-library/user-event**: User interaction simulation

## Writing Tests

### 1. Component Tests

Use the custom render function that includes all providers:

```typescript
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { customRender } from '@/test/utils/test-utils';
import { Button } from './Button';

describe('Button', () => {
  it('should render and handle click', async () => {
    const handleClick = jest.fn();
    const { user } = customRender(
      <Button onClick={handleClick}>Click me</Button>
    );
    
    const button = screen.getByRole('button', { name: /click me/i });
    expect(button).toBeInTheDocument();
    
    await user.click(button);
    expect(handleClick).toHaveBeenCalledTimes(1);
  });
});
```

### 2. Service Tests

Test API services with MSW mocks:

```typescript
import { server } from '@/test/mocks/server';
import { rest } from 'msw';
import { userService } from './userService';
import fixtures from '@/test/fixtures';

describe('UserService', () => {
  it('should fetch user by id', async () => {
    const user = await userService.getUserById(1);
    expect(user).toEqual(fixtures.users.activeUser);
  });
  
  it('should handle errors', async () => {
    // Override the default handler for this test
    server.use(
      rest.get('/api/users/:id', (req, res, ctx) => {
        return res(ctx.status(404), ctx.json({ message: 'Not found' }));
      })
    );
    
    await expect(userService.getUserById(999)).rejects.toThrow('Not found');
  });
});
```

### 3. Hook Tests

Test custom hooks with renderHook:

```typescript
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useUser } from './useUser';

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={new QueryClient()}>
    {children}
  </QueryClientProvider>
);

describe('useUser', () => {
  it('should fetch user data', async () => {
    const { result } = renderHook(() => useUser(1), { wrapper });
    
    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    
    expect(result.current.data).toEqual(expect.objectContaining({
      id: 1,
      name: 'Test User',
    }));
  });
});
```

### 4. Form Tests

Test form validation and submission:

```typescript
import { screen, waitFor } from '@testing-library/react';
import { customRender } from '@/test/utils/test-utils';
import { BudgetForm } from './BudgetForm';

describe('BudgetForm', () => {
  it('should validate required fields', async () => {
    const onSubmit = jest.fn();
    const { user } = customRender(<BudgetForm onSubmit={onSubmit} />);
    
    // Try to submit empty form
    const submitButton = screen.getByRole('button', { name: /submit/i });
    await user.click(submitButton);
    
    // Check for validation errors
    expect(screen.getByText(/amount is required/i)).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });
  
  it('should submit valid form', async () => {
    const onSubmit = jest.fn();
    const { user } = customRender(<BudgetForm onSubmit={onSubmit} />);
    
    // Fill form
    await user.type(screen.getByLabelText(/amount/i), '5000');
    await user.selectOptions(screen.getByLabelText(/category/i), 'Food');
    
    // Submit
    await user.click(screen.getByRole('button', { name: /submit/i }));
    
    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({
        amount: 5000,
        category: 'Food',
      });
    });
  });
});
```

## Test Utilities

### Custom Render

The `customRender` function wraps components with all necessary providers:

```typescript
import { customRender } from '@/test/utils/test-utils';

// Basic usage
const { user } = customRender(<MyComponent />);

// With routing
const { user } = customRender(<MyComponent />, {
  routerProps: {
    initialEntries: ['/dashboard'],
  },
});
```

### Mock Data

Use fixtures for consistent test data:

```typescript
import fixtures from '@/test/fixtures';

const mockUser = fixtures.users.activeUser;
const mockPeriod = fixtures.periods.january2024;
```

### API Mocking

Override default handlers for specific tests:

```typescript
import { server } from '@/test/mocks/server';
import { rest } from 'msw';

server.use(
  rest.get('/api/users', (req, res, ctx) => {
    return res(ctx.status(500));
  })
);
```

## Best Practices

### 1. Test User Behavior, Not Implementation

❌ Bad:
```typescript
expect(component.state.isLoading).toBe(true);
```

✅ Good:
```typescript
expect(screen.getByText(/loading/i)).toBeInTheDocument();
```

### 2. Use Accessible Queries

Priority order for queries:
1. `getByRole`
2. `getByLabelText`
3. `getByPlaceholderText`
4. `getByText`
5. `getByTestId` (last resort)

### 3. Wait for Async Operations

```typescript
// Wait for element to appear
await screen.findByText(/loaded data/i);

// Wait for condition
await waitFor(() => {
  expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
});
```

### 4. Test Error States

Always test error scenarios:

```typescript
it('should show error message on failure', async () => {
  server.use(
    rest.get('/api/data', (req, res, ctx) => {
      return res(ctx.status(500));
    })
  );
  
  customRender(<MyComponent />);
  
  await screen.findByText(/something went wrong/i);
});
```

### 5. Keep Tests Isolated

Each test should be independent:

```typescript
beforeEach(() => {
  // Reset any module mocks
  jest.clearAllMocks();
});

afterEach(() => {
  // Cleanup is automatic with React Testing Library
});
```

## Coverage Requirements

We maintain the following coverage thresholds:

- **Branches**: 70%
- **Functions**: 70%
- **Lines**: 80%
- **Statements**: 80%

Run coverage report:
```bash
npm run test:coverage
```

## Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run specific test file
npm test Button.test.tsx

# Run E2E tests
npm run test:e2e
```

## Debugging Tests

### 1. Debug Output

```typescript
import { screen, debug } from '@testing-library/react';

// Debug entire document
debug();

// Debug specific element
debug(screen.getByRole('button'));
```

### 2. Pause Test Execution

```typescript
// In Playwright E2E tests
await page.pause();

// In Jest tests
await new Promise(resolve => setTimeout(resolve, 100000));
```

### 3. VS Code Debugging

Add to `.vscode/launch.json`:

```json
{
  "type": "node",
  "request": "launch",
  "name": "Jest Debug",
  "program": "${workspaceFolder}/node_modules/.bin/jest",
  "args": ["--runInBand", "${relativeFile}"],
  "console": "integratedTerminal",
  "internalConsoleOptions": "neverOpen"
}
```

## Common Testing Patterns

### 1. Testing Loading States

```typescript
it('should show loading state', async () => {
  customRender(<DataComponent />);
  
  // Initially shows loading
  expect(screen.getByText(/loading/i)).toBeInTheDocument();
  
  // Wait for data to load
  await screen.findByText(/data loaded/i);
  
  // Loading indicator should be gone
  expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
});
```

### 2. Testing Authentication

```typescript
it('should redirect to login when unauthorized', async () => {
  server.use(
    rest.get('/api/protected', (req, res, ctx) => {
      return res(ctx.status(401));
    })
  );
  
  const { user } = customRender(<ProtectedRoute />);
  
  await waitFor(() => {
    expect(window.location.pathname).toBe('/login');
  });
});
```

### 3. Testing Tables

```typescript
it('should render table with data', async () => {
  customRender(<DataTable data={mockData} />);
  
  // Check headers
  expect(screen.getByText(/name/i)).toBeInTheDocument();
  expect(screen.getByText(/amount/i)).toBeInTheDocument();
  
  // Check data
  mockData.forEach(item => {
    expect(screen.getByText(item.name)).toBeInTheDocument();
  });
});
```

## Troubleshooting

### Common Issues

1. **"Cannot find module" errors**
   - Check tsconfig.json paths configuration
   - Ensure jest.config.js moduleNameMapper matches

2. **"act() warning"**
   - Wrap state updates in `waitFor`
   - Use `findBy` queries for async operations

3. **Flaky tests**
   - Increase timeout for slow operations
   - Use `waitFor` with specific conditions
   - Check for race conditions

4. **MSW not intercepting requests**
   - Ensure server is started in setupTests.ts
   - Check request URL matches handler pattern
   - Verify request method (GET/POST) matches

## Resources

- [Jest Documentation](https://jestjs.io/)
- [React Testing Library](https://testing-library.com/docs/react-testing-library/intro/)
- [MSW Documentation](https://mswjs.io/)
- [Testing Library Queries](https://testing-library.com/docs/queries/about)
- [Common Testing Mistakes](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)