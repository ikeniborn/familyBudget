---
wiki_sources:
  - "backend/tests/e2e/README.md"
wiki_updated: 2026-05-05
wiki_status: developing
tags:
  - pytest
  - E2E
  - asyncio
  - httpx
aliases:
  - "E2E tests"
  - "end-to-end tests"
  - "backend E2E"
---

# E2E-тесты — backend

Backend содержит полноценные end-to-end тесты, симулирующие сценарии работы пользователей через реальные HTTP-запросы. Тесты расположены в `backend/tests/e2e/` и запускаются через pytest.

## Основные характеристики

### Структура тест-файлов

**`test_user_journey.py` — пользовательские сценарии:**

| Класс | Что покрывает |
|-------|-------------|
| `TestCompleteUserJourney` | Полный workflow: категории → транзакции → аналитика (11 шагов) |
| `TestBudgetPlanningJourney` | Планирование бюджета, план vs факт |
| `TestAnalyticsJourney` | Все 6 аналитических endpoints (waterfall, heatmap, trends) |

**`test_admin_journey.py` — административные сценарии:**

| Класс | Что покрывает |
|-------|-------------|
| `TestAdminUserManagement` | Просмотр, поиск пользователей, статистика |
| `TestAdminGlobalArticles` | CRUD глобальных категорий статей |
| `TestAdminSystemMonitoring` | Мониторинг системы, активность |
| `TestAdminSecurityWorkflow` | Контроль доступа — проверка изоляции прав |

### Фикстуры из `conftest.py`

| Фикстура | Назначение |
|---------|-----------|
| `auth_client` | Аутентифицированный HTTP-клиент (обычный пользователь) |
| `admin_client` | Аутентифицированный HTTP-клиент (администратор) |
| `test_user` | Предсозданный тестовый пользователь |
| `test_admin` | Предсозданный администратор |
| `session` | Сессия БД с автоматическим rollback после теста |

### Запуск тестов

```bash
# Все E2E тесты
pytest backend/tests/e2e/ -v

# Конкретный файл
pytest backend/tests/e2e/test_user_journey.py -v

# Конкретный класс
pytest backend/tests/e2e/test_user_journey.py::TestCompleteUserJourney -v

# С выводом print-statements
pytest backend/tests/e2e/ -v -s

# Параллельный запуск (требует pytest-xdist)
pytest backend/tests/e2e/ -v -n auto
```

### Паттерн теста

```python
@pytest.mark.asyncio
class TestNewWorkflow:
    async def test_new_scenario(self, auth_client: AsyncClient):
        # 1. Setup: подготовить тестовые данные
        # 2. Execute: вызвать API endpoints
        response = await auth_client.get("/endpoint")
        # 3. Verify: проверить результат
        assert response.status_code == 200
        # 4. Cleanup: автоматически через фикстуру session (rollback)
```

## Принципы E2E-тестирования

- Каждый тест независим (нет зависимостей между тестами)
- Автоматическая очистка через фикстуру `session` (rollback)
- Тесты используют реалистичные данные и сценарии
- Проверяются как HTTP status codes, так и структура ответа

## Ограничения

E2E-тесты медленнее unit-тестов, поскольку:
- Создают полную схему БД
- Выполняют реальные HTTP-запросы
- Симулируют полные workflow

В CI/CD рекомендуется запускать отдельно от unit-тестов.

## Связанные концепции

- [[fastapi-структура]]
- [[аутентификация]]
