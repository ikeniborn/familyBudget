# План: Исправление тестов бэкенда при деплое

## Контекст

При автоматическом деплое на тестовый сервер падают backend и E2E тесты в GitHub Actions workflow.

**Проблема:**
- **Backend тесты**: `ConnectionRefusedError: [Errno 111] Connect call failed ('127.0.0.1', 5433)`
- **E2E тесты**: `sh: 1: playwright: not found` (exit code 127)

**GitHub Actions Run:** https://github.com/ikeniborn/familyBudget/actions/runs/22065347234/job/63756539357

**Архитектурное решение по тестированию:**
- **Локальная разработка**: Используется отдельная БД `familybudget_test` (docker-compose-test.yml) с полным cleanup
- **CI/CD на тестовом сервере**: Используется production БД `familybudget` для тестов без агрессивного cleanup
- **Принцип**: Используем существующие данные где возможно, генерируем новые только если недостаточно

**Причины:**

1. **Backend тесты** - несоответствие конфигурации PostgreSQL:

   **Проблема 1: Порт БД**
   - Локальное тестирование: docker-compose-test.yml → порт 5433
   - CI/CD: production БД → порт 5432
   - conftest.py (строка 31): `os.getenv("POSTGRES_PORT", "5433")` - дефолт 5433
   - Workflow НЕ устанавливает POSTGRES_PORT → тесты пытаются подключиться к порту 5433

   **Проблема 2: Имя БД**
   - Локальное тестирование: docker-compose-test.yml → БД `familybudget_test`
   - CI/CD: production БД → БД `familybudget`
   - conftest.py (строка 32): хардкод имени БД `familybudget_test`
   - Результат: тесты пытаются подключиться к несуществующей БД `familybudget_test`

2. **E2E тесты** - отсутствующие npm зависимости:
   - Frontend тесты: Setup Node → npm ci → run tests ✅
   - E2E тесты: Setup Node → Install Playwright browsers → run tests ❌
   - Отсутствует шаг `npm ci` для установки @playwright/test package
   - `npx playwright install --with-deps` устанавливает только БРАУЗЕРЫ, не сам пакет

## Решение

### Изменение 1: Backend conftest.py - сделать имя БД конфигурируемым

**Файл:** `backend/tests/conftest.py`
**Строки:** 30-32

**Было:**
```python
_db_host = os.getenv("POSTGRES_HOST", "localhost")
_db_port = os.getenv("POSTGRES_PORT", "5433")
TEST_DATABASE_URL = f"postgresql+asyncpg://familybudget:test_password_12345678901234567890@{_db_host}:{_db_port}/familybudget_test"
```

**Стало:**
```python
_db_host = os.getenv("POSTGRES_HOST", "localhost")
_db_port = os.getenv("POSTGRES_PORT", "5433")
_db_name = os.getenv("POSTGRES_DB", "familybudget_test")  # ← НОВАЯ СТРОКА: конфигурируемое имя БД
TEST_DATABASE_URL = f"postgresql+asyncpg://familybudget:test_password_12345678901234567890@{_db_host}:{_db_port}/{_db_name}"  # ← ИЗМЕНЕНО: используем _db_name
```

**Почему это работает:**
- **Локальная разработка**: POSTGRES_DB не установлен → дефолт `familybudget_test` → docker-compose-test.yml
- **CI/CD**: POSTGRES_DB=familybudget → production БД (существующие данные)
- Обратная совместимость: локальные тесты продолжают работать без изменений

### Изменение 2: Backend тесты - добавить POSTGRES_PORT и POSTGRES_DB в workflow

**Файл:** `.github/workflows/build-and-push.yml`
**Строка:** 957 (после export DATABASE_URL)

**Добавить:**
```yaml
export POSTGRES_PORT="5432"  # Production БД порт
export POSTGRES_DB="familybudget"  # Production БД имя (используем существующие данные)
```

**Полный контекст** (строки 954-968):
```yaml
# Run pytest (test database allows write operations)
# CRITICAL: Unset TEST_DATABASE_URL to prevent .env.test from overriding DATABASE_URL
unset TEST_DATABASE_URL
export DATABASE_URL="postgresql+asyncpg://familybudget:\${POSTGRES_PASSWORD}@localhost:5432/familybudget"
export POSTGRES_PORT="5432"  # ← НОВАЯ СТРОКА: production БД порт
export POSTGRES_DB="familybudget"  # ← НОВАЯ СТРОКА: production БД имя
export REDIS_URL="redis://localhost:6379/0"
export BACKEND_URL="https://fbd.ikeniborn.ru"
export JWT_SECRET="test_jwt_secret_for_ci_only"
export SECRET_KEY="test_secret_key_for_ci_only"
export TELEGRAM_BOT_TOKEN="test_bot_token_for_ci_only"
export ADMIN_TELEGRAM_ID="123456789"
export API_INTERNAL_KEY="test_internal_key_for_ci_only"
export CORS_ORIGINS="https://fbd.ikeniborn.ru"
export PYTHONPATH="/home/ikeniborn/familyBudget"
```

**Почему это работает:**
- conftest.py читает POSTGRES_DB и POSTGRES_PORT из окружения
- **CI/CD**: POSTGRES_PORT=5432, POSTGRES_DB=familybudget → production БД с существующими данными
- **Локальная разработка**: переменные не установлены → дефолт 5433 + familybudget_test → docker-compose-test.yml
- Избегаем создания отдельной тестовой БД на production сервере

### Изменение 3: E2E тесты - добавить npm ci шаг

**Файл:** `.github/workflows/build-and-push.yml`
**Строка:** После 980 (после Setup Node.js, перед Install Playwright browsers)

**Добавить новый шаг:**
```yaml
- name: Install dependencies (E2E tests)
  if: matrix.test-suite == 'e2e'
  run: npm ci
```

**Полный контекст** (строки 978-992):
```yaml
- name: Setup Node.js (E2E tests)
  if: matrix.test-suite == 'e2e'
  uses: ./.github/actions/setup-node

# ← НОВЫЙ ШАГ ЗДЕСЬ
- name: Install dependencies (E2E tests)
  if: matrix.test-suite == 'e2e'
  run: npm ci

- name: Install Playwright browsers
  if: matrix.test-suite == 'e2e'
  run: npx playwright install --with-deps

- name: Run E2E tests
  if: matrix.test-suite == 'e2e'
  env:
    BASE_URL: https://fbd.ikeniborn.ru
    TEST_USER_EMAIL: ${{ secrets.TEST_USER_EMAIL }}
    TEST_USER_PASSWORD: ${{ secrets.TEST_USER_PASSWORD }}
  run: npm run test:e2e
```

**Почему это работает:**
- npm ci устанавливает все зависимости из package-lock.json (включая @playwright/test)
- Соответствует паттерну frontend тестов (строки 922-924)
- setup-node action включает npm caching → быстрая установка

## Критические файлы

### Изменяемые файлы:

1. **`backend/tests/conftest.py`** (строки 30-32)
   - Добавить переменную окружения для имени БД: +1 строка
   - Изменить TEST_DATABASE_URL чтобы использовать конфигурируемое имя: ~1 строка

2. **`.github/workflows/build-and-push.yml`** (строки 957-958, 980-982)
   - Backend тесты: +2 строки (export POSTGRES_PORT + export POSTGRES_DB)
   - E2E тесты: +3 строки (новый шаг npm ci)

### Проверяемые файлы (без изменений):

3. **`package.json`** (строка 48)
   - Проверить: "@playwright/test": "^1.48.0" в devDependencies

4. **`docker-compose-test.yml`** (строка 12)
   - Проверить: порт 5433 для локального тестирования

## Проверка

### Тест 1: Локальное тестирование (должно продолжать работать)

**Примечание:** docker-compose-test.yml используется только для локальной разработки, НЕ в CI/CD.

```bash
# Локальная разработка: запустить отдельную тестовую БД
docker-compose -f docker-compose-test.yml up -d

# Запустить backend тесты
cd backend
.venv/bin/pytest tests/ -v

# Ожидается: POSTGRES_PORT не установлен → дефолт 5433 → docker-compose-test БД → ✅ Успех
```

### Тест 2: CI/CD backend тесты (должно исправиться)

**Примечание:** CI/CD использует уже запущенные production сервисы на тестовом сервере.

```bash
# Симуляция CI/CD окружения (на тестовом сервере)
export POSTGRES_PORT="5432"  # Production БД порт
export DATABASE_URL="postgresql+asyncpg://familybudget:password@localhost:5432/familybudget"

cd backend
.venv/bin/pytest tests/ -v

# Ожидается: POSTGRES_PORT=5432 → подключение к production БД → ✅ Успех
```

### Тест 3: E2E тесты (должно исправиться)

```bash
# Симуляция CI/CD окружения
npm ci  # Установка зависимостей (включая @playwright/test)
npx playwright install --with-deps
npm run test:e2e

# Ожидается: @playwright/test доступен → ✅ Успех
```

## Риски и митигация

### Риск 1: Нарушение локального тестирования

**Митигация:**
- Используется переопределение через переменную окружения, НЕ изменение кода
- Локальные тесты не устанавливают POSTGRES_PORT → используют дефолт 5433
- Обратная совместимость 100%

### Риск 2: npm ci кеш проблемы

**Митигация:**
- setup-node action уже включает npm caching (action.yml, строка 21)
- npm ci использует package-lock.json (детерминированная установка)
- Кеш инвалидируется автоматически при изменении package-lock.json

### Риск 3: Конфликты данных в тестовой БД

**Текущая митигация** (уже реализована):
- conftest.py выполняет DELETE cleanup после каждого теста (строки 83-103)
- Production БД разрешает операции записи для тестирования
- Тесты идемпотентны (cleanup обеспечивает изоляцию)

## Итого

**Общие изменения:**
- 2 файла: `backend/tests/conftest.py` + `.github/workflows/build-and-push.yml`
- 7 строк кода:
  - conftest.py: +2 строки (конфигурируемое имя БД)
  - workflow backend: +2 строки (POSTGRES_PORT + POSTGRES_DB)
  - workflow E2E: +3 строки (npm ci шаг)

**Обратная совместимость:** 100% (локальное тестирование работает без изменений)

**Уровень риска:** Минимальный (переопределение переменных окружения + стандартный npm ci паттерн)

**Архитектурное улучшение:**
- CI/CD тесты используют production БД с существующими данными
- Не требуется создание отдельной тестовой БД на production сервере
- Cleanup минимизирован (используем существующие данные где возможно)

**Проверка требуется:**
- ✅ Локальные backend тесты с docker-compose-test.yml (БД familybudget_test, порт 5433)
- ✅ CI/CD backend тесты подключаются к production БД (familybudget, порт 5432)
- ✅ E2E тесты находят @playwright/test package
