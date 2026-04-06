# CI/CD Setup Guide

**Date:** 2026-01-06
**Status:** ✅ ACTIVE
**Version:** 1.0.0

---

## Overview

Automated testing and quality checks integrated into GitHub Actions workflow. Every push and pull request triggers comprehensive validation to ensure code quality before merge.

## GitHub Actions Workflow

### Workflow File
`.github/workflows/frontend-tests.yml`

### Triggers
- **Push:** to `main`, `test`, `feature/*`, `fix/*` branches
- **Pull Request:** to `main`, `test` branches
- **Paths:** Only runs when frontend files change

### Jobs

#### 1. Type Check (Required)
**Purpose:** Validate TypeScript types

**Steps:**
- Checkout code
- Setup Node.js 18
- Install dependencies (`npm ci`)
- Run type check (`npm run type-check`)

**Failure conditions:**
- Any TypeScript errors
- Type mismatches
- Missing type definitions

#### 2. Unit & Integration Tests (Required)
**Purpose:** Run all tests with coverage reporting

**Depends on:** Type Check

**Steps:**
- Checkout code
- Setup Node.js 18
- Install dependencies
- Run tests with coverage (`npm run test:coverage`)
- Upload coverage to Codecov (optional, requires token)
- Check coverage thresholds
- Upload coverage report as artifact

**Coverage Thresholds:**
- Lines: 8.9%
- Functions: 84%
- Branches: 92%
- Statements: 8.9%

**Failure conditions:**
- Any test failure
- Coverage below thresholds
- Test timeout (>120s)

#### 3. Build Check (Required)
**Purpose:** Verify production build succeeds

**Depends on:** Type Check

**Steps:**
- Checkout code
- Setup Node.js 18
- Install dependencies
- Build CSS (`npm run build:css`)
- Bundle JavaScript (`npm run bundle`)
- Verify bundle sizes (max 500KB)
- Upload build artifacts

**Failure conditions:**
- Build errors
- Bundle size exceeds 500KB
- Missing output files

#### 4. Linting (Required)
**Purpose:** Check code style and patterns

**Steps:**
- Checkout code
- Setup Node.js 18
- Install dependencies
- Check for `console.log` in TypeScript files

**Failure conditions:**
- `console.log` found (use `debugLog()` instead)

---

## Pre-Commit Hook

### File
`.husky/pre-commit`

### Checks (Sequential)

#### 1. Console.log Check
**What:** Scans staged TypeScript files for `console.log`
**Why:** Prevent debug statements from reaching production
**Alternative:** Use `debugLog()` or `logAPI` methods

```bash
if git diff --cached --name-only | grep '\.ts$' | xargs grep -n 'console\.log'; then
  echo "❌ console.log found"
  exit 1
fi
```

#### 2. Type Check
**What:** Run TypeScript compiler in no-emit mode
**Why:** Catch type errors before commit

```bash
npm run type-check
```

#### 3. Unit Tests
**What:** Run all unit and integration tests
**Why:** Prevent broken code from being committed
**Note:** Fast mode, no coverage (saves time)

```bash
npm test -- --run --reporter=dot
```

### Bypass Pre-Commit Hook
**WARNING:** Only for emergencies

```bash
git commit --no-verify -m "Emergency fix"
```

---

## Pull Request Template

### File
`.github/pull_request_template.md`

### Sections

1. **Description** - What changes were made
2. **Type of Change** - Bug fix, feature, refactor, etc.
3. **Testing** - Test coverage checklist
4. **Code Quality** - Quality checks checklist
5. **Conventional Commits** - PR title format
6. **Related Issues** - Linked issues
7. **Screenshots/Videos** - UI changes (if applicable)
8. **Deployment Notes** - Special considerations
9. **Reviewer Notes** - Attention points

### PR Title Format
Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <description>

Examples:
feat(lists): add autocomplete for product names
fix(offline): prevent duplicate sync queue entries
refactor(state): extract ListsState from monolithic file
test(integration): add multi-tab coordination tests
docs(architecture): update testing infrastructure guide
```

**Types:**
- `feat` - New feature
- `fix` - Bug fix
- `refactor` - Code restructuring
- `test` - Test additions/changes
- `docs` - Documentation
- `style` - Formatting, missing semicolons
- `perf` - Performance improvements
- `chore` - Maintenance tasks

---

## Issue Templates

### Bug Report
**File:** `.github/ISSUE_TEMPLATE/bug_report.md`

**Sections:**
- Bug description
- Steps to reproduce
- Expected vs actual behavior
- Screenshots/logs
- Environment (browser, OS, device)
- Related code
- Possible solution

### Feature Request
**File:** `.github/ISSUE_TEMPLATE/feature_request.md`

**Sections:**
- Feature description
- Problem/motivation
- Proposed solution
- Alternatives considered
- User stories
- Technical considerations
- Priority level

---

## Codecov Integration (Optional)

### Setup
1. Sign up at [codecov.io](https://codecov.io)
2. Add repository
3. Get upload token
4. Add token to GitHub Secrets: `CODECOV_TOKEN`

### Benefits
- Coverage trend tracking
- Pull request coverage comments
- Coverage diff visualization
- Historical coverage reports

### Configuration
Set `fail_ci_if_error: true` in workflow to enforce coverage uploads.

---

## Local Development Workflow

### Before Commit
```bash
# 1. Type check
npm run type-check

# 2. Run tests
npm test

# 3. Build (optional)
npm run build

# 4. Commit (triggers pre-commit hook)
git add .
git commit -m "feat(scope): description"
```

### Pre-Commit Hook Runs
1. ✅ Check for console.log
2. ✅ Type check
3. ✅ Run tests
4. ✅ Commit if all pass

### Push to GitHub
```bash
git push origin feature/my-feature
```

### GitHub Actions Runs
1. ✅ Type check
2. ✅ Unit & integration tests with coverage
3. ✅ Build verification
4. ✅ Linting
5. ✅ Upload artifacts

---

## Quality Gates

### Local (Pre-Commit)
- **Type Check:** MUST pass
- **Tests:** MUST pass (388 tests)
- **Console.log:** MUST NOT exist

### CI/CD (GitHub Actions)
- **Type Check:** MUST pass
- **Tests:** MUST pass with coverage ≥ thresholds
- **Build:** MUST succeed, bundle ≤ 500KB
- **Linting:** MUST pass

### Pull Request
- **All CI checks:** MUST be green ✅
- **Code review:** REQUIRED (1+ approvals)
- **Conflicts:** MUST be resolved
- **PR template:** MUST be filled

---

## Troubleshooting

### Pre-Commit Hook Issues

#### Tests failing locally
```bash
# Run tests to see failures
npm test

# Skip hook for emergency commit (NOT recommended)
git commit --no-verify -m "WIP: debugging"
```

#### Type check fails
```bash
# See all errors
npm run type-check

# Watch mode for fixing
npm run type-check:watch
```

#### console.log detected
```bash
# Find all console.log
git diff --cached --name-only | xargs grep -n 'console\.log'

# Replace with debugLog()
# or remove before committing
```

### GitHub Actions Issues

#### Coverage upload fails
**Problem:** Codecov token missing or invalid
**Solution:** Add `CODECOV_TOKEN` to repository secrets, or set `fail_ci_if_error: false`

#### Build size exceeds limit
**Problem:** Bundle > 500KB
**Solution:**
- Run bundle analyzer: `npm run analyze`
- Remove unnecessary dependencies
- Code split large modules
- Optimize imports

#### Tests timeout
**Problem:** Tests take > 120s
**Solution:**
- Optimize slow tests
- Reduce fake timer delays
- Check for infinite loops
- Use `--bail` to fail fast

---

## Metrics & Monitoring

### Test Execution Time
**Target:** < 5 seconds
**Current:** 3.33s ✅

### Coverage Trends
**Baseline:** 8.92% (Phase 3)
**Phase 4:** 15% target
**Phase 5:** 30% target
**Phase 6:** 50% target
**Phase 7:** 70% target

### Build Time
**Target:** < 30 seconds
**Monitor:** GitHub Actions workflow duration

### Bundle Size
**Target:** < 500KB
**Monitor:** Build check job output

---

## Next Steps

### Phase 5: E2E Tests
- [ ] Expand Playwright E2E tests
- [ ] Add to CI/CD workflow
- [ ] Test critical user paths

### Phase 6: Advanced CI/CD
- [ ] Add Codecov coverage comments on PRs
- [ ] Set up branch protection rules
- [ ] Add automatic dependency updates (Dependabot)
- [ ] Performance regression testing

### Phase 7: Monitoring
- [ ] Bundle size tracking over time
- [ ] Test execution time monitoring
- [ ] Flaky test detection
- [ ] Coverage trend dashboard

---

## References

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Conventional Commits](https://www.conventionalcommits.org/)
- [Codecov Documentation](https://docs.codecov.com/)
- [Husky Documentation](https://typicode.github.io/husky/)
- [Vitest Coverage](https://vitest.dev/guide/coverage.html)
