# Руководство по тестированию Family Budget

## Обзор

Проект Family Budget использует комплексную стратегию тестирования, включающую:
- Unit тесты для изолированных компонентов
- Integration тесты для проверки взаимодействия между модулями
- End-to-end тесты для проверки полных пользовательских сценариев
- Автоматизированное тестирование через CI/CD

## Структура тестов

```
familyBudget/
├── backend-fastapi/
│   └── tests/
│       ├── conftest.py            # Pytest конфигурация и фикстуры
│       ├── test_auth.py           # Тесты аутентификации
│       ├── test_reference_data.py # Тесты справочников
│       ├── test_registry.py       # Тесты транзакций
│       ├── test_products.py       # Тесты продуктов
│       ├── test_reports.py        # Тесты отчетов
│       └── test_integration.py    # Интеграционные тесты
├── frontend-svelte/
│   ├── src/
│   │   ├── test/
│   │   │   ├── setup.ts          # Конфигурация Vitest
│   │   │   └── utils.ts          # Тестовые утилиты
│   │   ├── lib/
│   │   │   ├── stores/*.test.ts  # Тесты stores
│   │   │   ├── services/*.test.ts # Тесты сервисов
│   │   │   └── components/**/*.test.ts # Тесты компонентов
│   └── vitest.config.ts          # Конфигурация Vitest
└── .github/
    └── workflows/
        └── test.yml               # CI/CD конфигурация

```

## Backend тестирование (FastAPI)

### Технологии
- **pytest** - фреймворк для тестирования
- **pytest-asyncio** - поддержка асинхронных тестов
- **pytest-cov** - измерение покрытия кода
- **black** - форматирование кода
- **flake8** - линтинг
- **mypy** - проверка типов

### Запуск тестов

```bash
# Все тесты backend
docker exec budget-backend python -m pytest tests/

# Конкретный файл тестов
docker exec budget-backend python -m pytest tests/test_auth.py

# С покрытием
docker exec budget-backend python -m pytest tests/ --cov=app --cov-report=html

# Только unit тесты (без интеграционных)
docker exec budget-backend python -m pytest tests/ --ignore=tests/test_integration.py
```

### Написание тестов

```python
# Пример теста для endpoint
def test_create_period(authenticated_client: TestClient, test_period_data):
    """Test creating a new period."""
    response = authenticated_client.post("/api/periods", json=test_period_data)
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert data["success"] is True
    assert data["data"]["period"] == test_period_data["period"]
```

### Фикстуры

- `client` - неаутентифицированный клиент
- `authenticated_client` - аутентифицированный клиент
- `db_session` - сессия базы данных для тестов
- `test_user_data`, `test_period_data`, etc. - тестовые данные

## Frontend тестирование (SvelteKit)

### Технологии
- **Vitest** - фреймворк для тестирования
- **@testing-library/svelte** - утилиты для тестирования Svelte
- **@testing-library/jest-dom** - дополнительные матчеры
- **jsdom** - эмуляция DOM для тестов
- **ESLint** - линтинг
- **TypeScript** - проверка типов

### Запуск тестов

```bash
# Все тесты frontend
docker exec budget-frontend npm run test

# С покрытием
docker exec budget-frontend npm run test:coverage

# В режиме watch
docker exec budget-frontend npm run test:watch

# С UI
docker exec budget-frontend npm run test:ui

# Проверка типов
docker exec budget-frontend npm run check

# Линтинг
docker exec budget-frontend npm run lint
```

### Написание тестов

```typescript
// Пример теста для компонента
describe('Button Component', () => {
	it('should handle click events', async () => {
		const handleClick = vi.fn();
		const { getByRole } = render(Button, {
			props: {
				onclick: handleClick,
				children: 'Click me'
			}
		});
		
		const button = getByRole('button');
		await fireEvent.click(button);
		
		expect(handleClick).toHaveBeenCalledTimes(1);
	});
});

// Пример теста для store
describe('AuthStore', () => {
	it('should login user successfully', async () => {
		mockFetch({ success: true, data: { user: mockUser } });
		
		const result = await authStore.login('testuser', 'password123');
		
		expect(result.success).toBe(true);
		expect(result.data?.user).toEqual(mockUser);
	});
});
```

## Интеграционные тесты

### Полный workflow пользователя

```python
def test_complete_budget_management_flow(client: TestClient):
    """Test complete budget management workflow."""
    # 1. Регистрация
    # 2. Вход
    # 3. Создание справочников
    # 4. Создание транзакций
    # 5. Получение отчетов
    # 6. Проверка изоляции данных
```

### Изоляция данных между пользователями

```python
def test_multi_user_data_isolation(client: TestClient):
    """Test that data is properly isolated between users."""
    # Создание двух пользователей
    # Проверка, что данные изолированы
```

## Использование тестового скрипта

```bash
# Запуск всех тестов
./scripts/test.sh all

# Только backend тесты
./scripts/test.sh backend

# Только frontend тесты
./scripts/test.sh frontend

# Только интеграционные тесты
./scripts/test.sh integration

# Генерация отчета о покрытии
./scripts/test.sh coverage

# Быстрые тесты (только unit)
./scripts/test.sh quick

# Тесты в режиме watch
./scripts/test.sh watch
```

## CI/CD Pipeline

### GitHub Actions Workflow

1. **Backend Tests**
   - Установка Python зависимостей
   - Линтинг (black, flake8, mypy)
   - Запуск тестов с покрытием
   - Загрузка отчета о покрытии

2. **Frontend Tests**
   - Установка Node.js зависимостей
   - Линтинг и проверка типов
   - Запуск тестов с покрытием
   - Сборка приложения
   - Загрузка отчета о покрытии

3. **Integration Tests**
   - Запуск PostgreSQL и Redis
   - Выполнение миграций
   - Запуск backend сервера
   - Выполнение интеграционных тестов

4. **Docker Build Test**
   - Сборка Docker образов
   - Проверка docker-compose конфигурации

### Автоматический запуск

Тесты запускаются автоматически при:
- Push в ветки: `master`, `develop`, `nodejs`
- Pull request в ветку `master`

## Покрытие кода

### Целевые показатели

- **Backend**: минимум 80% покрытия
- **Frontend**: минимум 50% покрытия
- **Критические модули**: 90%+ покрытия
  - Аутентификация
  - Обработка платежей
  - Изоляция данных

### Просмотр отчетов

После запуска тестов с покрытием:

```bash
# Backend отчет
open backend-fastapi/htmlcov/index.html

# Frontend отчет
open frontend-svelte/coverage/index.html
```

## Best Practices

### Именование тестов

- Используйте описательные имена: `test_should_reject_weak_password`
- Группируйте связанные тесты в классы или describe блоки
- Следуйте паттерну: `test_<action>_<expected_result>`

### Изоляция тестов

- Каждый тест должен быть независимым
- Используйте фикстуры для подготовки данных
- Очищайте состояние после каждого теста

### Асинхронные тесты

```python
# Backend
@pytest.mark.asyncio
async def test_async_operation():
    result = await async_function()
    assert result is not None

# Frontend
it('should handle async operations', async () => {
    await waitFor(() => {
        expect(screen.getByText('Loaded')).toBeInTheDocument();
    });
});
```

### Моки и стабы

```typescript
// Frontend
vi.mock('$app/navigation', () => ({
    goto: vi.fn(),
    invalidate: vi.fn()
}));

// Backend
mock_redis = Mock()
mock_redis.get = Mock(return_value=None)
```

## Отладка тестов

### Backend

```bash
# Запуск с выводом print statements
docker exec budget-backend python -m pytest tests/ -s

# Запуск с отладчиком
docker exec -it budget-backend python -m pytest tests/ --pdb

# Verbose режим
docker exec budget-backend python -m pytest tests/ -vv
```

### Frontend

```bash
# Запуск конкретного теста
docker exec budget-frontend npm run test -- Button.test.ts

# Debug режим
docker exec budget-frontend npm run test:ui
```

## Troubleshooting

### Проблема: Тесты падают из-за базы данных

```bash
# Пересоздать тестовую базу
docker-compose down
docker-compose up -d postgres
docker exec budget-backend alembic upgrade head
```

### Проблема: Timeout в тестах

```python
# Увеличить timeout для медленных операций
@pytest.mark.timeout(30)
def test_slow_operation():
    pass
```

### Проблема: Flaky тесты

- Используйте `waitFor` для асинхронных операций
- Добавьте retry логику для нестабильных тестов
- Изолируйте тесты друг от друга

## Continuous Improvement

### Метрики качества

- Покрытие кода > 80%
- Время выполнения тестов < 5 минут
- Flaky тесты < 1%
- Все критические пути протестированы

### Регулярные задачи

- [ ] Еженедельный review покрытия кода
- [ ] Ежемесячное обновление тестовых данных
- [ ] Квартальный аудит тестовой инфраструктуры

## Ресурсы

- [Pytest Documentation](https://docs.pytest.org/)
- [Vitest Documentation](https://vitest.dev/)
- [Testing Library](https://testing-library.com/)
- [GitHub Actions](https://docs.github.com/en/actions)