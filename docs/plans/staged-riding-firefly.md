# План: Рефакторинг CI/CD тестирования - Автоматические тесты после деплоя

## Context

### Проблема
В текущей CI/CD конфигурации frontend и backend тесты выполняются при Pull Request в test ветку **ДО деплоя** новой версии на тестовый сервер. Это означает:
- Backend pytest тесты запускаются с изолированными PostgreSQL/Redis контейнерами в GitHub Actions
- Frontend Vitest тесты запускаются с mock данными в happy-dom окружении
- **Результат:** Тесты проверяют код, который еще не развернут на https://fbd.ikeniborn.ru/
- **Риск:** Деплой может быть successful, но реальное окружение сломано

### Требуемое поведение
Необходимо разделить проверки на два этапа:
1. **Статические проверки при PR** (lint, type-check, security scan) - быстрая обратная связь о качестве кода
2. **Runtime тесты после деплоя** (backend pytest, frontend unit tests, E2E) - **автоматическая валидация** развернутого окружения

### Преимущества автоматического post-deploy testing
- ✅ **Полная картина после деплоя** - сразу видно работает ли новая версия
- ✅ **Быстрая реакция** - автоматические уведомления о проблемах
- ✅ **Нет human error** - не нужно помнить запускать тесты вручную
- ✅ **Тесты реального окружения** - валидация production-like setup
- ✅ **Rollback capability** - можно автоматически откатывать failed deploys

### Workflow изменений
**Текущий:**
```
PR в test → Auto PR checks (10 мин) → Merge → Auto deploy (15 мин) → ✅ Готово (но неизвестно работает ли)
```

**Новый:**
```
PR в test → Auto static checks (5 мин) → Merge → Auto deploy (15 мин) → Auto post-deploy tests (15 мин) → ✅ Готово с валидацией
```

**Trade-off:** +15 мин к общему времени, но с гарантией что деплой работает

## Классификация CI/CD Workflows

### Автоматические проверки при PR (оставить как есть)

| Workflow | Тип | Зачем нужен | Время |
|----------|-----|-------------|-------|
| **api-contract-tests.yml** | API contract validation | Проверка breaking changes в OpenAPI schema, генерация TypeScript types | ~10 мин |
| **security-scan.yml** | Security scanning | Dependency audit, SAST, secrets detection | ~8 мин |
| **cache-busting-validation.yml** | Build validation | Валидация cache busting логики | ~3 мин |
| **pr-checks.yml** (MODIFIED) | Static analysis | ESLint, TypeScript check, CSS/JS build, bundle size | ~5 мин (было ~10 мин) |
| **backend-static-checks.yml** (RENAMED) | Static analysis | mypy type check, ruff lint | ~2 мин (было ~15 мин) |

**Итого автоматических проверок:** ~28 мин (было ~46 мин) - экономия 18 мин ⚡

### Автоматические проверки после деплоя (новый job в build-and-push.yml)

| Test Suite | Тип | Зачем нужен | Время |
|------------|-----|-------------|-------|
| **Frontend runtime tests** | Vitest unit/integration | Валидация frontend логики на развернутом окружении | ~2 мин |
| **Backend runtime tests** | pytest (read-only) | Валидация backend API endpoints на реальной БД | ~5 мин |
| **E2E tests** | Playwright (6 browsers) | Валидация пользовательских сценариев end-to-end | ~6 мин |

**Итого post-deploy тестов:** ~15 мин (запускаются автоматически после deploy-test job)

**Failure handling:**
- ❌ Если тесты падают → Отправить уведомление в Telegram/Slack
- ❌ GitHub Actions status = failed (видно в PR/commit)
- ❌ Опционально: автоматический rollback к предыдущей версии

---

## Критические файлы для изменения

### 1. `.github/workflows/pr-checks.yml`
**Цель:** Убрать runtime тесты, оставить только статические проверки

**Изменения:**
- ❌ **Удалить строки 100-166:** Frontend unit tests блок
  - `npm run test:coverage`
  - Upload coverage to Codecov
  - Check coverage thresholds
  - Upload coverage report
- ✅ **Сохранить строки 63-98:** Frontend build validation
  - ESLint
  - Build CSS
  - Bundle JavaScript
  - Verify bundle sizes
- ✅ **Сохранить строки 187-196:** Backend static checks
  - mypy type check
  - ruff lint

**Обоснование:** ESLint, TypeScript type-check, bundle validation - это статический анализ, не требующий развернутого окружения. Runtime тесты переносятся в post-deploy workflow.

### 2. `.github/workflows/backend-tests.yml` → `.github/workflows/backend-static-checks.yml`
**Цель:** Переименовать и переделать в static-only проверки

**Изменения:**
- ❌ **Удалить строки 23-46:** PostgreSQL и Redis services
- ❌ **Удалить строки 64-130:** pytest execution с coverage
- ✅ **Добавить:** mypy + ruff static analysis (из pr-checks.yml)
- 🔄 **Переименовать workflow:** `Backend Tests` → `Backend Static Checks`

**Новая структура:**
```yaml
name: Backend Static Checks

on:
  pull_request:
    branches: [test]
    paths:
      - 'backend/**'
      - 'bot/**'
      - 'requirements.txt'

jobs:
  static-analysis:
    name: Python Static Analysis
    runs-on: ubuntu-latest
    steps:
      - Checkout code
      - Setup Python 3.12
      - Install mypy, ruff
      - Run mypy backend/app/
      - Run ruff check backend/
```

**Обоснование:** Разделение на static checks (быстро, без БД) и runtime tests (медленно, требуют БД после деплоя).

### 3. `.github/workflows/build-and-push.yml` (ДОБАВИТЬ НОВЫЙ JOB)
**Цель:** Добавить автоматический post-deploy testing job

**Новый job (после deploy-test):**
```yaml
# ============================================================================
# Job 7: Post-Deploy Tests (automatic validation)
# ============================================================================
post-deploy-tests:
  name: Post-Deploy Tests
  needs: [deploy-test]
  runs-on: ubuntu-latest
  if: |
    always() &&
    needs.deploy-test.result == 'success'

  strategy:
    matrix:
      test-suite: [frontend, backend, e2e]
    fail-fast: false  # Продолжить даже если один suite падает

  steps:
    - name: Checkout code
      uses: actions/checkout@v4

    - name: Run frontend tests
      if: matrix.test-suite == 'frontend'
      env:
        VITE_API_URL: https://fbd.ikeniborn.ru
      run: |
        npm ci
        npm run test:coverage

    - name: Run backend tests (read-only)
      if: matrix.test-suite == 'backend'
      env:
        DATABASE_URL: ${{ secrets.TEST_DATABASE_URL }}
        REDIS_URL: ${{ secrets.TEST_REDIS_URL }}
        BACKEND_URL: https://fbd.ikeniborn.ru
      run: |
        cd backend
        pip install -r requirements.txt -r requirements-dev.txt
        pytest tests/ -m "not destructive" --maxfail=5

    - name: Run E2E tests
      if: matrix.test-suite == 'e2e'
      env:
        BASE_URL: https://fbd.ikeniborn.ru
        TEST_USER_EMAIL: ${{ secrets.E2E_TEST_USER_EMAIL }}
        TEST_USER_PASSWORD: ${{ secrets.E2E_TEST_USER_PASSWORD }}
      run: |
        npx playwright install --with-deps
        npm run test:e2e

    - name: Upload test results
      if: always()
      uses: actions/upload-artifact@v4
      with:
        name: ${{ matrix.test-suite }}-test-results
        path: |
          coverage/
          playwright-report/
          backend/htmlcov/

    - name: Notify on failure
      if: failure()
      uses: appleboy/telegram-action@master
      with:
        to: ${{ secrets.TELEGRAM_CHAT_ID }}
        token: ${{ secrets.TELEGRAM_BOT_TOKEN }}
        message: |
          ❌ Post-Deploy Tests Failed

          Suite: ${{ matrix.test-suite }}
          Environment: https://fbd.ikeniborn.ru
          Version: $(cat VERSION)
          Commit: ${{ github.sha }}

          Check: ${{ github.server_url }}/${{ github.repository }}/actions/runs/${{ github.run_id }}

# ============================================================================
# Job 8: Post-Deploy Summary
# ============================================================================
post-deploy-summary:
  needs: [post-deploy-tests]
  runs-on: ubuntu-latest
  if: always()
  steps:
    - name: Generate summary
      run: |
        echo "## 🧪 Post-Deploy Test Results" >> $GITHUB_STEP_SUMMARY
        echo "**Frontend:** ${{ needs.post-deploy-tests.outputs.frontend-status }}" >> $GITHUB_STEP_SUMMARY
        echo "**Backend:** ${{ needs.post-deploy-tests.outputs.backend-status }}" >> $GITHUB_STEP_SUMMARY
        echo "**E2E:** ${{ needs.post-deploy-tests.outputs.e2e-status }}" >> $GITHUB_STEP_SUMMARY
```

**Ключевые особенности:**
- **Автоматический запуск** после успешного деплоя
- **Matrix strategy** - 3 test suites параллельно (экономия времени)
- **fail-fast: false** - все тесты выполняются даже если один падает
- **Read-only backend тесты:** `-m "not destructive"`
- **Telegram уведомления** при failures
- **Artifacts upload** для анализа failures

### 4. GitHub Secrets для post-deploy тестов
**Цель:** Добавить credentials для подключения к развернутому окружению

**Новые secrets (Repository Settings → Secrets):**
- `TEST_DATABASE_URL` - URL PostgreSQL на test сервере (read-only user)
- `TEST_REDIS_URL` - URL Redis на test сервере
- `E2E_TEST_USER_EMAIL` - Email тестового пользователя
- `E2E_TEST_USER_PASSWORD` - Пароль тестового пользователя
- `TELEGRAM_CHAT_ID` - Telegram chat для уведомлений (опционально)
- `TELEGRAM_BOT_TOKEN` - Bot token для уведомлений (опционально)

**Обоснование:** Безопасное хранение credentials + уведомления о failures.

### 5. `tests/conftest.py` (Backend)
**Цель:** Добавить pytest markers для read-only режима

**Изменения:**
```python
# Добавить в pytest_configure()
def pytest_configure(config):
    config.addinivalue_line(
        "markers",
        "destructive: marks tests that modify database (skip in post-deploy)"
    )

# Пометить тесты, которые пишут в БД:
@pytest.mark.destructive
def test_create_transaction():
    # Skipped in post-deploy (writes to DB)
    pass

# Read-only тесты (без маркера):
def test_get_transactions():
    # Runs in post-deploy (read-only)
    pass
```

**Обоснование:** Предотвращение порчи данных на тестовом сервере при запуске тестов после деплоя.

### 6. GitHub Secrets (Repository Settings)
**Цель:** Добавить credentials для post-deploy тестов

**Новые secrets:**
- `TEST_DATABASE_URL` - URL развернутой PostgreSQL БД
- `TEST_REDIS_URL` - URL развернутого Redis
- `E2E_TEST_USER_EMAIL` - Email тестового пользователя
- `E2E_TEST_USER_PASSWORD` - Пароль тестового пользователя

**Обоснование:** Безопасное хранение credentials для подключения к развернутому окружению.

## Список задач для выполнения

### Задача 1: Добавление автоматических post-deploy тестов в build-and-push.yml
**Файл:** `.github/workflows/build-and-push.yml` (модификация)
**Приоритет:** Высокий (Medium Risk - изменяет critical workflow)
**Исполнитель:** DevOps + Backend + Frontend
**Зависимости:** Нет

**Подзадачи:**
- [ ] Добавить job `post-deploy-tests` после `deploy-test` job
- [ ] Реализовать matrix strategy для параллельного запуска 3 test suites:
  - [ ] Frontend: Vitest unit tests с `VITE_API_URL=https://fbd.ikeniborn.ru`
  - [ ] Backend: pytest read-only с `-m "not destructive"`
  - [ ] E2E: Playwright с `BASE_URL=https://fbd.ikeniborn.ru`
- [ ] Настроить `fail-fast: false` (все тесты выполняются даже если один падает)
- [ ] Добавить job `post-deploy-summary` для агрегации результатов
- [ ] Добавить Telegram уведомления при failures (опционально)
- [ ] Настроить upload artifacts (coverage, playwright-report)
- [ ] Добавить GitHub Secrets (TEST_DATABASE_URL, TEST_REDIS_URL, E2E credentials, TELEGRAM_*)
- [ ] Протестировать на test окружении (полный pipeline от PR до post-deploy tests)
- [ ] Code review и merge

**Критерий выполнения:** После каждого деплоя автоматически запускаются тесты, результаты видны в GitHub Actions Summary

---

### Задача 2: Рефакторинг pr-checks.yml
**Файл:** `.github/workflows/pr-checks.yml` (модификация)
**Приоритет:** Высокий
**Исполнитель:** Frontend/DevOps
**Зависимости:** Задача 1 (post-deploy workflow готов)

**Подзадачи:**
- [ ] Удалить блок "Unit & Integration Tests" (строки 100-102)
- [ ] Удалить "Upload coverage to Codecov" (строки 104-110)
- [ ] Удалить "Check coverage thresholds" (строки 112-158)
- [ ] Удалить "Upload coverage report" (строки 160-166)
- [ ] Обновить summary секцию (строка 225): указать что тесты перенесены в post-deploy
- [ ] Протестировать на новом PR
- [ ] Code review и merge

**Критерий выполнения:** PR checks завершаются за ≤8 мин (20% улучшение от 10 мин)

---

### Задача 3: Переименование backend-tests.yml
**Файл:** `.github/workflows/backend-tests.yml` → `backend-static-checks.yml`
**Приоритет:** Средний
**Исполнитель:** Backend/DevOps
**Зависимости:** Задача 1 (post-deploy workflow готов)

**Подзадачи:**
- [ ] Git rename: `backend-tests.yml` → `backend-static-checks.yml`
- [ ] Удалить PostgreSQL service (строки 23-36)
- [ ] Удалить Redis service (строки 38-46)
- [ ] Удалить pytest execution блок (строки 64-90)
- [ ] Удалить coverage checks (строки 92-115)
- [ ] Удалить coverage upload (строки 117-131)
- [ ] Добавить mypy + ruff static analysis
- [ ] Обновить workflow name: "Backend Tests" → "Backend Static Checks"
- [ ] Протестировать на новом PR
- [ ] Code review и merge

**Критерий выполнения:** Workflow завершается за ≤2 мин (от 15 мин), выполняет только static checks

---

### Задача 4: Добавление pytest markers для read-only режима
**Файл:** `tests/conftest.py` + тестовые файлы
**Приоритет:** Средний
**Исполнитель:** Backend
**Зависимости:** Нет (можно делать параллельно)

**Подзадачи:**
- [ ] Обновить `tests/conftest.py`: добавить pytest marker "destructive"
- [ ] Просмотреть все тесты в `tests/` и пометить destructive тесты:
  - [ ] `tests/integration/backend/test_auth_endpoints.py` - POST/PUT/DELETE
  - [ ] `tests/integration/backend/test_admin_delete.py` - DELETE operations
  - [ ] `tests/integration/backend/test_user_api.py` - создание/обновление users
  - [ ] `tests/models/` - model creation tests
- [ ] Протестировать локально:
  - `pytest tests/ -m "not destructive"` (только read-only)
  - `pytest tests/ -m "destructive"` (только write)
- [ ] Обновить `.github/workflows/post-deploy-tests.yml`: использовать `-m "not destructive"`
- [ ] Code review и merge

**Критерий выполнения:** Backend runtime tests в post-deploy НЕ пишут в БД, только читают

---

### Задача 5: Создание read-only database user на test сервере (опционально)
**Сервер:** budget-test (https://fbd.ikeniborn.ru/)
**Приоритет:** Средний (опциональная безопасность)
**Исполнитель:** DevOps
**Зависимости:** Нет (можно делать параллельно)

**Подзадачи:**
- [ ] SSH на test сервер
- [ ] Создать PostgreSQL read-only user:
  ```sql
  CREATE USER test_readonly WITH PASSWORD 'secure_password';
  GRANT CONNECT ON DATABASE familybudget_test TO test_readonly;
  GRANT USAGE ON SCHEMA public TO test_readonly;
  GRANT SELECT ON ALL TABLES IN SCHEMA public TO test_readonly;
  ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO test_readonly;
  ```
- [ ] Протестировать что user может читать, но не писать
- [ ] Обновить `TEST_DATABASE_URL` secret с новым user
- [ ] Документировать в плане

**Критерий выполнения:** Backend тесты используют read-only user и не могут писать в БД (double protection)

---

### Задача 6: Обновление документации
**Файлы:** `docs/architecture/operations/ci-cd-build-deploy.md`, `README.md`
**Приоритет:** Низкий
**Исполнитель:** Tech Writer / DevOps
**Зависимости:** Задачи 1-5 завершены

**Подзадачи:**
- [ ] Обновить `ci-cd-build-deploy.md`:
  - Добавить секцию "Post-Deploy Testing Workflow"
  - Обновить диаграмму CI/CD pipeline
  - Документировать manual trigger процесс
- [ ] Обновить `README.md`:
  - Добавить инструкции по запуску post-deploy тестов
  - Обновить раздел "Testing Strategy"
- [ ] Провести team training (демонстрация нового workflow)
- [ ] Code review и merge

**Критерий выполнения:** Команда обучена новому процессу, документация актуальна

---

## Поэтапный план выполнения (4 фазы)

### PHASE 1: Подготовка pytest markers (Low Risk)
**Продолжительность:** 1 день

**Действия:**
1. Обновить `tests/conftest.py`: добавить marker "destructive"
2. Пометить write-тесты в `tests/` маркером `@pytest.mark.destructive`
3. Протестировать локально: `pytest tests/ -m "not destructive"`
4. Code review и merge в test ветку

**Rollback:** Удалить markers из conftest.py и тестов

**Критерий успеха:** Read-only тесты выполняются локально без записи в БД

---

### PHASE 2: Обновление pr-checks.yml (Low Risk)
**Продолжительность:** 1 день

**Действия:**
1. **Удалить строки 100-166:**
   - `- name: Unit & Integration Tests`
   - `- name: Upload coverage to Codecov`
   - `- name: Check coverage thresholds`
   - `- name: Upload coverage report`
2. **Сохранить строки 63-98:** Frontend build validation (ESLint, build:css, bundle, size check)
3. **Сохранить строки 187-196:** Backend static checks (mypy, ruff)
4. Обновить summary (строка 224-227):
   ```diff
   - - ⚡ Frontend unit tests: Run once in CI with full coverage
   + - ⚡ Frontend unit tests: Moved to post-deploy workflow (manual)
   ```
5. Протестировать на новом PR

**Rollback:** Восстановить удаленные строки через git revert

**Критерий успеха:** PR checks завершаются за ~8 мин (было ~10 мин)

---

### PHASE 3: Переименование backend-tests.yml (Low Risk)
**Продолжительность:** 1 день

**Действия:**
1. **Git rename:** `backend-tests.yml` → `backend-static-checks.yml`
2. **Удалить строки 23-46:** PostgreSQL + Redis services
3. **Удалить строки 64-130:** pytest execution с coverage
4. **Добавить:** mypy + ruff static analysis
5. **Обновить workflow name:** `Backend Tests` → `Backend Static Checks`
6. Протестировать на новом PR

**Rollback:** Переименовать обратно, восстановить pytest секции

**Критерий успеха:** Workflow завершается за ~2 мин (было ~15 мин)

---

### PHASE 4: Добавление автоматических post-deploy тестов (Medium Risk)
**Продолжительность:** 3 дня

**Действия:**
1. **Добавить GitHub Secrets:**
   - `TEST_DATABASE_URL` (read-only user рекомендуется)
   - `TEST_REDIS_URL`
   - `E2E_TEST_USER_EMAIL`
   - `E2E_TEST_USER_PASSWORD`
   - `TELEGRAM_CHAT_ID` (опционально)
   - `TELEGRAM_BOT_TOKEN` (опционально)

2. **Модифицировать `.github/workflows/build-and-push.yml`:**
   - Добавить job `post-deploy-tests` после `deploy-test` (см. секцию 3)
   - Matrix strategy: [frontend, backend, e2e]
   - Добавить job `post-deploy-summary`
   - Настроить Telegram notifications
   - Настроить artifacts upload

3. **Протестировать полный pipeline:**
   - Создать тестовый PR
   - Merge в test ветку
   - Проверить что deploy успешен
   - Проверить что post-deploy tests запускаются автоматически
   - Проверить Telegram уведомления (если настроены)
   - Проверить artifacts (coverage reports, playwright reports)

4. **Rollback plan:**
   - Удалить jobs `post-deploy-tests` и `post-deploy-summary`
   - Восстановить предыдущую версию build-and-push.yml

**Критерий успеха:**
- ✅ Post-deploy тесты запускаются автоматически после deploy
- ✅ Параллельное выполнение 3 test suites (~5-6 мин вместо ~15 мин)
- ✅ Уведомления при failures работают
- ✅ Artifacts загружаются и доступны для анализа

---

## Документация

### Файлы для обновления:

1. **docs/architecture/operations/ci-cd-build-deploy.md**
   - Добавить секцию "Post-Deploy Testing Workflow"
   - Обновить диаграмму CI/CD pipeline
   - Документировать manual trigger процесс

2. **README.md**
   - Добавить инструкции по запуску post-deploy тестов
   - Обновить раздел "Testing"

3. **docs/prd/** (если есть PRD документация)
   - Обновить Testing Strategy секцию

## Верификация изменений

### End-to-End Test Scenario

1. **Создать PR в test ветку:**
   - Проверить что static checks запускаются (~8 мин)
   - Проверить что runtime тесты НЕ запускаются
   - ✅ PR checks завершаются быстрее

2. **Merge PR:**
   - Проверить автоматический деплой (15 мин)
   - ✅ Deployment successful message появляется

3. **Проверить GitHub Step Summary:**
   - ✅ Инструкции для post-deploy тестов видны
   - ✅ Ссылки на workflows работают

4. **Вручную запустить post-deploy тесты:**
   - Перейти в Actions → Post-Deploy Tests
   - Выбрать "All tests" + "https://fbd.ikeniborn.ru"
   - ✅ Все 4 jobs выполняются успешно
   - ✅ Backend тесты не пишут в БД

5. **Проверить покрытие тестами:**
   - Frontend coverage report загружен в Codecov
   - Backend coverage report загружен в Codecov
   - ✅ Coverage thresholds соблюдены

## Риски и митигация

### Risk 1: Backend тесты портят данные на тестовом сервере
**Вероятность:** Low (с read-only pattern)
**Влияние:** High
**Митигация:**
- Строгий `@pytest.mark.destructive` pattern
- pytest execution: `-m "not destructive"`
- Database user с read-only permissions (опционально)
- Backup test database перед тестированием (опционально)

### Risk 2: Post-deploy тесты увеличивают общее время pipeline
**Вероятность:** Гарантировано (100%)
**Влияние:** Low (только +6 мин с matrix parallel)
**Митигация:**
- Matrix strategy для параллельного запуска тестов
- Оптимизация E2E тестов (сократить количество браузер-конфигураций если нужно)
- `fail-fast: false` чтобы все тесты выполнялись даже если один падает

### Risk 3: E2E тесты flaky (нестабильные)
**Вероятность:** Medium
**Влияние:** Medium (ложные срабатывания уведомлений)
**Митигация:**
- Playwright retry mechanism (уже настроен: 2 retries в CI)
- Улучшение waitForSelector и explicit waits
- Отдельный job для E2E с `continue-on-error: true` (опционально)

### Risk 4: Отсутствие coverage в PR
**Вероятность:** Low
**Влияние:** Medium
**Митигация:**
- Комплексный static analysis (ESLint, TypeScript, mypy, ruff)
- Build validation гарантирует компиляцию
- Code review процесс остается обязательным

## Performance Impact

### PR Checks (До vs После)

| Метрика | До | После | Изменение |
|---------|-----|-------|-----------|
| PR checks duration | ~10 мин | ~5 мин | ⚡ 50% быстрее |
| Feedback время для разработчика | 10 мин | 5 мин | ⚡ 5 мин экономии |

### Post-Deploy Testing (Новый автоматический step)

| Стратегия | Продолжительность | Примечание |
|-----------|-------------------|------------|
| **Последовательно** (without matrix) | ~15 мин | Frontend → Backend → E2E |
| **Параллельно** (matrix strategy) | ~6 мин | Все 3 suite одновременно ⚡ |

**Выбор:** Matrix strategy (параллельно) для минимизации времени

### Общее время от PR до production-ready с валидацией

**До:**
```
PR checks (10 мин) + Merge + Deploy (15 мин) = ~25 мин
❌ НО: неизвестно работает ли деплой на реальном окружении
```

**После:**
```
PR static checks (5 мин) + Merge + Deploy (15 мин) + Auto post-deploy tests (6 мин parallel) = ~26 мин
✅ С гарантией что деплой работает корректно
```

**Итоговый trade-off:** +1 мин общего времени, но с полной валидацией развернутого окружения

### Детальная разбивка по фазам

| Фаза | Продолжительность | Тип | Блокирует Merge? |
|------|-------------------|-----|------------------|
| **PR static checks** | ~5 мин | Automatic | ✅ Да |
| **Deploy** | ~15 мин | Automatic | ❌ Нет (после merge) |
| **Post-deploy tests (parallel)** | ~6 мин | Automatic | ❌ Нет (не блокирует) |
| **Total** | **~26 мин** | - | - |

**Преимущество:** PR feedback быстрее (5 мин vs 10 мин), общее время почти не изменилось (+1 мин)

## Важные уточнения

### Почему api-contract-tests.yml остается автоматическим?

**Вопрос:** Этот workflow запускает PostgreSQL и backend - почему не переносим в post-deploy?

**Ответ:** `api-contract-tests.yml` - это **contract validation**, а не runtime tests:
- Проверяет **структуру** API (OpenAPI schema), а не business logic
- Детектирует **breaking changes** в API endpoints
- Генерирует **TypeScript types** для frontend

**Это статический анализ контракта**, хоть и требует запуска backend. Цель - найти breaking changes ДО мерджа, а не тестировать данные.

**Оставляем автоматическим при PR** для быстрой обратной связи о breaking changes.

---

### Структура backend тестов

**Текущая организация:**
```
tests/
├── unit/              # Unit тесты (НО используют БД через fixtures)
│   └── backend/       # ~15 файлов
├── integration/       # Integration тесты (явно требуют БД)
│   └── backend/       # ~6 файлов
└── models/            # Model тесты (~2 файла)
```

**Проблема:** Даже "unit" тесты используют `db_session` fixture с PostgreSQL (см. `conftest.py`). Так что **все pytest тесты - runtime tests**.

**Решение:** Убрать ВСЕ pytest из PR checks, перенести в post-deploy с read-only маркерами.

**Альтернатива (НЕ в scope текущей задачи):**
- Переделать `tests/unit/` чтобы использовали mock БД (SQLAlchemy inmemory)
- Оставить unit тесты в PR checks (быстро, без реальной БД)
- Перенести только integration тесты в post-deploy

**Но это требует значительного рефакторинга тестов** - отложим на будущее.

---

## Успешные критерии

Изменения считаются успешными если:

1. ✅ PR checks завершаются за ≤8 мин (20% улучшение от ~10 мин)
2. ✅ Автоматические проверки при PR: ~28 мин (было ~46 мин) - экономия 18 мин
3. ✅ Post-deploy workflow успешно запускается вручную
4. ✅ Backend тесты не пишут в БД (read-only режим с pytest markers)
5. ✅ Frontend/Backend/E2E тесты проходят на развернутом окружении
6. ✅ Coverage reports загружаются в Codecov из post-deploy workflow
7. ✅ Deployment summary содержит четкие инструкции с ссылками
8. ✅ Команда обучена новому процессу (team training проведен)
9. ✅ Документация обновлена и актуальна
10. ✅ api-contract-tests.yml продолжает работать автоматически при PR

## Общая Timeline

| Фаза | Продолжительность | Риск | Приоритет |
|------|-------------------|------|-----------|
| PHASE 1: Подготовка pytest markers | 1 день | Low | Высокий |
| PHASE 2: Update pr-checks.yml | 1 день | Low | Высокий |
| PHASE 3: Rename backend-tests.yml | 1 день | Low | Средний |
| PHASE 4: Добавление auto post-deploy tests | 3 дня | Medium | Критический |
| Документация + Team training | 1 день | None | Средний |
| **Итого** | **7 рабочих дней** | **Medium** | - |

**Критический путь:** PHASE 4 (добавление автоматических тестов) - самая важная и рискованная фаза

## Рекомендации

1. **Начать с PHASE 1** (zero risk) - создать post-deploy workflow и протестировать его изолированно
2. **Поэтапный rollout** - выполнять фазы последовательно, валидировать каждую перед переходом к следующей
3. **Сохранить rollback capability** - использовать feature branches для каждой фазы
4. **Team communication** - информировать команду о новом процессе после PHASE 1
5. **Monitoring** - отслеживать как часто запускаются post-deploy тесты в первый месяц
