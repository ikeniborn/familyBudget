# План миграции конфигов в config/ директорию

**Дата:** 2026-02-01
**Версия:** v11.0.9
**Цель:** Переместить все конфигурационные файлы из root в `config/`

---

## 📋 Конфиги для переноса

| Файл | Размер | Инструмент | Поддержка кастомного пути | Сложность |
|------|--------|------------|---------------------------|-----------|
| `vite.config.ts` | 4.3KB | Vite | ✅ `--config` flag | 🟢 Простая |
| `vite.config.single.ts` | 6.5KB | Vite | ✅ `--config` flag | 🟢 Простая |
| `vite-plugin-sw-version.ts` | 1.6KB | Vite plugin | ⚠️ Относительный import | 🟡 Средняя |
| `eslint.config.js` | 3.4KB | ESLint 9+ | ✅ Flat config system | 🟢 Простая |
| `tailwind.config.js` | 2.1KB | Tailwind CSS | ✅ `-c` flag | 🟢 Простая |
| `postcss.config.js` | 2.0KB | PostCSS | ✅ `--config` flag | 🟢 Простая |
| `playwright.config.ts` | 3.5KB | Playwright | ✅ `-c` flag | 🟢 Простая |
| `vitest.config.ts` | 3.7KB | Vitest | ✅ `--config` flag | 🟢 Простая |
| `tsconfig.json` | 1.9KB | TypeScript | ✅ `-p` flag | 🟢 Простая |
| `pytest.ini` | 942B | Pytest | ✅ `-c` flag | 🟢 Простая |

**Итого:** 10 конфигов, ~30KB

---

## ✅ Детальный план по каждому конфигу

### 1. Vite (vite.config.ts, vite.config.single.ts)

**Поддержка кастомного пути:** ✅ Да

**CLI флаг:** `--config <path>`

**Изменения:**

```json
// package.json
{
  "scripts": {
    "bundle": "node build-all.js --config config/vite.config.ts",
    "dev": "vite --config config/vite.config.ts"
  }
}
```

**build-all.js:**
```javascript
// Было
const viteBuild = spawn('vite', ['build', ...]);

// Станет
const viteBuild = spawn('vite', ['build', '--config', 'config/vite.config.ts', ...]);
```

**Imports в vite-plugin-sw-version.ts:**
```typescript
// Если плагин импортирует конфиг
import config from './vite.config.ts'; // ❌ Сломается

// Нужно обновить
import config from '../vite.config.ts'; // ✅ Относительный путь
```

**Риск:** 🟢 Низкий (официальная поддержка)

---

### 2. ESLint (eslint.config.js)

**Поддержка кастомного пути:** ✅ Да (ESLint 9+ Flat Config)

**CLI флаг:** `--config <path>` или env `ESLINT_USE_FLAT_CONFIG`

**Изменения:**

```json
// package.json
{
  "scripts": {
    "lint": "eslint . --config config/eslint.config.js",
    "lint:fix": "eslint . --config config/eslint.config.js --fix"
  }
}
```

**Альтернатива (env):**
```json
{
  "scripts": {
    "lint": "ESLINT_CONFIG_FILE=config/eslint.config.js eslint .",
    "lint:fix": "ESLINT_CONFIG_FILE=config/eslint.config.js eslint . --fix"
  }
}
```

**Риск:** 🟢 Низкий

---

### 3. Tailwind CSS (tailwind.config.js)

**Поддержка кастомного пути:** ✅ Да

**CLI флаг:** `-c <path>` или `--config <path>`

**Изменения:**

```json
// package.json
{
  "scripts": {
    "build:tailwind": "tailwindcss -c config/tailwind.config.js -i ./frontend/web/static/css/tailwind.input.css -o ./frontend/web/static/css/tailwind-daisyui.css",
    "watch:css": "tailwindcss -c config/tailwind.config.js -i ./frontend/web/static/css/tailwind.input.css -o ./frontend/web/static/css/tailwind-daisyui.css --watch"
  }
}
```

**Риск:** 🟢 Низкий

---

### 4. PostCSS (postcss.config.js)

**Поддержка кастомного пути:** ✅ Да

**CLI флаг:** `--config <path>`

**Изменения:**

```json
// package.json
{
  "scripts": {
    "minify:tailwind": "postcss --config config/postcss.config.js frontend/web/static/css/tailwind-daisyui.css -u cssnano -o frontend/web/static/css/tailwind-daisyui.min.css",
    "minify:custom-css": "postcss --config config/postcss.config.js frontend/web/static/css/custom.css -u cssnano -o frontend/web/static/css/custom.min.css"
    // ... все остальные minify:* скрипты
  }
}
```

**Риск:** 🟢 Низкий

---

### 5. Playwright (playwright.config.ts)

**Поддержка кастомного пути:** ✅ Да

**CLI флаг:** `-c <path>` или `--config <path>`

**Изменения:**

```json
// package.json
{
  "scripts": {
    "test:e2e": "playwright test -c config/playwright.config.ts",
    "test:e2e:headed": "playwright test -c config/playwright.config.ts --headed",
    "test:e2e:ui": "playwright test -c config/playwright.config.ts --ui"
  }
}
```

**Риск:** 🟢 Низкий

---

### 6. Vitest (vitest.config.ts)

**Поддержка кастомного пути:** ✅ Да

**CLI флаг:** `--config <path>`

**Изменения:**

```json
// package.json
{
  "scripts": {
    "test": "vitest --config config/vitest.config.ts",
    "test:ui": "vitest --config config/vitest.config.ts --ui",
    "test:coverage": "vitest run --config config/vitest.config.ts --coverage",
    "test:run": "vitest run --config config/vitest.config.ts",
    "test:watch": "vitest --config config/vitest.config.ts --watch"
  }
}
```

**Риск:** 🟢 Низкий

---

### 7. TypeScript (tsconfig.json)

**Поддержка кастомного пути:** ✅ Да

**CLI флаг:** `-p <path>` или `--project <path>`

**Изменения:**

```json
// package.json
{
  "scripts": {
    "type-check": "tsc --noEmit -p config/tsconfig.json",
    "type-check:watch": "tsc --noEmit -p config/tsconfig.json --watch"
  }
}
```

**ВАЖНО:** VS Code и IDE интеграции

```json
// .vscode/settings.json
{
  "typescript.tsdk": "node_modules/typescript/lib",
  "typescript.tsconfig": "config/tsconfig.json"
}
```

**Риск:** 🟡 Средний (IDE интеграции могут не работать)

---

### 8. Pytest (pytest.ini)

**Поддержка кастомного пути:** ✅ Да

**CLI флаг:** `-c <path>` или `--config <path>`

**Изменения:**

```bash
# Backend тесты
cd backend/
pytest -c ../config/pytest.ini

# Или в root
pytest -c config/pytest.ini backend/tests/
```

**Альтернатива:** Использовать `pyproject.toml`

```toml
# config/pyproject.toml или root pyproject.toml
[tool.pytest.ini_options]
testpaths = ["backend/tests"]
python_files = "test_*.py"
# ... остальные настройки из pytest.ini
```

**Риск:** 🟢 Низкий

---

### 9. vite-plugin-sw-version.ts

**Это НЕ конфиг, а исходный код плагина.**

**Варианты:**

1. **Переместить в `scripts/build/plugins/`** (рекомендуется)
2. **Оставить в root** (если используется в нескольких местах)
3. **Переместить в `config/` вместе с vite.config.ts**

**Изменения при переносе в scripts/build/plugins/:**

```typescript
// vite.config.ts (в config/)
import swCacheVersionPlugin from '../scripts/build/plugins/vite-plugin-sw-version';
```

**Риск:** 🟢 Низкий (просто изменить import paths)

---

## 📁 Итоговая структура config/

```
config/
├── vite.config.ts              # Основной Vite конфиг
├── vite.config.single.ts       # Альтернативный Vite конфиг
├── eslint.config.js            # ESLint flat config
├── tailwind.config.js          # Tailwind CSS
├── postcss.config.js           # PostCSS
├── playwright.config.ts        # E2E тесты
├── vitest.config.ts            # Unit тесты
├── tsconfig.json               # TypeScript
├── pytest.ini                  # Python тесты
└── README.md                   # Документация конфигов
```

**Плагины и скрипты:**
```
scripts/
├── build/
│   ├── build-all.js           # Переместить из root
│   └── plugins/
│       └── vite-plugin-sw-version.ts  # Переместить из root
└── ...
```

---

## 🔄 Пошаговый план миграции

### Phase 1: Подготовка (5 мин)

```bash
# 1.1 Создать config/ директорию
mkdir -p config

# 1.2 Создать README
cat > config/README.md << 'EOF'
# Configuration Files

This directory contains all configuration files for build tools and development.

## Files

- `vite.config.ts` - Vite bundler configuration
- `eslint.config.js` - ESLint linting rules
- `tailwind.config.js` - Tailwind CSS utility classes
- `postcss.config.js` - PostCSS CSS processing
- `playwright.config.ts` - E2E testing configuration
- `vitest.config.ts` - Unit testing configuration
- `tsconfig.json` - TypeScript compiler options
- `pytest.ini` - Python testing configuration

## Usage

All npm scripts in package.json reference these configs with `--config` flags.
EOF
```

---

### Phase 2: Переместить конфиги (10 мин)

```bash
# 2.1 Переместить конфиги в config/
git mv vite.config.ts config/
git mv vite.config.single.ts config/
git mv eslint.config.js config/
git mv tailwind.config.js config/
git mv postcss.config.js config/
git mv playwright.config.ts config/
git mv vitest.config.ts config/
git mv tsconfig.json config/
git mv pytest.ini config/

# 2.2 Переместить плагин в scripts/
mkdir -p scripts/build/plugins
git mv vite-plugin-sw-version.ts scripts/build/plugins/

# 2.3 Переместить build-all.js (уже перемещали ранее, пропускаем)
# git mv build-all.js scripts/build/
```

---

### Phase 3: Обновить package.json (15 мин)

**ВАЖНО:** Это критический файл, тестируйте каждый скрипт!

```json
{
  "scripts": {
    "type-check": "tsc --noEmit -p config/tsconfig.json",
    "type-check:watch": "tsc --noEmit -p config/tsconfig.json --watch",

    "lint": "eslint . --config config/eslint.config.js",
    "lint:fix": "eslint . --config config/eslint.config.js --fix",

    "build:tailwind": "tailwindcss -c config/tailwind.config.js -i ./frontend/web/static/css/tailwind.input.css -o ./frontend/web/static/css/tailwind-daisyui.css",
    "watch:css": "tailwindcss -c config/tailwind.config.js -i ./frontend/web/static/css/tailwind.input.css -o ./frontend/web/static/css/tailwind-daisyui.css --watch",

    "minify:tailwind": "postcss --config config/postcss.config.js frontend/web/static/css/tailwind-daisyui.css -u cssnano -o frontend/web/static/css/tailwind-daisyui.min.css",
    "minify:custom-css": "postcss --config config/postcss.config.js frontend/web/static/css/custom.css -u cssnano -o frontend/web/static/css/custom.min.css",
    "minify:overrides": "postcss --config config/postcss.config.js frontend/web/static/css/daisyui-overrides.css -u cssnano -o frontend/web/static/css/daisyui-overrides.min.css",
    "minify:choices": "postcss --config config/postcss.config.js frontend/web/static/css/choices-tailwind.css -u cssnano -o frontend/web/static/css/choices-tailwind.min.css",
    "minify:vendor-css": "postcss --config config/postcss.config.js frontend/web/static/css/vendor/choices.css -u cssnano -o frontend/web/static/css/vendor/choices.min.css",
    "minify:lists": "postcss --config config/postcss.config.js frontend/web/static/css/lists.css -u cssnano -o frontend/web/static/css/lists.min.css",

    "dev": "vite --config config/vite.config.ts",

    "test": "vitest --config config/vitest.config.ts",
    "test:ui": "vitest --config config/vitest.config.ts --ui",
    "test:coverage": "vitest run --config config/vitest.config.ts --coverage",
    "test:run": "vitest run --config config/vitest.config.ts",
    "test:watch": "vitest --config config/vitest.config.ts --watch",

    "test:e2e": "playwright test -c config/playwright.config.ts",
    "test:e2e:headed": "playwright test -c config/playwright.config.ts --headed",
    "test:e2e:ui": "playwright test -c config/playwright.config.ts --ui"
  }
}
```

---

### Phase 4: Обновить build-all.js (10 мин)

```javascript
// scripts/build/build-all.js

// БЫЛО
import swCacheVersionPlugin from './vite-plugin-sw-version';

// СТАНЕТ
import swCacheVersionPlugin from './plugins/vite-plugin-sw-version.js';

// ...

// БЫЛО
const viteArgs = ['build', '--mode', 'production'];

// СТАНЕТ
const viteArgs = ['build', '--config', 'config/vite.config.ts', '--mode', 'production'];
```

---

### Phase 5: Обновить vite.config.ts (5 мин)

```typescript
// config/vite.config.ts

// БЫЛО
import swCacheVersionPlugin from './vite-plugin-sw-version';

// СТАНЕТ
import swCacheVersionPlugin from '../scripts/build/plugins/vite-plugin-sw-version';
```

---

### Phase 6: Обновить IDE настройки (5 мин)

```json
// .vscode/settings.json (создать если не существует)
{
  "typescript.tsdk": "node_modules/typescript/lib",
  "typescript.tsconfig": "config/tsconfig.json",
  "eslint.options": {
    "overrideConfigFile": "config/eslint.config.js"
  }
}
```

---

### Phase 7: Обновить backend pytest вызовы (5 мин)

```bash
# Если есть скрипты запуска pytest
# backend/run_tests.sh или подобное

# БЫЛО
pytest

# СТАНЕТ
pytest -c ../config/pytest.ini
```

**Альтернатива:** Создать `pyproject.toml` в root

```toml
# pyproject.toml
[tool.pytest.ini_options]
testpaths = ["backend/tests"]
python_files = "test_*.py"
python_classes = "Test*"
python_functions = "test_*"
addopts = "-v --tb=short --strict-markers"
markers = [
    "slow: marks tests as slow",
    "integration: marks tests as integration tests",
]
```

---

### Phase 8: Тестирование (30 мин)

**КРИТИЧНО:** Тестировать каждый инструмент после миграции!

```bash
# 8.1 TypeScript
npm run type-check
# Ожидаемый результат: 0 ошибок

# 8.2 ESLint
npm run lint
# Ожидаемый результат: конфиг найден, правила применены

# 8.3 Tailwind
npm run build:tailwind
# Ожидаемый результат: frontend/web/static/css/tailwind-daisyui.css создан

# 8.4 PostCSS
npm run minify:tailwind
# Ожидаемый результат: .min.css файлы созданы

# 8.5 Vite (bundle)
npm run bundle
# Ожидаемый результат: frontend/web/static/js/dist/ заполнен

# 8.6 Vite (dev)
npm run dev
# Ожидаемый результат: dev server запущен на :5173

# 8.7 Vitest
npm run test:run
# Ожидаемый результат: тесты запущены

# 8.8 Playwright
npm run test:e2e
# Ожидаемый результат: E2E тесты запущены

# 8.9 Pytest
cd backend && pytest -c ../config/pytest.ini
# Ожидаемый результат: Python тесты запущены
```

---

### Phase 9: Commit (5 мин)

```bash
git add .
git commit -m "refactor: move all configs to config/ directory

Перемещены конфигурационные файлы:
- vite.config.ts, vite.config.single.ts
- eslint.config.js, tailwind.config.js, postcss.config.js
- playwright.config.ts, vitest.config.ts
- tsconfig.json, pytest.ini

Обновлены:
- package.json scripts (добавлены --config флаги)
- build-all.js (путь к vite конфигу и плагину)
- vite.config.ts (import пути для плагина)
- .vscode/settings.json (IDE интеграции)

Результат: 10 конфигов переместены в config/, root очищен.
"
```

---

## 📊 Результаты миграции

### До vs После

| Метрика | До | После | Улучшение |
|---------|----|----|-----------|
| Файлов в root | 26 | **16** | **-38%** |
| Конфигов в root | 10 | **0** | **-100%** |
| Размер root (конфиги) | ~30KB | **0** | **-100%** |

### Root после миграции (16 файлов)

```
.
├── 📁 backend/, bot/, frontend/, docs/, scripts/, tests/
├── 📁 config/              ← ВСЕ конфиги здесь
├── 📁 nginx/, postgres/, redis/, sql/, types/
├── 📁 .github/, .claude/, .husky/
│
├── 📄 deploy.sh            ✅ Корневой скрипт
├── 📄 install.sh           ✅ Корневой скрипт
├── 📄 setup.sh             ✅ Корневой скрипт
│
├── 📄 IMAGE_VERSIONS.json  ✅ Критичен для деплоя
├── 📄 sw.js                ✅ Service Worker исходник
├── 📄 manifest.json        ✅ PWA манифест
│
├── 📄 docker-compose.yml   ✅ Docker entry
├── 📄 package.json         ✅ npm entry
├── 📄 package-lock.json    ✅
├── 📄 .gitignore           ✅
├── 📄 .dockerignore        ✅
├── 📄 .env.example         ✅
├── 📄 .env.test.example    ✅
├── 📄 VERSION              ✅
├── 📄 README.md            ✅
└── 📄 START.md, CLAUDE.md  ✅
```

**Итого:** 16 файлов (было 26, **-38%**)

---

## ⚠️ Риски и Mitigation

### 🔴 Высокий риск

**1. Ломаются npm scripts**
- **Симптом:** `Error: Cannot find config file`
- **Mitigation:** Пошаговое тестирование каждого скрипта (Phase 8)
- **Откат:** `git restore package.json config/ vite-plugin-sw-version.ts`

**2. IDE интеграции не работают**
- **Симптом:** VS Code не видит TypeScript/ESLint ошибки
- **Mitigation:** Обновить `.vscode/settings.json` (Phase 6)
- **Откат:** `git restore config/tsconfig.json config/eslint.config.js .vscode/`

### 🟡 Средний риск

**3. build-all.js не находит vite.config.ts**
- **Симптом:** `Error: Config file not found`
- **Mitigation:** Обновить import paths и CLI args (Phase 4)
- **Откат:** `git restore scripts/build/build-all.js config/vite.config.ts`

**4. vite-plugin-sw-version.ts import ломается**
- **Симптом:** `Cannot find module '../vite-plugin-sw-version'`
- **Mitigation:** Обновить import path (Phase 5)
- **Откат:** `git restore config/vite.config.ts scripts/build/plugins/`

### 🟢 Низкий риск

**5. Pytest не находит конфиг**
- **Симптом:** `pytest: error: no such option: -c`
- **Mitigation:** Использовать `pyproject.toml` (Phase 7)
- **Откат:** `git mv config/pytest.ini .`

---

## 🎯 Рекомендации

### ✅ ВЫПОЛНИТЬ миграцию конфигов

**Причины:**
1. **Упрощение root** - 16 файлов вместо 26 (-38%)
2. **Централизация** - все конфиги в одном месте
3. **Стандартизация** - соответствует best practices (Next.js, Nuxt, Remix)
4. **Низкий риск** - все инструменты поддерживают `--config` флаги

**Время выполнения:** ~1.5 часа (с тестированием)

### ⚠️ Критические моменты

1. **Тестировать ВСЕ npm scripts** (Phase 8)
2. **Обновить IDE settings** (Phase 6)
3. **Проверить build в CI/CD** (может требовать обновления GitHub Actions)
4. **Документировать** изменения в README.md

### 📝 Checklist перед выполнением

- [ ] Создать ветку `refactor/move-configs-to-config`
- [ ] Сделать backup конфигов: `tar -czf configs-backup.tar.gz *.config.* *.json *.ini`
- [ ] Убедиться что все коммиты сохранены
- [ ] Проверить что CI/CD pipeline работает (для отката)
- [ ] Уведомить команду о предстоящих изменениях

---

## 🔄 План отката (Rollback)

Если после миграции что-то сломалось:

```bash
# Быстрый откат последнего коммита
git reset --hard HEAD~1

# Или откат всей ветки
git checkout test
git branch -D refactor/move-configs-to-config

# Восстановить из backup
tar -xzf configs-backup.tar.gz
```

**Критерий для отката:**
- ❌ npm scripts не работают (> 2 скриптов сломаны)
- ❌ Build процесс падает с ошибкой
- ❌ CI/CD pipeline не проходит
- ❌ IDE интеграции полностью не работают

---

## 📚 Связанные документы

- `docs/architecture/repository-restructuring-plan.md` - Общий план реструктуризации
- `docs/architecture/build-system.md` - Build pipeline (обновить после миграции)
- `package.json` - npm scripts (обновить в Phase 3)
- `.vscode/settings.json` - IDE настройки (создать/обновить в Phase 6)

---

**Автор:** Claude Sonnet 4.5
**Дата:** 2026-02-01
**Версия документа:** 1.0.0
