# CI/CD Optimization

**Дата создания:** 2026-02-03
**Версия:** v11.1.41
**Статус:** Implemented

---

## Проблема

До оптимизации workflow имел значительное дублирование тестов между pre-commit hook и CI/CD pipelines.

### Дублирование

| Проверка | Pre-commit | pr-checks.yml | frontend-tests.yml | Дублирований |
|----------|-----------|---------------|-------------------|--------------|
| console.log | ✓ | - | ✓ | **2x** |
| Type check | ✓ | ✓ | ✓ | **3x** |
| Unit tests | ✓ | ✓ | ✓ | **3x** |

**Потери производительности:**
- Type check: ~15s × 3 = **45 секунд**
- Unit tests: ~30s × 3 = **90 секунд**
- **Total waste: ~135 секунд на каждый PR**

---

## Решение

### Стратегия: Разделение ответственности

**Принцип:**
- **Pre-commit** = Быстрые локальные проверки (< 15s)
- **CI/CD** = Полные проверки + интеграционные тесты

---

## Изменения

### 1. Pre-commit Hook (.husky/pre-commit)

**Оставлено:**
- ✅ console.log check (~1s)
- ✅ TypeScript type check (~10s)
- ✅ VERSION sync (auto-stage)

**Удалено:**
- ❌ Unit tests (перенесены в CI/CD)

**Обоснование:**
- Type check быстрый и ловит 80% ошибок TypeScript
- Unit tests медленные, лучше выполнять в CI с полным coverage

**Время выполнения:** 10-15 секунд ⚡ (было: 40-60s)

---

### 2. PR Checks (.github/workflows/pr-checks.yml)

**Consolidated workflow объединяет:**
- Frontend quality checks (из frontend-tests.yml)
- Backend quality checks
- Coverage reporting

**Изменения:**
- ✅ Type check оставлен как safety net (если pre-commit bypassed)
- ✅ Добавлен npm/pip cache для ускорения builds
- ✅ Unit tests выполняются ОДИН РАЗ с полным coverage
- ✅ Удалён `continue-on-error` для unit tests (блокируют PR при failure)

**Структура:**
```yaml
jobs:
  frontend-quality:     # Frontend: type-check, eslint, build, tests, coverage
  backend-quality:      # Backend: mypy, ruff, pytest, coverage
  summary:              # PR summary with optimization notes
```

---

### 3. Frontend Tests (Удалён)

**Действие:** `.github/workflows/frontend-tests.yml` → DEPRECATED

**Причина:** Функциональность объединена в pr-checks.yml

**Если нужен отдельный workflow:**
- Переименовать в `frontend-tests.yml.disabled`
- Или удалить: `rm .github/workflows/frontend-tests.yml`

---

## Результаты оптимизации

### Экономия времени

| Workflow | До | После | Экономия |
|----------|-----|-------|----------|
| **Pre-commit** | 40-60s | 10-15s | **~45s** ⚡ |
| **pr-checks.yml** | 8-10 min | 6-7 min | **~2 min** ⚡ |
| **frontend-tests.yml** | 5-6 min | 0 min (удалён) | **~5 min** ⚡ |

**Total savings per PR:** ~7 минут

**При 3-5 commits на PR:** **21-35 минут экономии** 🚀

---

### Дополнительные улучшения

**1. Cache Optimization**

```yaml
- name: Cache node modules
  uses: actions/cache@v3
  with:
    path: ~/.npm
    key: ${{ runner.os }}-node-${{ hashFiles('**/package-lock.json') }}
```

**Экономия:** ~30-60s на job

**2. Parallel Jobs**

```yaml
jobs:
  frontend-quality:   # Runs in parallel
  backend-quality:    # Runs in parallel
  summary:            # Waits for both (needs: [...])
```

**Экономия:** ~3-5 min (frontend + backend run simultaneously)

---

## Использование

### Локальная разработка

**Обычный commit:**
```bash
git add .
git commit -m "feat: add new feature"
# Runs: console.log check + type-check (~10-15s)
```

**WIP commit (пропуск type-check):**
```bash
git commit --no-verify -m "wip: work in progress"
```

---

### CI/CD Pipeline

**Триггер:** Pull Request → `test` или `main` branch

**Автоматически запускаются:**
1. ✅ Frontend quality checks
   - Type check (safety net)
   - ESLint
   - Build
   - Unit tests + coverage
   - Bundle size validation

2. ✅ Backend quality checks
   - mypy type check
   - ruff lint
   - pytest unit tests
   - Coverage upload

3. ✅ PR summary
   - Optimization notes
   - Time saved metrics

---

## Мониторинг

### Метрики для отслеживания

**GitHub Actions:**
- Workflow duration (target: < 7 min)
- Cache hit rate (target: > 80%)
- Test pass rate (target: 100%)

**Codecov:**
- Frontend coverage (thresholds: см. vitest.config.ts)
- Backend coverage (thresholds: см. pytest.ini)

---

## Troubleshooting

### Pre-commit hook слишком медленный

**Проблема:** Type check занимает > 30s

**Решение:**
```bash
# Temporary bypass
SKIP_TESTS=1 git commit -m "..."

# Or disable pre-commit completely
git commit --no-verify -m "..."
```

**Note:** CI/CD всё равно выполнит все проверки.

---

### CI/CD tests failing после bypass

**Проблема:** Pre-commit bypassed, CI/CD обнаружил ошибки

**Решение:**
1. Исправить ошибки локально
2. Запустить `npm run type-check` вручную
3. Commit с нормальным pre-commit hook
4. Force-push если нужно

---

### Cache не работает

**Проблема:** npm ci занимает > 2 min каждый раз

**Диагностика:**
```bash
# Проверить cache key в GitHub Actions logs
# Should see: "Cache hit: true"
```

**Решение:**
- Проверить что `package-lock.json` committed
- Очистить cache в Settings → Actions → Caches

---

## Migration Guide

### Для новых contributors

**Нет миграции** - всё работает автоматически после `git clone`.

### Для существующих веток

**Если есть старый pre-commit hook:**

```bash
# Обновить husky hooks
npm install
npx husky install

# Verify
cat .husky/pre-commit | grep "Unit tests"
# Should see: "Unit tests will run in CI/CD pipeline"
```

---

## Future Improvements

### Возможные оптимизации

**1. Incremental Type Check**

```yaml
- name: TypeScript incremental check
  run: npm run type-check -- --incremental
```

**Экономия:** ~30-50% времени type-check

**2. Affected Tests Only**

```yaml
- name: Run affected tests
  run: npm test -- --changed --since=${{ github.base_ref }}
```

**Экономия:** ~40-60% времени на tests (если изменения локальные)

**3. Matrix Strategy для E2E**

```yaml
strategy:
  matrix:
    browser: [chromium, firefox, webkit]
```

**Ускорение:** E2E tests run in parallel per browser

---

## References

- GitHub Actions Cache: https://docs.github.com/en/actions/using-workflows/caching-dependencies
- Codecov: https://docs.codecov.com/docs/quick-start
- Vitest Coverage: https://vitest.dev/guide/coverage.html

---

**Last Updated:** 2026-02-03
**Author:** ikeniborn (CI/CD optimization)
