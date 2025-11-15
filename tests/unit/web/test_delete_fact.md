# Unit Tests for deleteFact() JavaScript Function

## Overview

This document describes unit tests for the `deleteFact()` function in `web/templates/facts.html` and `web/templates/plan.html`.

**Status:** Requires Jest setup (not yet implemented in project)

## Setup Requirements

To run these tests, you need to:

1. Install Jest and dependencies:
   ```bash
   npm install --save-dev jest @testing-library/dom jest-environment-jsdom
   ```

2. Configure Jest in `package.json`:
   ```json
   {
     "scripts": {
       "test:web": "jest tests/unit/web"
     },
     "jest": {
       "testEnvironment": "jsdom",
       "testMatch": ["**/tests/unit/web/**/*.test.js"]
     }
   }
   ```

3. Extract JavaScript functions to separate modules (refactoring required):
   - Move `deleteFact()` from HTML to `/web/static/js/admin-facts.js`
   - Export function for testing

## Test Cases

### Test Suite: deleteFact() Function

#### Test 1: Successful DELETE returns 200 OK
```javascript
describe('deleteFact()', () => {
  beforeEach(() => {
    // Reset global state
    global.deletingFactIds = new Set();
    global.confirm = jest.fn(() => true);
    global.fetch = jest.fn();
    global.loadFacts = jest.fn();
    global.showNotification = jest.fn();
  });

  test('should delete fact successfully with status="deleted"', async () => {
    const factId = 123;
    const event = { target: document.createElement('button') };

    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        message: 'Fact deleted successfully',
        fact_id: factId,
        status: 'deleted'
      })
    });

    await deleteFact(factId, event);

    expect(fetch).toHaveBeenCalledWith('/api/v1/admin/facts/123', {
      method: 'DELETE'
    });
    expect(loadFacts).toHaveBeenCalled();
    expect(showNotification).toHaveBeenCalledWith(
      '✅ Транзакция успешно удалена!',
      'success'
    );
    expect(deletingFactIds.has(factId)).toBe(false); // Cleaned up
  });
});
```

#### Test 2: DELETE returns 404 but UI still reloads (idempotent)
```javascript
test('should reload facts even when DELETE returns 404', async () => {
  const factId = 999;
  const event = { target: document.createElement('button') };

  global.fetch.mockResolvedValueOnce({
    ok: false,
    status: 404,
    json: async () => ({ detail: 'Fact not found' })
  });

  await deleteFact(factId, event);

  // Assert: loadFacts() called in finally block (даже при ошибке!)
  expect(loadFacts).toHaveBeenCalled();
  expect(showNotification).toHaveBeenCalledWith(
    expect.stringContaining('❌ Ошибка'),
    'error'
  );
});
```

#### Test 3: Multiple clicks on same fact are prevented (race condition)
```javascript
test('should prevent multiple simultaneous deletes of same fact', async () => {
  const factId = 456;
  const event = { target: document.createElement('button') };

  // Simulate slow DELETE request
  global.fetch.mockImplementationOnce(() =>
    new Promise(resolve => setTimeout(() => resolve({
      ok: true,
      json: async () => ({ status: 'deleted', fact_id: factId })
    }), 100))
  );

  // Start first DELETE
  const promise1 = deleteFact(factId, event);

  // Try second DELETE while first is still running
  const promise2 = deleteFact(factId, event);

  await Promise.all([promise1, promise2]);

  // Assert: Only ONE DELETE request sent
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(console.warn).toHaveBeenCalledWith(
    'Delete already in progress for fact:',
    factId
  );
});
```

#### Test 4: Button is disabled during DELETE
```javascript
test('should disable button and show loading state during DELETE', async () => {
  const factId = 789;
  const button = document.createElement('button');
  const event = { target: button };

  global.fetch.mockImplementationOnce(() =>
    new Promise(resolve => {
      // Assert button state DURING fetch
      expect(button.disabled).toBe(true);
      expect(button.classList.contains('loading')).toBe(true);

      setTimeout(() => resolve({
        ok: true,
        json: async () => ({ status: 'deleted', fact_id: factId })
      }), 10);
    })
  );

  await deleteFact(factId, event);

  // After completion, button is re-enabled by loadFacts() render
});
```

#### Test 5: User cancels confirmation dialog
```javascript
test('should not delete fact when user cancels confirmation', async () => {
  const factId = 101;
  const event = { target: document.createElement('button') };

  global.confirm.mockReturnValueOnce(false); // User clicks "Cancel"

  await deleteFact(factId, event);

  // Assert: No DELETE request sent
  expect(fetch).not.toHaveBeenCalled();
  expect(loadFacts).not.toHaveBeenCalled();
});
```

#### Test 6: Network error is handled gracefully
```javascript
test('should handle network errors and still reload facts', async () => {
  const factId = 202;
  const event = { target: document.createElement('button') };

  global.fetch.mockRejectedValueOnce(new Error('Network error'));

  await deleteFact(factId, event);

  // Assert: Error shown, but loadFacts() still called
  expect(showNotification).toHaveBeenCalledWith(
    expect.stringContaining('Network error'),
    'error'
  );
  expect(loadFacts).toHaveBeenCalled();
  expect(deletingFactIds.has(factId)).toBe(false);
});
```

## Coverage Goals

Target coverage: 95%+

**Covered scenarios:**
- ✅ Successful DELETE (200 OK)
- ✅ 404 error (idempotent handling)
- ✅ Race condition prevention (deletingFactIds Set)
- ✅ Button disabled state
- ✅ User cancellation
- ✅ Network errors
- ✅ Multiple clicks prevention

## Future Enhancements

1. **Visual Regression Tests**: Capture screenshots of disabled button state
2. **Performance Tests**: Measure loadFacts() call time after DELETE
3. **E2E Tests**: Use Playwright to test actual browser behavior

## Running Tests

Once Jest is configured:

```bash
# Run all web unit tests
npm run test:web

# Run with coverage
npm run test:web -- --coverage

# Watch mode (development)
npm run test:web -- --watch
```

## Notes

- **Current Status**: Pseudo-code documentation (Jest not configured yet)
- **Action Required**: Refactor inline JavaScript to modules before implementing tests
- **Related Files**:
  - `/web/templates/facts.html:859-903` - deleteFact() implementation
  - `/web/templates/plan.html:806-850` - deleteFact() implementation (duplicate)
  - `/backend/app/api/v1/admin.py:1057-1108` - Backend DELETE endpoint

---

**Generated:** 2025-11-05
**Author:** Claude Code
**Status:** Documentation only (tests not implemented)
