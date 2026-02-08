# Руководство по локальному тестированию

**Last Updated:** 2026-02-08
**Version:** 1.0.0
**Status:** Active

## Обзор

С версии 11.4.10 **все UI тестирование (E2E, accessibility) перенесено на локальное выполнение** для ускорения разработки и снижения нагрузки на CI/CD.

**Что изменилось:**
- ❌ E2E тесты удалены из GitHub Actions CI/CD
- ❌ Accessibility тесты удалены из GitHub Actions CI/CD
- ✅ Все тесты теперь запускаются локально перед commit/PR
- ✅ Backend unit/integration тесты остались в CI/CD (pytest)

---

## Доступные типы тестов

### 1. E2E тесты (Playwright) - UI тестирование

**Назначение:** Тестирование UI flows против test сервера (`https://fbd.ikeniborn.ru/`)

**Расположение:** `tests/e2e/webapp/`

**Команды:**

```bash
# UI Mode - РЕКОМЕНДУЕТСЯ для разработки (интерактивный режим)
npm run test:e2e:ui

# Запустить все тесты (headless)
npm run test:e2e

# Только Chromium (быстрее)
npm run test:e2e:chromium

# Headed mode (видеть браузер)
npm run test:e2e:headed

# Debug mode (пошаговое выполнение)
npm run test:e2e:debug

# Посмотреть HTML report
npm run test:e2e:report

# Генерация тестов (запись действий в браузере)
npm run test:e2e:codegen
```

**Примеры:**

```bash
# Тестировать форму транзакций
npm run test:e2e:ui -- webapp/test_form_submission.spec.ts

# Тестировать mobile navigation
npm run test:e2e:ui -- webapp/test_mobile_navigation.spec.ts

# Тестировать offline функциональность
npm run test:e2e:ui -- webapp/test_offline_functionality.spec.ts
```

**Всего тестов:** 45 E2E тестов (6 spec файлов)

---

### 2. Component тесты (Vitest) - Unit/Integration

**Назначение:** Тестирование frontend компонентов в изоляции (без backend)

**Расположение:** `frontend/tests/`

**Команды:**

```bash
# Watch mode (автоматический перезапуск)
npx vitest --watch

# UI Mode (интерактивный режим)
npx vitest --ui

# Запустить все тесты с coverage
npm run test:coverage

# Конкретный тест
npx vitest frontend/tests/unit/components/core/AmountInput.test.ts
```

**Примеры:**

```bash
# Тестировать все form компоненты
npx vitest frontend/tests/unit/components/forms/

# Тестировать Dexie.js database
npx vitest frontend/shared/db/dexie/

# Тестировать списки покупок
npx vitest frontend/tests/unit/features/listsManager/
```

**Всего тестов:** ~90+ component тестов

---

### 3. Backend тесты (pytest) - Unit/Integration

**Назначение:** Тестирование backend API, database, business logic

**Расположение:** `tests/unit/`, `tests/integration/`

**Команды:**

```bash
# Все backend тесты
pytest tests/

# Только unit тесты
pytest tests/unit/

# Только integration тесты (требуют БД)
pytest tests/integration/

# С coverage
pytest tests/ --cov=backend --cov-report=html
```

**Примечание:** Backend тесты **остались в CI/CD** для проверки на каждом PR.

---

## Workflow перед commit

### Быстрая проверка (минимум)

```bash
# 1. TypeScript type check
npm run type-check

# 2. Frontend component тесты (быстро < 10s)
npx vitest --run

# 3. Backend unit тесты (если изменяли backend)
pytest tests/unit/
```

### Полная проверка (перед PR)

```bash
# 1. Type check
npm run type-check

# 2. Vitest component тесты
npm run test:coverage

# 3. Playwright E2E тесты (UI Mode для визуальной проверки)
npm run test:e2e:ui
# → Запустить критичные тесты (форма транзакций, mobile navigation)

# 4. Backend тесты
pytest tests/ --cov=backend

# 5. Lint
npm run lint
```

**Время выполнения:**
- Type check: ~5-10s
- Vitest: ~10-30s
- Playwright (selective): ~2-5 мин (5-10 тестов)
- Pytest: ~30-60s
- **Итого: ~4-7 минут**

---

## E2E тестирование - Детальное руководство

### Первоначальная настройка (один раз)

```bash
# 1. Проверить что Playwright установлен
npx playwright --version
# → Version 1.57.0

# 2. Проверить что .env.test настроен
cat .env.test
# → Должен содержать TEST_USER_EMAIL и TEST_USER_PASSWORD

# 3. Проверить auth state
ls -la tests/e2e/.auth/user.json
# → Файл должен существовать (создается при первом запуске)

# 4. Запустить тест для проверки
npm run test:e2e:chromium -- webapp/test_webapp_loading.spec.ts --grep "JavaScript modules"
```

### UI Mode - интерактивная разработка

**UI Mode - это ЛУЧШИЙ способ** для локального UI тестирования:

```bash
npm run test:e2e:ui
```

**Возможности:**
- ✅ Визуальный просмотр всех тестов
- ✅ Live execution (кликнули → тест запустился)
- ✅ Watch mode (автоматический перезапуск при изменении файлов)
- ✅ Time travel debugging (перемотка назад/вперед)
- ✅ Snapshot comparison (скриншоты каждого шага)
- ✅ Pick locator (выбор элементов на странице)

**Workflow:**

1. Открывается UI с list всех тестов
2. Кликаете на тест → он запускается в браузере
3. Видите каждый шаг с скриншотами
4. Если упал, можете перемотать назад
5. Pick Locator для поиска элементов

**Пример использования:**

```bash
# 1. Запустить UI Mode
npm run test:e2e:ui

# 2. В UI Mode:
#    - Выбрать test_form_submission.spec.ts
#    - Запустить тест "should fill transaction form"
#    - Увидеть текущее состояние UI на test сервере

# 3. Если нужны изменения:
#    - Изменить CSS/JS локально
#    - npm run build:prod
#    - git commit + push
#    - Дождаться CI/CD deploy (7-11 мин)
#    - Перезапустить тест в UI Mode → увидеть изменения
```

### Codegen - генерация тестов

**Codegen** записывает ваши действия в браузере в Playwright тест:

```bash
npm run test:e2e:codegen
```

**Workflow:**

1. Браузер откроется с inspector панелью
2. Взаимодействуйте с UI (клик, ввод, навигация)
3. Playwright генерирует код автоматически
4. Копируйте код в новый `.spec.ts` файл

**Пример: Создать тест для добавления recurring plan**

```bash
# 1. Запустить codegen с авторизацией
npm run test:e2e:codegen

# 2. В браузере:
#    - Кликнуть FAB → "Add Plan"
#    - Заполнить форму (название, сумма, частота)
#    - Нажать Save

# 3. Скопировать сгенерированный код:
# await page.locator('#fab-btn').click();
# await page.locator('button[title="Добавить план"]').click();
# await page.locator('input[name="name"]').fill('Аренда');
# await page.locator('input[name="amount"]').fill('50000');
# // ... etc

# 4. Создать tests/e2e/webapp/test_recurring_plans.spec.ts
# 5. Вставить код + обернуть в test()
```

### Создание нового E2E теста

**Структура теста:**

```typescript
/**
 * E2E Tests: [Feature Name]
 *
 * Tests [feature description]:
 * - [Test case 1]
 * - [Test case 2]
 * - [Test case 3]
 *
 * Authentication: Uses storage state from global setup (tests/e2e/setup/auth.setup.ts)
 */

import { test, expect } from '@playwright/test';

// Viewport sizes
const VIEWPORTS = {
  mobile: { width: 375, height: 667 },
  desktop: { width: 1920, height: 1080 },
};

test.describe('[Feature Name]', () => {
  test.beforeEach(async ({ page }) => {
    // Authentication handled by global setup (storage state)
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    // Wait for critical resources
    await page.waitForSelector('#fab-btn', { state: 'visible', timeout: 10000 });

    // Close cookie consent modal if present
    const acceptAllButton = page.locator('button:has-text("Принять все")');
    const isVisible = await acceptAllButton.isVisible({ timeout: 3000 }).catch(() => false);
    if (isVisible) {
      await acceptAllButton.click();
      await page.waitForSelector('#cookie-consent-banner', { state: 'hidden', timeout: 5000 });
    }
  });

  test('should [test case description]', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.desktop);

    // Test logic here
    const element = page.locator('#some-element');
    await expect(element).toBeVisible();

    // Assertions
    await expect(element).toHaveText('Expected text');
  });
});
```

**Пример: tests/e2e/webapp/test_recurring_plans.spec.ts**

```typescript
test.describe('Recurring Plans', () => {
  test('should create monthly recurring plan', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.desktop);

    // Open FAB
    await page.locator('#fab-btn').click();

    // Wait for Speed Dial menu (if mobile) or direct modal (if desktop)
    const speedDialMenu = page.locator('#fab-speed-dial-menu');
    const speedDialVisible = await speedDialMenu.isVisible({ timeout: 1000 }).catch(() => false);

    if (speedDialVisible) {
      // Mobile: click "Add Plan" in Speed Dial
      await page.locator('button[title="Добавить план"]').click();
    } else {
      // Desktop: modal opens directly
      // (Need to trigger plan modal specifically - depends on UI)
    }

    // Modal should be open
    const modal = page.locator('#modal_plan[open]');
    await expect(modal).toBeVisible({ timeout: 5000 });

    // Fill form
    await page.locator('input[name="name"]').fill('Аренда');
    await page.locator('input[name="amount"]').fill('50000');
    await page.locator('select[name="frequency"]').selectOption('monthly');

    // Save
    await page.locator('#modal_plan button.btn-primary').click();

    // Verify success (check for toast or table update)
    // ... assertions
  });
});
```

---

## Visual Regression Testing

Playwright поддерживает visual regression тесты (сравнение скриншотов):

**Файл:** `tests/e2e/webapp/test_visual_regression.spec.ts`

**Создание baseline скриншотов:**

```bash
# Первый запуск создаст baseline скриншоты
npm run test:e2e:chromium -- webapp/test_visual_regression.spec.ts

# Baseline сохраняются в tests/e2e/webapp/test_visual_regression.spec.ts-snapshots/
```

**Обновление baseline:**

```bash
# Если UI изменился специально, обновить baseline
npm run test:e2e:chromium -- webapp/test_visual_regression.spec.ts --update-snapshots
```

**Проверка regression:**

```bash
# Запустить тесты - упадут если UI изменился
npm run test:e2e:ui -- webapp/test_visual_regression.spec.ts

# В UI Mode увидите diff между baseline и current
```

---

## Troubleshooting

### E2E тесты не находятся

**Проблема:**
```bash
npm run test:e2e -- --list
# → Error: No tests found
```

**Решение:**
```bash
# Проверить что playwright.config.ts настроен правильно
cat config/playwright.config.ts | grep testDir
# → testDir: path.join(__dirname, '../tests/e2e'),

# Проверить что .spec.ts файлы существуют
ls -la tests/e2e/webapp/*.spec.ts
```

### Auth setup failed

**Проблема:**
```bash
[AUTH] Login failed with error: Invalid credentials
```

**Решение:**
```bash
# Проверить .env.test credentials
cat .env.test
# TEST_USER_EMAIL=e2e-test-1@example.com
# TEST_USER_PASSWORD=E2eTestPassword123!

# Проверить что test user существует на https://fbd.ikeniborn.ru/
curl -X POST https://fbd.ikeniborn.ru/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "e2e-test-1@example.com", "password": "E2eTestPassword123!"}'

# Если пользователь не существует, создать через UI:
open https://fbd.ikeniborn.ru/register
```

### Vitest imports conflict

**Проблема:**
```bash
npx playwright test
# → Error: Vitest cannot be imported in a CommonJS module
```

**Решение:**
```bash
# Убедиться что playwright.config.ts имеет testMatch
cat config/playwright.config.ts | grep testMatch
# → testMatch: /.*\.spec\.ts$/,

# Это исключает .test.ts файлы (Vitest)
```

### Test сервер недоступен

**Проблема:**
```bash
npm run test:e2e
# → Timeout waiting for https://fbd.ikeniborn.ru
```

**Решение:**
```bash
# Проверить что test сервер доступен
curl https://fbd.ikeniborn.ru/health

# Если недоступен:
# 1. Проверить VPN/proxy
# 2. Проверить статус сервера (ssh budget-test)
# 3. Использовать headless: false для debugging
```

---

## Migration Notes

### Что было удалено из CI/CD

**Файлы:**
- `.github/workflows/e2e-tests.yml` → `.github/workflows/e2e-tests.yml.disabled`
- `.github/workflows/accessibility-tests.yml` → `.github/workflows/accessibility-tests.yml.disabled`

**Что осталось в CI/CD:**
- ✅ Frontend build & cache busting
- ✅ TypeScript type check
- ✅ ESLint
- ✅ Backend unit tests (pytest)
- ✅ Backend integration tests (pytest)
- ✅ Docker image builds
- ✅ Security scans

**Преимущества локального тестирования:**
- ⚡ Мгновенная обратная связь (UI Mode)
- 🔍 Интерактивный debugging (time travel, pick locator)
- 💰 Снижение нагрузки на CI/CD runners
- 🚀 Ускорение CI/CD pipeline (без E2E ~5-8 мин вместо 15-20 мин)

---

## См. также

- [docs/architecture/operations/local-ui-testing.md](../architecture/operations/local-ui-testing.md) - Подробное руководство по локальному UI тестированию
- [docs/testing/e2e-test-user-setup.md](./e2e-test-user-setup.md) - Настройка test user
- [config/playwright.config.ts](../../config/playwright.config.ts) - Playwright конфигурация
- [config/vitest.config.ts](../../config/vitest.config.ts) - Vitest конфигурация

---

**Last Updated:** 2026-02-08
