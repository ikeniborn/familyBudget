# Telegram Bot Tests

End-to-end and integration tests for Family Budget Telegram Bot.

## Structure

```
bot/tests/
├── __init__.py
├── conftest.py              # Pytest fixtures and configuration
├── test_start_handler.py    # Tests for /start command
├── test_add_handler.py      # Tests for /add command
├── test_summary_handler.py  # Tests for /summary command
└── README.md                # This file
```

## Running Tests

### Install Test Dependencies

```bash
pip install pytest pytest-asyncio pytest-cov
```

### Run All Tests

```bash
# From project root
pytest bot/tests/ -v

# With coverage
pytest bot/tests/ --cov=bot --cov-report=html

# Specific test file
pytest bot/tests/test_add_handler.py -v

# Specific test
pytest bot/tests/test_add_handler.py::test_amount_validation_valid -v
```

## Test Coverage

Current test coverage focuses on critical user workflows:

### 1. Authentication (`test_start_handler.py`)
- ✅ New user authentication via /start
- ✅ JWT token storage in session
- ✅ API error handling

### 2. Transaction Creation (`test_add_handler.py`)
- ✅ Article selection via inline keyboard
- ✅ Amount validation (valid/invalid inputs)
- ✅ Complete transaction flow (7 steps)
- ✅ API integration (POST /api/v1/facts)
- ✅ Unauthenticated user redirect

### 3. Summary Reports (`test_summary_handler.py`)
- ✅ Fetching plan vs fact summary
- ✅ Displaying summary data
- ✅ Empty state (no transactions)
- ✅ Authentication check

## Mocking Strategy

Tests use mocked API client (`mock_api_client` fixture) to avoid real API calls:

- `authenticate_telegram_user()` - Returns test JWT token
- `get_articles()` - Returns sample articles
- `create_fact()` - Returns created fact
- `get_facts_summary()` - Returns sample summary

This allows fast, isolated tests without backend dependency.

## Future Test Additions

### High Priority
- `/edit` command tests (transaction editing/deletion)
- `/addplan` command tests (budget planning)
- ЦФО/МВЗ selection tests (financial/cost centers)
- Error handling for network failures
- Concurrent conversation handling

### Medium Priority
- `/settings` command tests (user preferences)
- `/today` and `/stats` command tests
- Notification service tests
- Weekly report generation tests
- ConversationHandler timeout handling

### Low Priority
- Performance tests (response time)
- Load tests (concurrent users)
- Memory usage tests

## Known Limitations

1. **Telegram API Mocking**: Tests use mocked Telegram objects, not real Telegram API
2. **Backend Dependency**: Some tests require backend API to be running (integration tests)
3. **Database State**: Tests don't verify database state directly (only via API responses)

## Continuous Integration

Tests should be run in CI pipeline:

```yaml
# .github/workflows/test.yml
- name: Run Bot Tests
  run: |
    pip install pytest pytest-asyncio
    pytest bot/tests/ -v --junit-xml=test-results.xml
```

## Contributing

When adding new bot handlers, please add corresponding tests:

1. Create `test_<handler_name>.py` file
2. Test happy path (success scenario)
3. Test error cases (invalid input, API errors)
4. Test authentication check
5. Test state transitions (for ConversationHandlers)

## Resources

- [pytest documentation](https://docs.pytest.org/)
- [pytest-asyncio](https://pytest-asyncio.readthedocs.io/)
- [python-telegram-bot testing guide](https://github.com/python-telegram-bot/python-telegram-bot/wiki/Writing-Tests)
