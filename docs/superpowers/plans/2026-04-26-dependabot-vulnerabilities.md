# Dependabot Vulnerabilities Remediation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close all 15 open Dependabot alerts (9 high + 6 moderate) on the default branch in a single PR `dev/security-deps-2026-04 → test`, bumping `VERSION` 0.6.154 → 0.6.155.

**Architecture:** No code changes — only manifest bumps in `backend/requirements.txt`, `bot/requirements.txt`, `backend/requirements-dev.txt`, `package.json`, plus a new `overrides` block in `package.json` to force-fix transitive npm vulnerabilities. Each task is one bump-group + verification + commit.

**Tech Stack:** pip (Python), npm (Node), pytest, vitest, Dependabot.

**Spec:** `docs/superpowers/specs/2026-04-26-dependabot-vulnerabilities-design.md`

---

### Task 1: Branch setup

**Files:**
- None (git operation only)

- [ ] **Step 1: Sync and create branch**

```bash
git checkout test
git pull
git checkout -b dev/security-deps-2026-04
```

Expected: clean checkout on new branch, no uncommitted changes.

- [ ] **Step 2: Verify starting state**

```bash
git status
cat VERSION
```

Expected: working tree clean; `VERSION` reads `0.6.154`.

---

### Task 2: Bump Python runtime deps (backend)

**Files:**
- Modify: `backend/requirements.txt`

- [ ] **Step 1: Edit `backend/requirements.txt`**

Replace:
```
python-dotenv==1.0.1
```
with:
```
python-dotenv==1.2.2
```

Replace:
```
python-multipart==0.0.22
```
with:
```
python-multipart==0.0.26
```

- [ ] **Step 2: Verify install in clean venv**

```bash
python3 -m venv /tmp/fb-backend-venv
source /tmp/fb-backend-venv/bin/activate
pip install -r backend/requirements.txt
deactivate
rm -rf /tmp/fb-backend-venv
```

Expected: install completes without resolver conflicts.

- [ ] **Step 3: Commit**

```bash
git add backend/requirements.txt
git commit -m "chore(deps): bump python-dotenv 1.0.1→1.2.2, python-multipart 0.0.22→0.0.26 (CVE-2026-28684, CVE-2026-40347)"
```

---

### Task 3: Bump Python runtime deps (bot)

**Files:**
- Modify: `bot/requirements.txt`

- [ ] **Step 1: Edit `bot/requirements.txt`**

Replace:
```
python-dotenv==1.0.1
```
with:
```
python-dotenv==1.2.2
```

- [ ] **Step 2: Verify install in clean venv**

```bash
python3 -m venv /tmp/fb-bot-venv
source /tmp/fb-bot-venv/bin/activate
pip install -r bot/requirements.txt
deactivate
rm -rf /tmp/fb-bot-venv
```

Expected: install completes without resolver conflicts.

- [ ] **Step 3: Commit**

```bash
git add bot/requirements.txt
git commit -m "chore(deps): bump python-dotenv 1.0.1→1.2.2 in bot (CVE-2026-28684)"
```

---

### Task 4: Bump pytest 8 → 9 (major)

**Files:**
- Modify: `backend/requirements-dev.txt`
- Test: existing backend test suite (no new tests written — discipline = make existing suite pass under pytest 9)

- [ ] **Step 1: Edit `backend/requirements-dev.txt`**

Replace:
```
pytest==8.3.4
```
with:
```
pytest==9.0.3
```

- [ ] **Step 2: Install pytest 9 + companion plugins**

```bash
python3 -m venv /tmp/fb-pytest-venv
source /tmp/fb-pytest-venv/bin/activate
pip install -r backend/requirements.txt -r backend/requirements-dev.txt
```

If pip resolver reports conflict for `pytest-asyncio`, `pytest-cov`, or `pytest-xdist` against pytest 9, bump that companion package to its latest pytest-9-compatible release in `backend/requirements-dev.txt` and re-install. Record exact versions chosen.

Expected: clean install with pytest 9.0.3.

- [ ] **Step 3: Run test collection only**

```bash
cd tests && pytest --collect-only 2>&1 | tail -50
```

Expected: collection succeeds. If failures appear (e.g., removed `pytest.warns(None)` API, deprecated fixtures), fix them in-place — see step 4.

- [ ] **Step 4: Fix collection-time breakages (if any)**

Common pytest 9 breakages to look for:
- `pytest.warns(None)` → replace with `warnings.catch_warnings()` or specific warning class
- `tmpdir` fixture stricter behavior — switch to `tmp_path` if used
- Removed `--strict` flag (use `--strict-markers` / `--strict-config`)

For each broken file, edit minimally and re-run `pytest --collect-only`. Do not suppress warnings — fix root cause.

- [ ] **Step 5: Run full backend test suite**

```bash
cd tests && ./run-tests.sh backend
```

Expected: all tests green. If failures, fix runtime breakages explicitly. Each fix is one focused edit, then re-run.

- [ ] **Step 6: Cleanup venv**

```bash
deactivate
rm -rf /tmp/fb-pytest-venv
```

- [ ] **Step 7: Commit**

```bash
git add backend/requirements-dev.txt
# If test files were modified to fix pytest 9 breakages, add them too:
git add tests/  # only if changes there
git commit -m "chore(deps): upgrade pytest 8.3.4→9.0.3 with test fixes (CVE-2025-71176)"
```

---

### Task 5: Resync black (alert #76)

**Files:**
- None to modify (`black==26.3.1` already in `backend/requirements-dev.txt` matches the fixed version)

- [ ] **Step 1: Verify black version is already 26.3.1**

```bash
grep "^black==" backend/requirements-dev.txt
```

Expected: `black==26.3.1`. Alert #76 will auto-resolve via fresh install in CI; no version change needed. No commit for this task.

---

### Task 6: Bump npm direct deps (vite, happy-dom)

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json` (auto-regenerated)

- [ ] **Step 1: Edit `package.json`**

Replace:
```json
"vite": "^6.4.1",
```
with:
```json
"vite": "^6.4.2",
```

Replace:
```json
"happy-dom": "^20.0.11",
```
with:
```json
"happy-dom": "^20.8.9",
```

- [ ] **Step 2: Reinstall**

```bash
npm install
```

Expected: lockfile updates without errors.

- [ ] **Step 3: Run frontend build**

```bash
npm run type-check
npm run build:css
npm run bundle
```

Expected: 0 type errors, all bundles produced under `dist/`.

- [ ] **Step 4: Run frontend unit tests**

```bash
npm run test:coverage
```

Expected: all Vitest tests green. If happy-dom 20.8.9 changed `fetch` credential behavior breaks tests using `credentials: 'include'`, fix the test expectations (do not mock around the change).

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json
# If frontend tests were modified, add them too:
# git add tests/unit/  # only if changes there
git commit -m "chore(deps): bump vite ^6.4.1→^6.4.2, happy-dom ^20.0.11→^20.8.9 (CVE-2026-39363, CVE-2026-39365, CVE-2026-34226)"
```

---

### Task 7: Update transitive npm deps via npm update

**Files:**
- Modify: `package-lock.json`

- [ ] **Step 1: Run npm update**

```bash
npm update
```

Expected: lockfile updates transitive deps within semver bounds. Some Dependabot alerts may close at this step.

- [ ] **Step 2: Inspect remaining vulnerabilities**

```bash
npm audit
```

Record which of `lodash`, `rollup`, `svgo`, `minimatch`, `flatted` still report vulnerabilities. These need overrides in Task 8.

- [ ] **Step 3: Run build + tests to confirm no regression**

```bash
npm run type-check
npm run bundle
npm run test:coverage
```

Expected: all pass.

- [ ] **Step 4: Commit (if lockfile changed)**

```bash
git add package-lock.json
git commit -m "chore(deps): npm update for transitive security patches"
```

If `npm update` produced no lockfile changes, skip the commit and proceed to Task 8.

---

### Task 8: Force-fix remaining transitive deps via overrides

**Files:**
- Modify: `package.json` (add `overrides` block)
- Modify: `package-lock.json`

- [ ] **Step 1: Add `overrides` block to `package.json`**

Add the following at the top level of `package.json` (before or after `devDependencies`, valid JSON sibling). Include only packages still flagged by `npm audit` after Task 7:

```json
"overrides": {
  "lodash": "^4.18.0",
  "rollup": "^4.59.0",
  "svgo": "^4.0.1",
  "minimatch": "^9.0.7",
  "flatted": "^3.4.2"
}
```

If any of these were already resolved by Task 7's `npm update`, omit them from the overrides block.

- [ ] **Step 2: Reinstall**

```bash
npm install
```

Expected: install succeeds, `package-lock.json` reflects overridden versions.

- [ ] **Step 3: Verify zero vulnerabilities**

```bash
npm audit
```

Expected: `found 0 vulnerabilities`.

- [ ] **Step 4: Verify lodash version**

```bash
npm ls lodash
```

Expected: all instances at ≥4.18.0.

- [ ] **Step 5: Run full build + tests**

```bash
npm run type-check
npm run build:css
npm run bundle
npm run test:coverage
```

Expected: all pass. If a peer-dep warning appears for an overridden package, evaluate whether it indicates a real breakage; if tests pass, the warning is acceptable.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore(deps): override transitive npm deps for security (lodash, rollup, svgo, minimatch, flatted)"
```

---

### Task 9: Version bump

**Files:**
- Modify: `VERSION`
- Modify: `package.json`, `package-lock.json` (auto-synced by pre-commit hook)

- [ ] **Step 1: Edit `VERSION`**

Replace contents:
```
0.6.154
```
with:
```
0.6.155
```

- [ ] **Step 2: Stage and commit (pre-commit hook syncs package.json)**

```bash
git add VERSION
git commit -m "chore: bump version 0.6.154 → 0.6.155"
```

Pre-commit hook will:
1. Sync `package.json` and `package-lock.json` to `0.6.155`
2. Re-stage them automatically

- [ ] **Step 3: Verify sync**

```bash
git log -1 --stat
grep '"version"' package.json
```

Expected: `package.json` and `package-lock.json` both updated; `package.json` shows `"version": "0.6.155"`.

---

### Task 10: Final local verification

**Files:**
- None modified (verification only)

- [ ] **Step 1: Backend test suite**

```bash
cd tests && ./run-tests.sh backend
```

Expected: all green.

- [ ] **Step 2: Frontend full build**

```bash
npm run type-check
npm run build:css
npm run bundle
```

Expected: 0 errors.

- [ ] **Step 3: Frontend tests**

```bash
npm run test:coverage
```

Expected: all green.

- [ ] **Step 4: npm audit**

```bash
npm audit
```

Expected: `found 0 vulnerabilities`.

- [ ] **Step 5: Confirm git log is clean**

```bash
git log test..HEAD --oneline
```

Expected: ordered commits matching tasks 2, 3, 4, 6, 7 (optional), 8, 9. No stray commits.

---

### Task 11: Push and open PR

**Files:**
- None (git/gh operation only)

- [ ] **Step 1: Push branch**

```bash
git push -u origin dev/security-deps-2026-04
```

- [ ] **Step 2: Create PR with detailed body**

```bash
gh pr create --base test \
  --title "chore(deps): patch 15 Dependabot vulnerabilities (9 high / 6 moderate)" \
  --body "$(cat <<'EOF'
## Summary

Closes 15 open Dependabot alerts on default branch (9 high, 6 moderate).

Spec: `docs/superpowers/specs/2026-04-26-dependabot-vulnerabilities-design.md`
Plan: `docs/superpowers/plans/2026-04-26-dependabot-vulnerabilities.md`

## Alerts addressed

### Runtime Python
- #95, #94 — python-dotenv 1.0.1 → 1.2.2 (CVE-2026-28684) — backend + bot
- #93 — python-multipart 0.0.22 → 0.0.26 (CVE-2026-40347)

### Runtime npm (via overrides)
- #90, #91 — lodash → ≥4.18.0 (CVE-2026-4800, CVE-2026-2950)

### Build/test npm
- #88, #89 — vite ^6.4.1 → ^6.4.2 (CVE-2026-39363, CVE-2026-39365)
- #87 — happy-dom ^20.0.11 → ^20.8.9 (CVE-2026-34226)
- #72 — rollup → ≥4.59.0 (CVE-2026-27606)
- #75 — svgo → ≥4.0.1 (CVE-2026-29074)
- #70, #73 — minimatch → ≥3.1.3 / ≥9.0.7 (CVE-2026-27903)
- #78 — flatted → ≥3.4.2 (CVE-2026-33228)

### Python dev tools
- #92 — pytest 8.3.4 → 9.0.3 (CVE-2025-71176, major bump)
- #76 — black resync (already at 26.3.1, alert auto-resolves)

## Test plan

- [x] Backend pytest suite green
- [x] Frontend type-check + bundle + build:css clean
- [x] Vitest unit tests green
- [x] `npm audit` reports 0 vulnerabilities
- [ ] Dependabot rescan post-merge confirms 0 open alerts

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 3: Verify PR created**

```bash
gh pr view --web
```

Expected: PR opens in browser, base = `test`, all checks pending or running.

---

### Task 12: Post-merge verification

**Files:**
- None (verification only — runs AFTER PR is merged into `test`)

- [ ] **Step 1: Wait 5–15 minutes after merge for Dependabot rescan**

- [ ] **Step 2: Query open alerts count**

```bash
gh api repos/:owner/:repo/dependabot/alerts -q '[.[] | select(.state=="open")] | length'
```

Expected: `0`.

- [ ] **Step 3: If non-zero, investigate**

```bash
gh api repos/:owner/:repo/dependabot/alerts -q '.[] | select(.state=="open") | {num: .number, pkg: .security_vulnerability.package.name, sev: .security_advisory.severity}'
```

For each remaining alert, determine whether it requires a follow-up override or another bump. Open a follow-up branch if needed.

- [ ] **Step 4: Verify CI/CD `build-and-push.yml` succeeded**

```bash
gh run list --branch test --workflow build-and-push.yml --limit 1
```

Expected: most recent run on `test` is `completed / success`. Docker images for backend and bot pushed successfully.
