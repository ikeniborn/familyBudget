# FastAPI Backend Tests

Comprehensive test suite for the Family Budget FastAPI backend.

## Test Structure

```
tests/
├── conftest.py          # Shared fixtures and configuration
├── unit/                # Unit tests
│   ├── test_users_endpoints.py
│   ├── test_periods_endpoints.py
│   ├── test_registry_endpoints.py
│   ├── test_authentication.py
│   ├── test_data_validation.py
│   ├── test_error_handling.py
│   └── test_database_operations.py
├── integration/         # Integration tests
│   └── test_integration.py
└── fixtures/           # Test data fixtures
```

## Running Tests

### Run all tests
```bash
pytest
```

### Run with coverage
```bash
pytest --cov=. --cov-report=html
```

### Run specific test file
```bash
pytest tests/unit/test_users_endpoints.py -v
```

### Run tests by marker
```bash
pytest -m unit          # Run only unit tests
pytest -m integration   # Run only integration tests
pytest -m auth         # Run authentication tests
pytest -m db          # Run database tests
```

### Run with specific verbosity
```bash
pytest -v    # Verbose
pytest -q    # Quiet
pytest -vv   # Very verbose
```

## Test Categories

### Unit Tests

1. **Endpoint Tests**
   - User endpoints (CRUD operations)
   - Period endpoints
   - Registry endpoints
   - Reference data endpoints
   - Product endpoints

2. **Authentication Tests**
   - API key validation
   - Secure endpoint access
   - Rate limiting
   - SQL injection prevention

3. **Data Validation Tests**
   - Field type validation
   - Required field validation
   - Range validation
   - Format validation
   - Foreign key validation

4. **Error Handling Tests**
   - Database connection errors
   - Timeout handling
   - Malformed requests
   - Partial failures
   - Graceful degradation

5. **Database Operation Tests**
   - Transaction handling
   - Pagination
   - Sorting and filtering
   - Aggregations
   - Bulk operations

### Integration Tests

1. **Complete Workflows**
   - User → Registry → Update → Delete
   - Budget planning workflow
   - Product price tracking
   - Multi-user isolation

2. **Performance Tests**
   - Large dataset handling
   - Concurrent operations
   - Response time validation

## Test Fixtures

Common test data fixtures are provided in `conftest.py`:

- `sample_user` - User data
- `sample_period` - Period data
- `sample_registry` - Registry entry data
- `sample_product` - Product data
- `auth_headers` - Valid authentication headers
- `mock_postgres_connection` - Mocked database connection
- `mock_redis` - Mocked Redis client

## Coverage Requirements

- Minimum coverage: 80%
- Coverage reports: HTML and terminal
- Fail under 80% coverage

## Writing New Tests

### Example Unit Test
```python
@pytest.mark.asyncio
async def test_get_users_success(async_client, mock_postgres_connection, sample_user):
    # Setup
    mock_postgres_connection.select.return_value = [sample_user]
    
    # Execute
    response = await async_client.get("/users")
    
    # Assert
    assert response.status_code == 200
    assert len(response.json()) == 1
```

### Example Integration Test
```python
@pytest.mark.asyncio
@pytest.mark.integration
async def test_complete_workflow(async_client, mock_postgres_connection):
    # Test complete user workflow
    # Create → Read → Update → Delete
```

## Best Practices

1. **Use async/await** for all API tests
2. **Mock external dependencies** (database, Redis)
3. **Test both success and failure cases**
4. **Validate response structure** not just status codes
5. **Use meaningful test names** that describe what is being tested
6. **Group related tests** in classes
7. **Use fixtures** for common test data
8. **Mark tests appropriately** (unit, integration, slow, etc.)

## CI/CD Integration

Tests are automatically run on:
- Pull requests
- Commits to main branch
- Nightly builds

Failed tests will block deployment.