# End-to-End (E2E) Tests

## Overview

This directory contains comprehensive end-to-end tests that simulate complete user workflows through the Family Budget application. Unlike unit or integration tests, E2E tests cover entire user scenarios from start to finish.

## Test Files

### 1. test_user_journey.py

**Complete User Workflows:**
- `TestCompleteUserJourney`: Full user experience from category creation to analytics
  - Create income and expense categories
  - Add transactions (income and expenses)
  - View dashboard statistics
  - Explore spending trends
  - View category breakdowns
  - Update and delete transactions

- `TestBudgetPlanningJourney`: Budget planning and comparison
  - Set up budget categories
  - Track actual expenses
  - Compare planned vs actual spending

- `TestAnalyticsJourney`: Analytics exploration
  - Test all analytics endpoints
  - Verify waterfall charts
  - Verify heatmaps
  - Verify trend analysis

### 2. test_admin_journey.py

**Admin Workflows:**
- `TestAdminUserManagement`: User administration
  - View all users
  - Search for users
  - View user details and statistics

- `TestAdminGlobalArticles`: Global category management
  - Create shared income/expense categories
  - Update global articles
  - Delete global articles

- `TestAdminSystemMonitoring`: System monitoring
  - View system statistics
  - Monitor recent activity
  - Track top users by activity

- `TestAdminSecurityWorkflow`: Access control
  - Verify regular users cannot access admin endpoints
  - Test permission boundaries

## Running Tests

### Run All E2E Tests
```bash
pytest backend/tests/e2e/ -v
```

### Run Specific Test File
```bash
pytest backend/tests/e2e/test_user_journey.py -v
pytest backend/tests/e2e/test_admin_journey.py -v
```

### Run Specific Test Class
```bash
pytest backend/tests/e2e/test_user_journey.py::TestCompleteUserJourney -v
pytest backend/tests/e2e/test_admin_journey.py::TestAdminUserManagement -v
```

### Run With Detailed Output
```bash
pytest backend/tests/e2e/ -v -s  # -s shows print statements
```

### Run in Parallel (faster)
```bash
pytest backend/tests/e2e/ -v -n auto  # Requires pytest-xdist
```

## Test Structure

Each E2E test follows this pattern:

1. **Setup**: Create necessary test data (users, categories, transactions)
2. **Execute**: Perform user actions through API endpoints
3. **Verify**: Assert expected outcomes
4. **Cleanup**: Automatic cleanup via test fixtures

## Test Coverage

### User Journey Tests Cover:
- ✅ Complete user workflow (11 steps)
- ✅ Category hierarchy management
- ✅ Transaction CRUD operations
- ✅ Dashboard statistics
- ✅ All 6 analytics endpoints
- ✅ Budget planning workflows

### Admin Journey Tests Cover:
- ✅ User management and search
- ✅ User statistics viewing
- ✅ Global article CRUD operations
- ✅ System monitoring
- ✅ Security and access control

## Fixtures Used

Tests leverage fixtures from `backend/tests/conftest.py`:
- `auth_client`: Authenticated HTTP client for regular users
- `admin_client`: Authenticated HTTP client for admin users
- `test_user`: Pre-created test user
- `test_admin`: Pre-created admin user
- `session`: Database session with automatic rollback

## Expected Behavior

All E2E tests should:
- ✅ Pass independently (no inter-test dependencies)
- ✅ Clean up after themselves (via fixtures)
- ✅ Use realistic data and scenarios
- ✅ Test happy paths and common workflows
- ✅ Verify response status codes
- ✅ Validate response data structures

## Debugging Failed Tests

### View Detailed Output
```bash
pytest backend/tests/e2e/test_user_journey.py::TestCompleteUserJourney -v -s
```

### Run Single Test Method
```bash
pytest backend/tests/e2e/test_user_journey.py::TestCompleteUserJourney::test_complete_user_workflow -v -s
```

### Use pdb Debugger
Add `import pdb; pdb.set_trace()` in test code, then run:
```bash
pytest backend/tests/e2e/ --pdb
```

## Adding New E2E Tests

When adding new E2E tests:

1. **Identify user scenario**: What complete workflow are you testing?
2. **Create test class**: Group related workflows
3. **Use descriptive names**: Test names should describe the scenario
4. **Add print statements**: Help track test progress
5. **Verify all steps**: Don't skip verification steps
6. **Test error cases**: Include negative scenarios where appropriate

### Example Template:
```python
@pytest.mark.asyncio
class TestNewWorkflow:
    """Test description."""

    async def test_new_scenario(self, auth_client: AsyncClient):
        """Detailed scenario description."""

        print("\n🏁 TEST NAME")

        # Step 1
        print("\n📊 Step 1: Description...")
        response = await auth_client.get("/endpoint")
        assert response.status_code == 200
        print("✅ Step 1 complete")

        # More steps...

        print("\n" + "="*60)
        print("🎉 TEST PASSED!")
        print("="*60)
```

## Performance Considerations

E2E tests are slower than unit tests because they:
- Create full database schemas
- Make real HTTP requests
- Simulate complete workflows

**Best Practices:**
- Run E2E tests separately from unit tests
- Use `-n auto` for parallel execution
- Consider CI/CD pipeline optimization

## Integration with CI/CD

E2E tests are designed to run in CI/CD pipelines:

```yaml
# Example GitHub Actions
- name: Run E2E Tests
  run: |
    pytest backend/tests/e2e/ -v --tb=short
```

## Related Documentation

- [Integration Tests](../integration/README.md)
- [API Documentation](../../README.md)
- [Testing Guide](../../TESTING.md)
