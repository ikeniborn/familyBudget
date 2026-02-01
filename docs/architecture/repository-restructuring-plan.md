# План реструктуризации репозитория Family Budget

**Дата анализа:** 2026-02-01
**Версия проекта:** v11.0.9
**Цель:** Упорядочить структуру репозитория, очистить root от избыточности, организовать файлы по функциональным каталогам

---

## 📊 Текущее состояние репозитория

### Статистика

| Категория | Текущее значение | Проблема |
|-----------|------------------|----------|
| Файлов в root | **31 файл** | ❌ Слишком много (норма: 8-12) |
| Строк кода в root скриптах | **9053 строк** | ❌ Логика должна быть в scripts/ |
| Конфигурационных файлов | **13 файлов** | ❌ Должны быть в config/ |
| Дублирование Service Worker | **3 копии** | ❌ sw.js в 3 местах |
| Build артефакты в git | **dist/, .vite-build/** | ❌ Должны быть в .gitignore |
| Размер репозитория | **39MB** | ⚠️ 30MB - frontend |

### Структура root (текущая)

```
.
├── 📁 backend/             (4.1MB)  - FastAPI app
├── 📁 bot/                 (376KB)  - Telegram bot
├── 📁 frontend/            (30MB)   - PWA (web + webapp)
├── 📁 docs/                (3.0MB)  - Документация
├── 📁 scripts/             (632KB)  - Вспомогательные скрипты
├── 📁 tests/               (880KB)  - E2E тесты
├── 📁 nginx/               - Конфигурация веб-сервера
├── 📁 postgres/            - Конфигурация БД
├── 📁 redis/               - Конфигурация кэша
├── 📁 sql/                 - SQL файлы
├── 📁 types/               - TypeScript types
├── 📁 archive/             - Архив (только README)
├── 📁 dist/                ❌ Build артефакты (bundle stats)
├── 📁 .vite-build/         ❌ Build артефакты (SW)
├── 📁 .claude/             - Claude Code skills
├── 📁 .github/             - GitHub Actions workflows
├── 📁 .husky/              - Git hooks
│
├── 📄 deploy.sh            ❌ (66KB) Должен быть в scripts/
├── 📄 install.sh           ❌ (65KB) Должен быть в scripts/
├── 📄 setup.sh             ❌ (63KB) Должен быть в scripts/
├── 📄 logs.sh              ❌ (63KB) Должен быть в scripts/
├── 📄 build-all.js         ❌ (12KB) Должен быть в scripts/build/
│
├── 📄 sw.js                ❌ (37KB) Дубликат (frontend/web/static/)
├── 📄 sw.min.js            ❌ (21KB) Дубликат
├── 📄 sw.min.js.map        ❌ (46KB) Дубликат
│
├── 📄 vite.config.ts       ⚠️ Основной конфиг
├── 📄 vite.config.single.ts ⚠️ Дубликат конфига
├── 📄 vite-plugin-sw-version.ts ⚠️ Плагин
├── 📄 eslint.config.js     ⚠️ Должен быть в config/
├── 📄 tailwind.config.js   ⚠️ Должен быть в config/
├── 📄 postcss.config.js    ⚠️ Должен быть в config/
├── 📄 playwright.config.ts ⚠️ Должен быть в config/
├── 📄 vitest.config.ts     ⚠️ Должен быть в config/
├── 📄 tsconfig.json        ⚠️ Должен быть в config/
├── 📄 pytest.ini           ⚠️ Должен быть в config/
│
├── 📄 docker-compose.yml   ✅ OK (Docker entry)
├── 📄 .dockerignore        ✅ OK
├── 📄 package.json         ✅ OK (npm entry)
├── 📄 package-lock.json    ✅ OK
├── 📄 .gitignore           ✅ OK
├── 📄 .env.example         ✅ OK
├── 📄 .env.test.example    ✅ OK
├── 📄 manifest.json        ⚠️ PWA manifest (должен быть в frontend)
├── 📄 IMAGE_VERSIONS.json  ⚠️ CI артефакт (должен быть в .github)
├── 📄 VERSION              ✅ OK (версия проекта)
├── 📄 README.md            ✅ OK
├── 📄 START.md             ✅ OK (руководство администратора)
└── 📄 CLAUDE.md            ✅ OK (инструкции для AI)
```

---

## 🎯 Проблемы и их приоритет

### 🔴 Критические проблемы

1. **Build артефакты в git**
   - `dist/` (324KB) - bundle-stats HTML файлы
   - `.vite-build/` (76KB) - промежуточная сборка SW
   - **Решение:** Добавить в .gitignore, удалить из git

2. **Дублирование Service Worker**
   - `sw.js` (37KB) в root
   - `sw.min.js` (21KB) в root
   - `sw.min.js.map` (46KB) в root
   - `sw.min.js` + `sw.min.js.map` в `frontend/web/static/`
   - **Решение:** Удалить из root, оставить только в frontend

3. **Большие скрипты в root**
   - `deploy.sh` (66KB, 1915 строк)
   - `install.sh` (65KB, 1912 строк)
   - `setup.sh` (63KB, 1848 строк)
   - `logs.sh` (63KB, 1829 строк)
   - `build-all.js` (12KB, 549 строк)
   - **Решение:** Переместить в `scripts/deployment/`

### 🟡 Средний приоритет

4. **Разбросанные конфигурационные файлы**
   - 13 конфигов в root (vite, eslint, tailwind, playwright, etc.)
   - **Решение:** Создать `config/` директорию, переместить конфиги
   - **Проблема:** Многие инструменты ожидают конфиги в root
   - **Компромисс:** Symlinks из root в config/

5. **Дублирование Vite конфигов**
   - `vite.config.ts` (4.3KB)
   - `vite.config.single.ts` (6.5KB)
   - **Решение:** Унифицировать в один конфиг с параметрами

6. **PWA манифест не на месте**
   - `manifest.json` в root (должен быть в frontend)
   - **Решение:** Переместить в `frontend/web/static/`

7. **CI артефакт в root**
   - `IMAGE_VERSIONS.json` (автогенерируемый CI)
   - **Решение:** Переместить в `.github/`

### 🟢 Низкий приоритет

8. **Неиспользуемый архив**
   - `archive/` содержит только README-ARCHIVE.md
   - **Решение:** Удалить или переместить в docs/archive/

9. **Дублирование frontend структуры**
   - `frontend/web/` - основной PWA
   - `frontend/webapp/` - Telegram WebApp
   - Оба имеют `static/` директории
   - **Решение:** Уточнить назначение, возможно объединить

---

## 🏗️ Предлагаемая структура (target state)

### Root после реструктуризации

```
.
├── 📁 backend/              FastAPI application
├── 📁 bot/                  Telegram bot
├── 📁 frontend/             PWA + WebApp
├── 📁 docs/                 Documentation
├── 📁 scripts/              All scripts (moved from root)
│   ├── deployment/         deploy.sh, install.sh, setup.sh
│   ├── build/              build-all.js
│   └── monitoring/         logs.sh
├── 📁 tests/                E2E tests
├── 📁 config/               All configs (new)
│   ├── vite.config.ts
│   ├── eslint.config.js
│   ├── tailwind.config.js
│   ├── playwright.config.ts
│   ├── vitest.config.ts
│   ├── tsconfig.json
│   ├── postcss.config.js
│   └── pytest.ini
├── 📁 infra/                Infrastructure (renamed from nginx/postgres/redis)
│   ├── nginx/
│   ├── postgres/
│   ├── redis/
│   └── sql/
├── 📁 types/                TypeScript definitions
├── 📁 .github/              GitHub workflows + CI artifacts
│   ├── workflows/
│   └── IMAGE_VERSIONS.json
├── 📁 .claude/              Claude Code skills
├── 📁 .husky/               Git hooks
│
├── 📄 docker-compose.yml    Docker entry point
├── 📄 .dockerignore
├── 📄 package.json          npm entry point
├── 📄 package-lock.json
├── 📄 .gitignore
├── 📄 .env.example
├── 📄 .env.test.example
├── 📄 VERSION               Project version
├── 📄 README.md             Main documentation
├── 📄 START.md              Admin guide
└── 📄 CLAUDE.md             AI instructions
```

**Результат:** 12 файлов в root (было 31, **-61%**)

### Symlinks для обратной совместимости

Некоторые инструменты ожидают конфиги в root. Создадим symlinks:

```bash
# Root -> config/
vite.config.ts       -> config/vite.config.ts
eslint.config.js     -> config/eslint.config.js
tailwind.config.js   -> config/tailwind.config.js
playwright.config.ts -> config/playwright.config.ts
vitest.config.ts     -> config/vitest.config.ts
tsconfig.json        -> config/tsconfig.json
postcss.config.js    -> config/postcss.config.js
pytest.ini           -> config/pytest.ini
```

---

## 📋 План миграции (пошаговый)

### Phase 1: Очистка build артефактов (безопасно)

**Цель:** Удалить временные файлы сборки

```bash
# 1.1 Добавить в .gitignore
echo "dist/" >> .gitignore
echo ".vite-build/" >> .gitignore

# 1.2 Удалить из git
git rm -r dist/
git rm -r .vite-build/

# 1.3 Локальная очистка (опционально)
rm -rf dist/ .vite-build/
```

**Риски:** ❌ Нет
**Откат:** Не требуется (артефакты регенерируются при сборке)

---

### Phase 2: Удаление дубликатов Service Worker (средний риск)

**Цель:** Оставить SW только в `frontend/web/static/`

```bash
# 2.1 Проверить что используется в production
grep -r "sw.js\|sw.min.js" frontend/ backend/ nginx/

# 2.2 Удалить из root
git rm sw.js sw.min.js sw.min.js.map

# 2.3 Обновить build-all.js (если ссылается на root)
# Проверить что Vite копирует SW в frontend/web/static/
```

**Риски:** ⚠️ Средний (может сломать PWA если скрипты ссылаются на root)
**Тестирование:**
- Запустить сборку: `npm run bundle`
- Проверить наличие `frontend/web/static/sw.min.js`
- Проверить работу Service Worker в браузере

**Откат:**
```bash
git checkout HEAD -- sw.js sw.min.js sw.min.js.map
```

---

### Phase 3: Перемещение больших скриптов (низкий риск)

**Цель:** Переместить deploy.sh, install.sh, setup.sh, logs.sh в scripts/

```bash
# 3.1 Создать структуру
mkdir -p scripts/deployment
mkdir -p scripts/build
mkdir -p scripts/monitoring

# 3.2 Переместить файлы
git mv deploy.sh scripts/deployment/
git mv install.sh scripts/deployment/
git mv setup.sh scripts/deployment/
git mv logs.sh scripts/monitoring/
git mv build-all.js scripts/build/

# 3.3 Создать symlinks для обратной совместимости (опционально)
ln -s scripts/deployment/deploy.sh deploy.sh
ln -s scripts/deployment/install.sh install.sh
ln -s scripts/deployment/setup.sh setup.sh
ln -s scripts/monitoring/logs.sh logs.sh
ln -s scripts/build/build-all.js build-all.js

# 3.4 Обновить ссылки в документации
grep -r "deploy.sh\|install.sh\|setup.sh\|logs.sh" docs/ README.md START.md
```

**Риски:** ⚠️ Низкий (symlinks обеспечивают обратную совместимость)
**Тестирование:**
- Запустить `./deploy.sh --help` (через symlink)
- Проверить CI/CD скрипты в `.github/workflows/`

**Откат:**
```bash
git mv scripts/deployment/*.sh .
git mv scripts/build/build-all.js .
rm -f deploy.sh install.sh setup.sh logs.sh build-all.js
```

---

### Phase 4: Создание config/ директории (высокий риск)

**Цель:** Централизовать конфигурационные файлы

**⚠️ ВНИМАНИЕ:** Многие инструменты (Vite, ESLint, Playwright) ожидают конфиги в root. Перемещение может сломать сборку.

**Рекомендуемый подход:**

1. **Создать config/ с копиями** (не перемещать)
2. **Добавить symlinks из root**
3. **Обновить package.json scripts** для указания путей
4. **Постепенная миграция** (по одному инструменту)

```bash
# 4.1 Создать config/ директорию
mkdir -p config

# 4.2 Скопировать конфиги (НЕ перемещать)
cp vite.config.ts config/
cp eslint.config.js config/
cp tailwind.config.js config/
cp playwright.config.ts config/
cp vitest.config.ts config/
cp tsconfig.json config/
cp postcss.config.js config/
cp pytest.ini config/

# 4.3 Тестировать каждый инструмент отдельно
npm run build        # Vite
npm run lint         # ESLint
npm run type-check   # TypeScript
npm run test         # Playwright/Vitest
pytest               # Python tests

# 4.4 Если все работает - удалить оригиналы и создать symlinks
git rm vite.config.ts
ln -s config/vite.config.ts vite.config.ts
git add vite.config.ts  # Добавить symlink в git
```

**Риски:** 🔴 Высокий (может сломать все инструменты сборки)
**Рекомендация:** **НЕ выполнять** без тщательного тестирования

**Альтернатива:** Оставить конфиги в root, но добавить комментарии:

```javascript
// vite.config.ts
// TODO: Migrate to config/vite.config.ts (see docs/architecture/repository-restructuring-plan.md)
```

---

### Phase 5: Перемещение PWA манифеста (низкий риск)

**Цель:** Переместить manifest.json в frontend

```bash
# 5.1 Переместить файл
git mv manifest.json frontend/web/static/

# 5.2 Обновить ссылки в HTML
grep -r "manifest.json" frontend/ backend/

# 5.3 Обновить nginx конфигурацию (если манифест отдается напрямую)
grep -r "manifest.json" nginx/
```

**Риски:** ⚠️ Низкий (нужно обновить пути)
**Тестирование:**
- Проверить манифест в DevTools (Application -> Manifest)
- Проверить установку PWA на мобильном

**Откат:**
```bash
git mv frontend/web/static/manifest.json .
```

---

### Phase 6: Перемещение IMAGE_VERSIONS.json (низкий риск)

**Цель:** Переместить CI артефакт в .github/

```bash
# 6.1 Переместить файл
git mv IMAGE_VERSIONS.json .github/

# 6.2 Обновить CI workflow
sed -i 's|IMAGE_VERSIONS.json|.github/IMAGE_VERSIONS.json|g' .github/workflows/*.yml

# 6.3 Обновить скрипты
grep -r "IMAGE_VERSIONS.json" scripts/
```

**Риски:** ⚠️ Низкий (только CI)
**Тестирование:**
- Запустить локально: `scripts/ci/update_image_version.sh`
- Проверить GitHub Actions workflow

**Откат:**
```bash
git mv .github/IMAGE_VERSIONS.json .
```

---

### Phase 7: Удаление archive/ (низкий риск)

**Цель:** Очистить неиспользуемый каталог

```bash
# 7.1 Проверить содержимое
cat archive/README-ARCHIVE.md

# 7.2 Если нужно - переместить в docs
git mv archive/README-ARCHIVE.md docs/archive/

# 7.3 Удалить пустую директорию
git rm -r archive/
```

**Риски:** ❌ Нет
**Откат:**
```bash
git checkout HEAD -- archive/
```

---

### Phase 8: Объединение infra компонентов (опционально)

**Цель:** Сгруппировать nginx/, postgres/, redis/, sql/ в infra/

```bash
# 8.1 Создать infra/ директорию
mkdir -p infra

# 8.2 Переместить компоненты
git mv nginx/ infra/
git mv postgres/ infra/
git mv redis/ infra/
git mv sql/ infra/

# 8.3 Обновить docker-compose.yml
sed -i 's|./nginx/|./infra/nginx/|g' docker-compose.yml
sed -i 's|./postgres/|./infra/postgres/|g' docker-compose.yml
sed -i 's|./redis/|./infra/redis/|g' docker-compose.yml
```

**Риски:** ⚠️ Средний (нужно обновить все пути в Docker)
**Рекомендация:** **Опционально** (не критично для упорядочивания)

**Откат:**
```bash
git mv infra/* .
rmdir infra/
```

---

## 🎯 Рекомендуемый порядок выполнения

### Iteration 1: Безопасная очистка (0 рисков)

```bash
# 1. Build артефакты
git rm -r dist/ .vite-build/
echo -e "\n# Build artifacts\ndist/\n.vite-build/" >> .gitignore

# 2. Archive
git mv archive/README-ARCHIVE.md docs/archive/ || git rm -r archive/

# Commit
git add .gitignore
git commit -m "chore: remove build artifacts and unused archive directory"
```

**Время:** 5 минут
**Риски:** Нет
**Тестирование:** Не требуется

---

### Iteration 2: Перемещение скриптов (низкий риск)

```bash
# 1. Создать структуру
mkdir -p scripts/{deployment,build,monitoring}

# 2. Переместить файлы
git mv deploy.sh scripts/deployment/
git mv install.sh scripts/deployment/
git mv setup.sh scripts/deployment/
git mv logs.sh scripts/monitoring/
git mv build-all.js scripts/build/

# 3. Создать symlinks
ln -s scripts/deployment/deploy.sh deploy.sh
ln -s scripts/deployment/install.sh install.sh
ln -s scripts/deployment/setup.sh setup.sh
ln -s scripts/monitoring/logs.sh logs.sh
ln -s scripts/build/build-all.js build-all.js

# 4. Добавить symlinks в git
git add deploy.sh install.sh setup.sh logs.sh build-all.js

# Commit
git commit -m "refactor: move large scripts to scripts/ directory with symlinks"
```

**Время:** 10 минут
**Риски:** Низкий (symlinks обеспечивают совместимость)
**Тестирование:**
- `./deploy.sh --help`
- `npm run bundle` (проверить build-all.js)

---

### Iteration 3: Service Worker cleanup (средний риск)

```bash
# 1. Удалить дубликаты из root
git rm sw.js sw.min.js sw.min.js.map

# Commit
git commit -m "refactor: remove duplicate Service Worker files from root"
```

**Время:** 5 минут
**Риски:** Средний
**Тестирование:**
- `npm run bundle`
- Проверить `frontend/web/static/sw.min.js` существует
- Проверить PWA в браузере (DevTools -> Application -> Service Workers)

---

### Iteration 4: CI artifacts + manifest (низкий риск)

```bash
# 1. Переместить IMAGE_VERSIONS.json
git mv IMAGE_VERSIONS.json .github/

# 2. Обновить CI workflow
sed -i 's|IMAGE_VERSIONS.json|.github/IMAGE_VERSIONS.json|g' .github/workflows/*.yml

# 3. Переместить manifest.json
git mv manifest.json frontend/web/static/

# 4. Обновить ссылки (TODO: проверить где используется)
grep -r "manifest.json" frontend/ backend/ nginx/

# Commit
git commit -m "refactor: move CI artifacts to .github/, PWA manifest to frontend"
```

**Время:** 10 минут
**Риски:** Низкий
**Тестирование:**
- Проверить GitHub Actions workflow
- Проверить PWA манифест в браузере

---

### Iteration 5: Config directory (ОТЛОЖИТЬ)

**⚠️ НЕ рекомендуется выполнять без детального анализа зависимостей**

**Альтернатива:** Добавить TODO комментарии в существующие конфиги:

```javascript
// vite.config.ts
// TODO: Consider moving to config/vite.config.ts in future refactoring
```

---

## 📊 Ожидаемые результаты

### До vs После

| Метрика | До | После | Улучшение |
|---------|----|----|-----------|
| Файлов в root | 31 | 12 | **-61%** |
| Строк кода в root | 9053 | 0 | **-100%** |
| Дубликатов SW | 3 | 1 | **-67%** |
| Build артефакты в git | ✅ Есть | ❌ Нет | ✅ |
| Размер root (файлы) | ~360KB | ~20KB | **-94%** |

### Структура root после всех итераций

```
.
├── 📁 backend/
├── 📁 bot/
├── 📁 frontend/
├── 📁 docs/
├── 📁 scripts/              ← Все скрипты здесь
├── 📁 tests/
├── 📁 nginx/
├── 📁 postgres/
├── 📁 redis/
├── 📁 sql/
├── 📁 types/
├── 📁 .github/              ← + IMAGE_VERSIONS.json
├── 📁 .claude/
├── 📁 .husky/
│
├── 🔗 deploy.sh             → scripts/deployment/deploy.sh
├── 🔗 install.sh            → scripts/deployment/install.sh
├── 🔗 setup.sh              → scripts/deployment/setup.sh
├── 🔗 logs.sh               → scripts/monitoring/logs.sh
├── 🔗 build-all.js          → scripts/build/build-all.js
│
├── 📄 docker-compose.yml
├── 📄 .dockerignore
├── 📄 package.json
├── 📄 package-lock.json
├── 📄 .gitignore
├── 📄 .env.example
├── 📄 .env.test.example
├── 📄 VERSION
├── 📄 README.md
├── 📄 START.md
├── 📄 CLAUDE.md
│
├── ⚠️ vite.config.ts         (TODO: config/)
├── ⚠️ vite.config.single.ts  (TODO: config/)
├── ⚠️ vite-plugin-sw-version.ts (TODO: config/)
├── ⚠️ eslint.config.js       (TODO: config/)
├── ⚠️ tailwind.config.js     (TODO: config/)
├── ⚠️ postcss.config.js      (TODO: config/)
├── ⚠️ playwright.config.ts   (TODO: config/)
├── ⚠️ vitest.config.ts       (TODO: config/)
├── ⚠️ tsconfig.json          (TODO: config/)
└── ⚠️ pytest.ini             (TODO: config/)
```

**Файлов в root:** 21 (12 необходимых + 5 symlinks + 4 TODO конфига)

---

## ⚠️ Риски и mitigation

### Высокий риск

1. **Перемещение конфигов в config/**
   - **Риск:** Инструменты перестанут находить конфиги
   - **Mitigation:** Использовать symlinks, обновить package.json scripts
   - **Рекомендация:** **ОТЛОЖИТЬ** до детального анализа

2. **Удаление Service Worker из root**
   - **Риск:** PWA перестанет работать offline
   - **Mitigation:** Тщательное тестирование в браузере
   - **Откат:** `git checkout HEAD -- sw.js sw.min.js sw.min.js.map`

### Средний риск

3. **Перемещение скриптов в scripts/**
   - **Риск:** CI/CD скрипты могут ссылаться на старые пути
   - **Mitigation:** Symlinks + проверка GitHub Actions workflows
   - **Тестирование:** Запустить CI локально

4. **Перемещение manifest.json**
   - **Риск:** Браузер не найдет PWA манифест
   - **Mitigation:** Обновить пути в HTML и nginx
   - **Тестирование:** DevTools -> Application -> Manifest

### Низкий риск

5. **Удаление build артефактов**
   - **Риск:** Отсутствует (регенерируются)
   - **Mitigation:** Не требуется

6. **Удаление archive/**
   - **Риск:** Отсутствует
   - **Mitigation:** Сохранить в docs/archive/

---

## 📝 Чеклист выполнения

### Pre-migration

- [ ] Создать ветку `refactor/repository-restructuring`
- [ ] Сделать backup базы данных
- [ ] Убедиться что все изменения закоммичены
- [ ] Проверить что CI/CD pipeline работает

### Iteration 1: Безопасная очистка

- [ ] Удалить `dist/` и `.vite-build/`
- [ ] Добавить в `.gitignore`
- [ ] Удалить или переместить `archive/`
- [ ] Commit: `chore: remove build artifacts and unused archive`
- [ ] Тестирование: `npm run bundle` работает

### Iteration 2: Перемещение скриптов

- [ ] Создать `scripts/{deployment,build,monitoring}/`
- [ ] Переместить `deploy.sh`, `install.sh`, `setup.sh`, `logs.sh`
- [ ] Переместить `build-all.js`
- [ ] Создать symlinks
- [ ] Commit: `refactor: move scripts to organized directories`
- [ ] Тестирование: `./deploy.sh --help`, `npm run bundle`

### Iteration 3: Service Worker

- [ ] Проверить использование SW в коде
- [ ] Удалить `sw.js`, `sw.min.js`, `sw.min.js.map` из root
- [ ] Commit: `refactor: remove duplicate Service Worker files`
- [ ] Тестирование: PWA в браузере, offline режим

### Iteration 4: CI artifacts + manifest

- [ ] Переместить `IMAGE_VERSIONS.json` в `.github/`
- [ ] Обновить GitHub Actions workflows
- [ ] Переместить `manifest.json` в `frontend/web/static/`
- [ ] Обновить ссылки в коде
- [ ] Commit: `refactor: move CI artifacts and PWA manifest`
- [ ] Тестирование: GitHub Actions, PWA манифест

### Post-migration

- [ ] Запустить полный CI/CD pipeline
- [ ] Проверить deployment на тестовом сервере
- [ ] Обновить документацию (`docs/architecture/build-system.md`)
- [ ] Merge в `test` ветку
- [ ] Deploy на production

---

## 🔄 План отката (Rollback)

Если после миграции обнаружены критические проблемы:

```bash
# 1. Откатить последний commit
git reset --hard HEAD~1

# 2. Или откатить всю ветку
git checkout test
git branch -D refactor/repository-restructuring

# 3. Восстановить удаленные файлы
git checkout HEAD -- dist/ .vite-build/ archive/ sw.js sw.min.js sw.min.js.map
```

**Критерий для отката:**
- CI/CD pipeline не работает
- Deployment на тестовый сервер завершается ошибкой
- PWA перестала работать в браузере
- Service Worker не регистрируется

---

## 📚 Связанные документы

- `docs/architecture/build-system.md` - Build pipeline (нужно обновить после миграции)
- `CI-CD-REGISTRY-SUMMARY.md` - Deployment процесс
- `.github/workflows/` - GitHub Actions (проверить пути к скриптам)
- `START.md` - Руководство администратора (обновить пути к скриптам)

---

## 🎓 Выводы и рекомендации

### ✅ Рекомендуется выполнить

1. **Iteration 1-4** (безопасные изменения)
   - Очистка build артефактов
   - Перемещение скриптов с symlinks
   - Удаление дубликатов Service Worker
   - Перемещение CI artifacts и manifest

**Ожидаемый результат:** 21 файл в root (было 31, **-32%**)

### ⚠️ Требует дополнительного анализа

2. **Config directory** (высокий риск)
   - Создать `config/` но НЕ перемещать файлы
   - Добавить TODO комментарии в существующие конфиги
   - Отложить до детального анализа зависимостей

3. **Infra consolidation** (опционально)
   - Объединение nginx/, postgres/, redis/ в infra/
   - Не критично для упорядочивания
   - Можно сделать в будущих итерациях

### 📈 Метрики успеха

- ✅ Файлов в root: **< 25** (target: 12-15)
- ✅ Строк кода в root: **0**
- ✅ Build артефактов в git: **Нет**
- ✅ Дубликатов: **Нет**
- ✅ CI/CD pipeline: **Работает**
- ✅ Deployment: **Работает**
- ✅ PWA: **Работает**

---

**Автор:** Claude Sonnet 4.5
**Дата:** 2026-02-01
**Версия документа:** 1.0.0
