# Testing Framework for SvelteKit Frontend

This directory contains the testing framework setup and utilities for the SvelteKit frontend application.

## Test Structure

```
src/
├── test/
│   ├── setup.ts           # Global test setup and mocks
│   ├── utils.ts           # Test utilities and helpers
│   └── README.md          # This file
├── lib/
│   ├── components/
│   │   ├── ui/__tests__/        # UI component tests
│   │   └── reference/__tests__/ # Enhanced manager integration tests
│   ├── stores/__tests__/        # Svelte store tests
│   ├── services/__tests__/      # API service tests
│   ├── hooks/__tests__/         # Custom hook tests
│   └── validation/__tests__/    # Validation schema tests
```

## Available Test Scripts

```bash
# Run all tests
npm run test

# Run tests once
npm run test:run

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run tests with UI (if @vitest/ui is installed)
npm run test:ui
```

## Test Categories

### 1. UI Component Tests
- **Location**: `src/lib/components/ui/__tests__/`
- **Focus**: Component rendering, props, events, accessibility
- **Examples**: Button, Input, Select, FormField, Dialog, Table

### 2. Store Tests
- **Location**: `src/lib/stores/__tests__/`
- **Focus**: State management, reactivity, persistence
- **Examples**: authStore, toastStore, errorStore

### 3. Service Tests
- **Location**: `src/lib/services/__tests__/`
- **Focus**: API calls, data transformation, error handling
- **Examples**: api service, nomenclature service, periods service

### 4. Validation Tests
- **Location**: `src/lib/validation/__tests__/`
- **Focus**: Schema validation, error formatting, Russian messages
- **Examples**: Zod schemas, validation utilities

### 5. Hook Tests
- **Location**: `src/lib/hooks/__tests__/`
- **Focus**: Custom hook logic, form validation, async operations
- **Examples**: useFormValidation

### 6. Integration Tests
- **Location**: `src/lib/components/reference/__tests__/`
- **Focus**: End-to-end component workflows
- **Examples**: Enhanced Manager components

## Testing Utilities

### Mock Factories
- `createMockUser()` - Creates test user objects
- `createMockPeriod()` - Creates test period objects
- `createMockNomenclature()` - Creates test nomenclature objects
- `createMockApiResponse()` - Creates mock API responses
- `createMockAxiosResponse()` - Creates mock Axios responses
- `createMockStore()` - Creates mock Svelte stores

### Test Helpers
- `renderComponent()` - Custom render function for Svelte components
- `waitForAsync()` - Wait for async operations
- `createMockValidationError()` - Create validation error objects

## Coverage Requirements

The test suite is configured with a 50% coverage threshold for:
- **Lines**: 50%
- **Functions**: 50%
- **Branches**: 50%
- **Statements**: 50%

## Mocking Strategy

### SvelteKit Environment
- `$app/environment` - Mocked for browser/server detection
- `$app/navigation` - Mocked for routing functions
- `$app/stores` - Mocked for page/navigation stores

### Browser APIs
- `localStorage` - Mocked for persistence testing
- `window.location` - Mocked for navigation testing
- `ResizeObserver` - Mocked for component testing
- `IntersectionObserver` - Mocked for visibility testing

### External Libraries
- `axios` - Mocked for API testing
- `svelte-forms-lib` - Mocked for form testing

## Test Configuration

### Vitest Config (`vitest.config.ts`)
- Environment: happy-dom (faster than jsdom)
- Setup files: Global mocks and utilities
- Path aliases: Consistent with SvelteKit config
- Coverage: v8 provider with HTML/JSON/text reports

### TypeScript Support
- Full TypeScript integration
- Type-safe test utilities
- Import alias support

## Best Practices

### 1. Component Testing
```typescript
import { render, fireEvent } from '@testing-library/svelte';
import MyComponent from '../MyComponent.svelte';

describe('MyComponent', () => {
  it('should render correctly', () => {
    const { getByRole } = render(MyComponent, { 
      props: { title: 'Test' } 
    });
    
    expect(getByRole('button')).toBeInTheDocument();
  });
});
```

### 2. Store Testing
```typescript
import { get } from 'svelte/store';
import { myStore } from '../myStore';

describe('MyStore', () => {
  it('should update state correctly', () => {
    myStore.setValue('test');
    expect(get(myStore).value).toBe('test');
  });
});
```

### 3. Service Testing
```typescript
import { vi } from 'vitest';
import { myService } from '../myService';

vi.mock('$services/api');

describe('MyService', () => {
  it('should call API correctly', async () => {
    const mockResponse = { data: [] };
    vi.mocked(api.get).mockResolvedValue(mockResponse);
    
    const result = await myService.getAll();
    expect(api.get).toHaveBeenCalledWith('/endpoint');
  });
});
```

## Known Issues and Limitations

1. **Svelte 5 Compatibility**: Some component tests may fail due to Svelte 5 breaking changes
2. **Complex Component Mocking**: Enhanced managers require sophisticated mocking
3. **SSR Testing**: Limited server-side rendering test support
4. **Async Store Testing**: Complex async store operations may need refinement

## Future Improvements

1. **E2E Testing**: Add Playwright integration for end-to-end tests
2. **Visual Testing**: Add screenshot testing for UI components  
3. **Performance Testing**: Add performance benchmarks
4. **A11y Testing**: Enhanced accessibility testing with axe-core
5. **Mock Refinement**: Improve mocking for complex component interactions

## Troubleshooting

### Common Issues

1. **Import Path Errors**: Use path aliases (`$lib`, `$test`, etc.)
2. **Component Render Errors**: Check that component props match expected types
3. **Mock Failures**: Ensure mocks are reset between tests with `vi.clearAllMocks()`
4. **Async Test Issues**: Use `await` and proper timeout handling

### Debug Commands

```bash
# Run specific test file
npm run test:run src/lib/stores/__tests__/authStore.test.ts

# Run tests with verbose output
npm run test:run --reporter=verbose

# Run tests for specific pattern
npm run test:run --grep="should validate"
```