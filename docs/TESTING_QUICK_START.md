# Testing & CI/CD Quick Start

**For Developers** | Family Budget Project

---

## Running Tests Locally

### All Tests
```bash
npm test                    # Watch mode (auto-rerun on changes)
npm test -- --run          # Single run
```

### With Coverage
```bash
npm run test:coverage      # Generate coverage report
open coverage/index.html   # View HTML report (macOS)
xdg-open coverage/index.html  # View HTML report (Linux)
```

### Specific Tests
```bash
npm test -- unit/state                           # All state tests
npm test -- unit/operations/syncQueue.test.ts    # Specific file
npm test -- integration                          # All integration tests
```

### Interactive UI
```bash
npm run test:ui            # Vitest UI (browser-based)
```

---

## Type Checking

### Check Types
```bash
npm run type-check         # Check all TypeScript types
npm run type-check:watch   # Watch mode
```

---

## Building

### Development Build
```bash
npm run build:css          # Build CSS with Tailwind
npm run bundle:dev         # Build JS with sourcemaps
npm run watch              # Watch mode (CSS + JS)
```

### Production Build
```bash
npm run build              # Full build (type check + CSS + JS + precompress)
```

---

## Pre-Commit Hook

### Automatic Checks (Every Commit)
1. ✅ Console.log detection in staged TypeScript files
2. ✅ TypeScript type check
3. ✅ Unit tests (fast mode, ~5s)

### What Happens
```bash
git add .
git commit -m "feat: add new feature"

# Pre-commit hook runs automatically:
# 🔍 Running pre-commit checks...
# 1️⃣  Checking for console.log...
# ✅ No console.log found
# 2️⃣  Running TypeScript type check...
# ✅ Type check passed
# 3️⃣  Running unit tests...
# ✅ All tests passed (388 tests in 3.33s)
# ✅ All pre-commit checks passed!
```

### Bypass (Emergency Only)
```bash
git commit --no-verify -m "Emergency fix"
```

**⚠️ WARNING:** Only use `--no-verify` for urgent hotfixes. All bypassed commits will still be checked by CI.

---

## GitHub Actions CI/CD

### When It Runs
- **Push** to: `main`, `test`, `feature/*`, `fix/*`
- **Pull Request** to: `main`, `test`
- **Condition:** Only when frontend files change

### What It Checks
1. ✅ TypeScript type check (~10-15s)
2. ✅ Unit & integration tests with coverage (~30-40s)
3. ✅ Production build verification (~20-30s)
4. ✅ Linting (console.log detection)

### Total CI Time
~60-90 seconds for complete validation

### Viewing Results
- Check **Actions** tab on GitHub
- PR checks appear automatically
- Green ✅ = All checks passed
- Red ❌ = Fix errors and push again

---

## Creating Pull Requests

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
- `style` - Formatting
- `perf` - Performance improvements
- `chore` - Maintenance tasks

### PR Checklist
When you create a PR, fill out the template:

- [ ] Description provided
- [ ] Type of change selected
- [ ] Tests added/updated
- [ ] All tests passing locally
- [ ] Code coverage maintained
- [ ] Type check passes
- [ ] No `console.log` in code
- [ ] Build succeeds
- [ ] PR title follows conventional commits

---

## Reporting Issues

### Bug Report
1. Go to **Issues** → **New Issue**
2. Select **Bug Report** template
3. Fill in:
   - Bug description
   - Steps to reproduce
   - Expected vs actual behavior
   - Screenshots/logs
   - Environment (browser, OS, device)

### Feature Request
1. Go to **Issues** → **New Issue**
2. Select **Feature Request** template
3. Fill in:
   - Feature description
   - Problem/motivation
   - Proposed solution
   - User stories

---

## Common Commands Reference

### Testing
| Command | Description |
|---------|-------------|
| `npm test` | Run tests in watch mode |
| `npm test -- --run` | Run tests once |
| `npm run test:coverage` | Run tests with coverage |
| `npm run test:ui` | Open Vitest UI |

### Type Checking
| Command | Description |
|---------|-------------|
| `npm run type-check` | Check types once |
| `npm run type-check:watch` | Check types in watch mode |

### Building
| Command | Description |
|---------|-------------|
| `npm run build` | Full production build |
| `npm run build:css` | Build CSS only |
| `npm run bundle` | Build JavaScript only |
| `npm run watch` | Watch mode (CSS + JS) |

### Linting
| Command | Description |
|---------|-------------|
| `git diff --cached --name-only \| grep '\.ts$' \| xargs grep -n 'console\.log'` | Find console.log in staged files |

---

## Quality Standards

### Required Before Merge
- ✅ All tests passing (388 tests)
- ✅ Type check passing (0 errors)
- ✅ Coverage ≥ thresholds:
  - Lines: ≥ 8.9%
  - Functions: ≥ 84%
  - Branches: ≥ 92%
  - Statements: ≥ 8.9%
- ✅ Build succeeds, bundle ≤ 500KB
- ✅ No `console.log` in TypeScript files
- ✅ PR template filled
- ✅ Code review approved

---

## Troubleshooting

### Tests Failing Locally
```bash
# See detailed output
npm test -- --run --reporter=verbose

# Run specific test file
npm test -- path/to/test.ts
```

### Type Check Errors
```bash
# See all errors
npm run type-check

# Watch mode for fixing
npm run type-check:watch
```

### console.log Detected
```bash
# Find all console.log
git diff --cached --name-only | xargs grep -n 'console\.log'

# Replace with debugLog() or remove
```

### Pre-Commit Hook Slow
The pre-commit hook runs ~388 tests in ~5 seconds. If it's too slow:
- Consider skipping for WIP commits: `git commit --no-verify`
- Push to remote (CI will catch issues)

### CI Failing But Tests Pass Locally
- Clear `node_modules`: `rm -rf node_modules && npm ci`
- Ensure you're using Node.js 18
- Check GitHub Actions logs for specific errors

---

## Getting Help

- **Testing Issues:** See `frontend/tests/TESTING_SUMMARY.md`
- **CI/CD Issues:** See `docs/architecture/guides/ci-cd-setup.md`
- **General Questions:** Open an issue with question label

---

## Documentation Links

- [Testing Summary](../frontend/tests/TESTING_SUMMARY.md)
- [CI/CD Setup Guide](./architecture/guides/ci-cd-setup.md)
- [Testing Phases Summary](./architecture/guides/testing-phases-summary.md)
- [Vitest Documentation](https://vitest.dev/)
- [Conventional Commits](https://www.conventionalcommits.org/)
