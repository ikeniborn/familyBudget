# Example: E2E Validation Workflow

## Scenario

E2E тесты **всегда запускаются** (согласно требованиям пользователя), независимо от категории изменений.

**Changes:** Любые изменения в backend, frontend, или e2e tests

---

## Input (test-input.json)

```json
{
  "test_input": {
    "git_diff_context": {
      "backend_changed": true,
      "frontend_changed": false,
      "e2e_changed": false,
      "dependencies_changed": false,
      "ci_changed": false,
      "changed_files": ["backend/app/api/v1/endpoints/articles.py"]
    },
    "test_categories": ["e2e"],
    "autofix_enabled": true,
    "e2e_strategy": "full",
    "coverage_threshold": {
      "backend_lines": 30.0,
      "frontend_lines": 4.0,
      "frontend_functions": 32.0
    }
  }
}
```

---

## Execution Flow

### STAGE 5: E2E Testing (Playwright)

**Command:**
```bash
npm run test:e2e -- --reporter=json > playwright-results.json
```

**Test Projects:** 6 projects (setup + 5 browsers)

**Execution details:**

#### 1. Setup Project (Global Authentication)
```bash
# Duration: 15s
# Status: PASSED
# Creates: .auth/user.json (session storage)
```

#### 2. Chromium (Desktop)
```bash
# Tests: 8
# Duration: 1m 12s
# Status: PASSED
# Tests executed:
#   - test_webapp_loading.spec.ts (2 tests)
#   - test_form_submission.spec.ts (2 tests)
#   - test_offline_functionality.spec.ts (2 tests)
#   - test_mobile_navigation.spec.ts (2 tests)
```

#### 3. Firefox (Desktop)
```bash
# Tests: 8
# Duration: 1m 24s
# Status: PASSED
```

#### 4. WebKit (Desktop Safari)
```bash
# Tests: 8
# Duration: 1m 18s
# Status: PASSED
```

#### 5. Mobile Chrome (Pixel 5)
```bash
# Tests: 8
# Duration: 1m 22s
# Status: PASSED
# Viewport: 393×851
```

#### 6. Mobile Safari (iPhone 12)
```bash
# Tests: 8
# Duration: 1m 11s
# Status: PASSED
# Viewport: 390×844
```

---

## Result

**Total duration:** 5m 42s

**Summary:**
```json
{
  "e2e_testing": {
    "status": "passed",
    "total_tests": 8,
    "passed": 8,
    "failed": 0,
    "duration": "5m 42s",
    "projects": {
      "setup": {"status": "passed", "duration": "15s"},
      "chromium": {"status": "passed", "tests": 8, "duration": "1m 12s"},
      "firefox": {"status": "passed", "tests": 8, "duration": "1m 24s"},
      "webkit": {"status": "passed", "tests": 8, "duration": "1m 18s"},
      "mobile_chrome": {"status": "passed", "tests": 8, "duration": "1m 22s"},
      "mobile_safari": {"status": "passed", "tests": 8, "duration": "1m 11s"}
    },
    "test_files": [
      "tests/e2e/webapp/test_webapp_loading.spec.ts",
      "tests/e2e/webapp/test_form_submission.spec.ts",
      "tests/e2e/webapp/test_offline_functionality.spec.ts",
      "tests/e2e/webapp/test_mobile_navigation.spec.ts"
    ]
  }
}
```

**Test coverage:**
- ✅ Webapp loading (SSR, PWA, offline-first)
- ✅ Form submission (HTMX, validation)
- ✅ Offline functionality (Dexie.js, sync)
- ✅ Mobile navigation (responsive, touch events)

**Browser compatibility:**
- ✅ Chromium (desktop)
- ✅ Firefox (desktop)
- ✅ WebKit (desktop Safari)
- ✅ Mobile Chrome (Android)
- ✅ Mobile Safari (iOS)

---

## Failure Example

**Если E2E тест fails:**

```json
{
  "e2e_testing": {
    "status": "failed",
    "total_tests": 8,
    "passed": 7,
    "failed": 1,
    "duration": "3m 45s (aborted early)",
    "projects": {
      "chromium": {
        "status": "failed",
        "tests": 8,
        "duration": "1m 12s",
        "failures": [
          {
            "test": "test_offline_functionality.spec.ts:24 - should sync transactions when back online",
            "error": "Timeout waiting for WebSocket reconnection",
            "screenshot": "test-results/test_offline_functionality-chromium/failure-screenshot-1.png",
            "video": "test-results/test_offline_functionality-chromium/video.webm",
            "trace": "test-results/test_offline_functionality-chromium/trace.zip"
          }
        ]
      }
    }
  }
}
```

**Debugging artifacts:**
- 📸 Screenshot: `failure-screenshot-1.png`
- 🎥 Video: `video.webm`
- 📊 Trace: `trace.zip` (открыть в Playwright Trace Viewer)

**Debug command:**
```bash
npm run test:e2e:debug -- --grep "should sync transactions when back online"
```

---

## Why E2E Always Runs

**User requirement:**
> "E2E strategy: Всегда запускать E2E тесты (полное покрытие, ~5-10 мин)"

**Reasons:**
1. **Regression prevention:** Backend changes могут сломать frontend workflow
2. **Cross-browser coverage:** Убедиться что все 5 браузеров работают
3. **Integration testing:** Проверить full stack (backend API + frontend UI + WebSocket)
4. **Production readiness:** E2E тесты имитируют real user scenarios

**Trade-off:**
- ⏱️ Adds 5-6 min to every validation
- 💰 CI/CD cost (6 parallel browser instances)
- ✅ Confidence: Critical flows tested before deploy

---

## Summary

E2E тесты - **финальная проверка перед commit**.

**Best practices:**
- Run E2E locally before pushing (avoid breaking main)
- Review screenshots/videos при failures
- Use `--grep` для debugging specific tests
- Update E2E tests when adding new features

**Integration с workflow:**
```
PHASE 3: Code execution
   ↓
PHASE 4: Validation → @skill:test-code
   ├─ STAGE 1-4: Fast tests (syntax, quality, runtime, deps) [2-4 min]
   └─ STAGE 5: E2E tests (всегда) [5-6 min]
   ↓
PHASE 5A: Git commit (только если E2E passed)
```
