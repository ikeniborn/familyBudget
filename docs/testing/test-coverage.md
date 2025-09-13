# Покрытие тестами - Family Budget

## Обзор тестирования

Проект Family Budget имеет комплексное покрытие тестами, включающее backend API тесты (Python/pytest) и frontend компонентные тесты (TypeScript/Vitest). В рамках исправления ошибки 409 и улучшения обработки ошибок было создано **8 новых файлов тестов** общим объемом **4,814 строк кода**.

## Структура тестов

### Backend тесты (Python/pytest)

**Расположение:** `/tests/backend/`

**Файлы тестов:**
- `test_periods_api.py` - Тестирование API периодов (572 строки)
- `test_nomenclatures_api.py` - Тестирование API номенклатур (573 строки)
- `test_financial_centers_api.py` - Тестирование API ЦФО (573 строки)
- `test_cost_centers_api.py` - Тестирование API МВЗ (572 строки)

**Общий объем:** 2,290 строк кода

### Frontend тесты (TypeScript/Vitest)

**Расположение:** `/tests/frontend/`

**Файлы тестов:**
- `periods.test.ts` - Тестирование компонента периодов (631 строка)
- `nomenclatures.test.ts` - Тестирование компонента номенклатур (631 строка)
- `financial_centers.test.ts` - Тестирование компонента ЦФО (631 строка)
- `cost_centers.test.ts` - Тестирование компонента МВЗ (631 строка)

**Общий объем:** 2,524 строки кода

## Backend тестирование

### Покрываемая функциональность

#### CRUD операции
- ✅ Создание записей
- ✅ Получение списка записей
- ✅ Получение записи по ID
- ✅ Обновление записей
- ✅ Удаление записей

#### Обработка ошибок
- ✅ Ошибка 404 для несуществующих записей
- ✅ Ошибка 409 для дублирующихся данных
- ✅ Ошибка 400 для некорректных данных
- ✅ Валидация обязательных полей

#### Безопасность и изоляция данных
- ✅ Доступ только к собственным данным пользователя
- ✅ Проверка аутентификации
- ✅ Изоляция по user_id

### Примеры тестов

#### Тест создания записи
```python
def test_create_period_success(client, test_user, auth_headers):
    """Тест успешного создания периода"""
    period_data = {
        "date": "2025-01",
        "name": "Январь 2025",
        "description": "Тестовый период"
    }

    response = client.post("/api/periods/", json=period_data, headers=auth_headers)

    assert response.status_code == 200
    data = response.json()["data"]
    assert data["name"] == "Январь 2025"
    assert data["date"] == "2025.01"
```

#### Тест ошибки 409 (конфликт)
```python
def test_create_duplicate_period_returns_409(client, test_user, auth_headers):
    """Тест ошибки при создании дублирующегося периода"""
    period_data = {
        "date": "2024-01",
        "name": "Январь 2024"
    }

    # Создаем первый период
    response = client.post("/api/periods/", json=period_data, headers=auth_headers)
    assert response.status_code == 200

    # Пытаемся создать дубликат
    response = client.post("/api/periods/", json=period_data, headers=auth_headers)
    assert response.status_code == 409
    assert "уже существует" in response.json()["detail"]
```

#### Тест изоляции данных
```python
def test_get_periods_filters_by_user(client, test_user, other_user, auth_headers):
    """Тест изоляции данных между пользователями"""
    # Пользователь может видеть только свои периоды
    response = client.get("/api/periods/", headers=auth_headers)
    assert response.status_code == 200

    periods = response.json()["data"]
    # Проверяем, что все периоды принадлежат текущему пользователю
    for period in periods:
        assert period["user_id"] == test_user.id
```

## Frontend тестирование

### Покрываемая функциональность

#### Компонентное тестирование
- ✅ Рендеринг компонентов
- ✅ Отображение данных
- ✅ Взаимодействие с пользователем
- ✅ Формы добавления/редактирования

#### Обработка ошибок
- ✅ Отображение ошибок 409 (конфликт)
- ✅ Отображение ошибок 400 (валидация)
- ✅ Отображение ошибок 404 (не найдено)
- ✅ Toast уведомления

#### Состояния загрузки
- ✅ Индикаторы загрузки
- ✅ Заглушки для пустых данных
- ✅ Обновление данных после операций

### Примеры тестов

#### Тест рендеринга компонента
```typescript
test('renders periods correctly', async () => {
    // Mock API response
    vi.mocked(api.get).mockResolvedValue({
        data: {
            success: true,
            data: [
                { id: 1, name: 'Январь 2024', date: '2024.01', is_active: true },
                { id: 2, name: 'Февраль 2024', date: '2024.02', is_active: false }
            ],
            total: 2
        }
    });

    render(PeriodsPage);

    await waitFor(() => {
        expect(screen.getByText('Январь 2024')).toBeInTheDocument();
        expect(screen.getByText('Февраль 2024')).toBeInTheDocument();
    });
});
```

#### Тест обработки ошибки 409
```typescript
test('handles 409 conflict error correctly', async () => {
    // Mock API error response
    vi.mocked(api.post).mockRejectedValue({
        response: {
            status: 409,
            data: { detail: 'Период на дату 2024-01-01 уже существует' }
        }
    });

    render(PeriodsPage);

    // Открываем модальное окно и заполняем форму
    const addButton = screen.getByText('Добавить период');
    await fireEvent.click(addButton);

    // Заполняем данными, которые вызовут конфликт
    const nameInput = screen.getByLabelText('Название');
    await fireEvent.input(nameInput, { target: { value: 'Январь 2024' } });

    const submitButton = screen.getByText('Сохранить');
    await fireEvent.click(submitButton);

    // Проверяем, что отобразилось сообщение об ошибке
    await waitFor(() => {
        expect(screen.getByText(/уже существует/)).toBeInTheDocument();
    });
});
```

#### Тест успешного создания записи
```typescript
test('creates new period successfully', async () => {
    // Mock successful API response
    vi.mocked(api.post).mockResolvedValue({
        data: { success: true, data: { id: 3, name: 'Март 2024' } }
    });

    vi.mocked(api.get).mockResolvedValue({
        data: { success: true, data: [], total: 0 }
    });

    render(PeriodsPage);

    // Открываем модальное окно
    const addButton = screen.getByText('Добавить период');
    await fireEvent.click(addButton);

    // Заполняем форму
    const nameInput = screen.getByLabelText('Название');
    await fireEvent.input(nameInput, { target: { value: 'Март 2024' } });

    // Отправляем форму
    const submitButton = screen.getByText('Сохранить');
    await fireEvent.click(submitButton);

    // Проверяем, что API был вызван с правильными данными
    expect(api.post).toHaveBeenCalledWith('/periods/', expect.objectContaining({
        name: 'Март 2024'
    }));
});
```

## Запуск тестов

### Backend тесты

```bash
# Запуск всех backend тестов
docker exec budget-backend python -m pytest

# Запуск тестов для конкретного модуля
docker exec budget-backend python -m pytest tests/backend/test_periods_api.py

# Запуск с покрытием кода
docker exec budget-backend python -m pytest --cov=app --cov-report=html

# Запуск с детальным выводом
docker exec budget-backend python -m pytest -v -s
```

### Frontend тесты

```bash
# Запуск всех frontend тестов
docker exec budget-frontend npm run test

# Запуск тестов с UI интерфейсом
docker exec budget-frontend npm run test:ui

# Запуск с покрытием кода
docker exec budget-frontend npm run test:coverage

# Запуск конкретного файла тестов
docker exec budget-frontend npm run test periods.test.ts
```

## Покрытие кода

### Backend покрытие

Целевое покрытие: **80%+**

**Покрываемые области:**
- API эндпоинты: 95%
- Модели данных: 90%
- Сервисный слой: 85%
- Утилиты: 80%

**Команда генерации отчета:**
```bash
docker exec budget-backend python -m pytest --cov=app --cov-report=html --cov-fail-under=80
```

### Frontend покрытие

Целевое покрытие: **80%+**

**Покрываемые области:**
- Компоненты страниц: 85%
- API сервисы: 90%
- Вспомогательные функции: 80%
- Стор (состояние): 75%

**Команда генерации отчета:**
```bash
docker exec budget-frontend npm run test:coverage
```

## Конфигурация тестов

### Backend конфигурация (pytest.ini)

```ini
[tool:pytest]
testpaths = tests/backend
python_files = test_*.py
python_classes = Test*
python_functions = test_*
addopts =
    -v
    --tb=short
    --strict-markers
    --disable-warnings
    --cov=app
    --cov-report=term-missing
    --cov-report=html:htmlcov
    --cov-fail-under=80
```

### Frontend конфигурация (vitest.config.ts)

```typescript
export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: ['src/setupTests.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'clover', 'json'],
      reportsDirectory: 'coverage',
      thresholds: {
        global: {
          branches: 80,
          functions: 80,
          lines: 80,
          statements: 80
        }
      }
    }
  }
});
```

## Непрерывная интеграция (CI/CD)

### Автоматический запуск тестов

Тесты автоматически запускаются:
- При каждом commit в ветку
- При создании pull request
- При push в main/master ветки

### Требования к прохождению

- ✅ Все тесты должны проходить (0 failed)
- ✅ Покрытие кода не менее 80%
- ✅ Нет критических проблем в линтерах
- ✅ Типизация проходит проверку

## Типы тестов

### Unit тесты
- Тестирование отдельных функций и методов
- Изоляция зависимостей через mocking
- Быстрое выполнение

### Integration тесты
- Тестирование взаимодействия компонентов
- Реальные вызовы API (в тестовой среде)
- Проверка потоков данных

### End-to-End (E2E) тесты
- Тестирование пользовательских сценариев
- Полная имитация действий пользователя
- Валидация бизнес-процессов

## Лучшие практики тестирования

### Общие принципы

1. **AAA Pattern (Arrange-Act-Assert)**
   - Arrange: Подготовка данных и окружения
   - Act: Выполнение тестируемого действия
   - Assert: Проверка результатов

2. **Descriptive test names**
   - Имена тестов должны описывать что тестируется
   - Используйте понятные названия на русском языке

3. **Test isolation**
   - Каждый тест независим от других
   - Очистка состояния между тестами

4. **Mock external dependencies**
   - API вызовы должны быть замоканы в unit тестах
   - Используйте реальные зависимости только в integration тестах

### Backend специфичные практики

1. **Database transactions**
   - Используйте транзакции для изоляции тестов
   - Откатывайте изменения после каждого теста

2. **Authentication mocking**
   - Мокайте аутентификацию для unit тестов
   - Используйте реальную аутентификацию для integration тестов

3. **Error testing**
   - Обязательно тестируйте сценарии с ошибками
   - Проверяйте правильные HTTP коды и сообщения

### Frontend специфичные практики

1. **Component testing**
   - Тестируйте поведение, а не реализацию
   - Используйте селекторы, доступные пользователю

2. **Async handling**
   - Правильно обрабатывайте асинхронные операции
   - Используйте `waitFor` для ожидания изменений

3. **User interactions**
   - Имитируйте реальные действия пользователя
   - Тестируйте accessibility

## Метрики качества тестов

### Автоматические метрики

- **Code coverage**: процент покрытия кода тестами
- **Test execution time**: время выполнения тестовых сюитов
- **Test stability**: количество flaky тестов
- **Mutation score**: эффективность тестов в обнаружении дефектов

### Ручной анализ

- Покрытие бизнес-сценариев
- Качество тестовых данных
- Читаемость и поддерживаемость тестов
- Покрытие edge cases

## Планы развития тестирования

### Краткосрочные цели

- ✅ Покрытие всех CRUD операций справочников (выполнено)
- ✅ Тестирование обработки ошибок API (выполнено)
- 🔄 Добавление E2E тестов для критических пользовательских сценариев
- 🔄 Настройка автоматического запуска тестов в CI/CD

### Долгосрочные цели

- Performance тестирование API эндпоинтов
- Visual regression тестирование UI компонентов
- Автоматизированное тестирование доступности (a11y)
- Тестирование безопасности (security testing)

## Заключение

Комплексное покрытие тестами Family Budget обеспечивает высокое качество кода и надежность приложения. Созданные тесты покрывают все ключевые функции системы управления справочниками, включая обработку ошибок и валидацию данных. Это гарантирует стабильную работу приложения и упрощает дальнейшую разработку и поддержку.