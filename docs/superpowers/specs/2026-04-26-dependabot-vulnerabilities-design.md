# Dependabot Vulnerabilities Remediation — Design Spec

**Date:** 2026-04-26
**Branch target:** `dev/security-deps-2026-04` → `test`
**Version bump:** 0.6.154 → 0.6.155

## 1. Goal

Reduce open Dependabot alerts on the default branch from 15 (9 high + 6 moderate) to 0 in a single PR.

## 2. Scope — Inventory of 15 Alerts

### Group A — Runtime Python (direct) — 3 alerts, all medium

| Alert | Package | Manifest | Current → Target | CVE/GHSA |
|---|---|---|---|---|
| #95 | python-dotenv | `backend/requirements.txt` | 1.0.1 → 1.2.2 | CVE-2026-28684 / GHSA-mf9w-mj56-hr94 |
| #94 | python-dotenv | `bot/requirements.txt` | 1.0.1 → 1.2.2 | CVE-2026-28684 / GHSA-mf9w-mj56-hr94 |
| #93 | python-multipart | `backend/requirements.txt` | 0.0.22 → 0.0.26 | CVE-2026-40347 / GHSA-mj87-hwqh-73pj |

### Group B — Runtime npm (transitive) — 2 alerts (1 high + 1 medium)

| Alert | Package | Current → Target | Severity | CVE |
|---|---|---|---|---|
| #90 | lodash | ≤4.17.23 → ≥4.18.0 | high | CVE-2026-4800 (Code Injection via `_.template`) |
| #91 | lodash | ≤4.17.23 → ≥4.18.0 | medium | CVE-2026-2950 (Prototype Pollution in `_.unset`/`_.omit`) |

### Group C — Build/test npm — 8 alerts (7 high + 1 medium)

| Alert | Package | Type | Current → Target | Severity |
|---|---|---|---|---|
| #88 | vite | direct | ^6.4.1 → ^6.4.2 | high (CVE-2026-39363, arbitrary file read via dev server WS) |
| #89 | vite | direct | ^6.4.1 → ^6.4.2 | medium (CVE-2026-39365, path traversal in `.map` handling) |
| #87 | happy-dom | direct | ^20.0.11 → ^20.8.9 | high (CVE-2026-34226, fetch credentials origin issue) |
| #72 | rollup | transitive | <4.59.0 → ≥4.59.0 | high (CVE-2026-27606, arbitrary file write via path traversal) |
| #75 | svgo | transitive | =4.0.0 → ≥4.0.1 | high (CVE-2026-29074, DoS Billion Laughs) |
| #73 | minimatch | transitive | 9.0.0–<9.0.7 → ≥9.0.7 | high (CVE-2026-27903, ReDoS) |
| #70 | minimatch | transitive | <3.1.3 → ≥3.1.3 | high (CVE-2026-27903, ReDoS) |
| #78 | flatted | transitive | ≤3.4.1 → ≥3.4.2 | high (CVE-2026-33228, Prototype Pollution) |

### Group D — Python dev tools — 2 alerts (1 high + 1 medium)

| Alert | Package | Manifest | Current → Target | Severity |
|---|---|---|---|---|
| #92 | pytest | `backend/requirements-dev.txt` | 8.3.4 → 9.0.3 (**major bump**) | medium (CVE-2025-71176, vulnerable tmpdir handling) |
| #76 | black | `backend/requirements-dev.txt` | 26.3.1 (already target) | high (CVE-2026-32274) — alert resolves via lockfile resync, no version change needed |

## 3. Branching & Versioning Strategy

- **Branch:** `dev/security-deps-2026-04`, branched from `test` (not `prod` — per CLAUDE.md constraint)
- **PR target:** `test`
- **PR title:** `chore(deps): patch 15 Dependabot vulnerabilities (9 high / 6 moderate)`
- **Version:** bump `VERSION` 0.6.154 → 0.6.155 (patch step; pre-commit hook syncs package.json/package-lock.json)
- **Single PR** for all 15 alerts (decision recorded during brainstorming)
- **Surgical scope:** only the listed packages; no opportunistic upgrades of unrelated dependencies

## 4. Risk Areas & Mitigations

### R1. pytest 8 → 9 (major) — highest risk
- Breaking changes in pytest 9: removed `pytest.warns(None)`, stricter `tmpdir` handling (this IS the CVE fix), changes to `--strict` and discovery
- **Mitigation:** run `pytest --collect-only` first to surface collection errors; then full run; fix breakages explicitly rather than suppressing warnings
- Companion deps to verify for compatibility: `pytest-asyncio==0.24.0`, `pytest-cov==6.0.0`, `pytest-xdist==3.6.1` — bump to latest pytest-9-compatible if needed

### R2. vite 6.4.1 → 6.4.2 (patch, low risk)
- **Mitigation:** `npm run build` post-upgrade; verify `dist/` structure; check cache-busting placeholders (`?v=PLACEHOLDER`)

### R3. happy-dom 20.0.11 → 20.8.9 (fetch credentials behavior changed)
- Tests using `fetch` with `credentials: 'include'` may behave differently
- **Mitigation:** `npm run test:coverage` — investigate any test failures rather than mocking around them

### R4. lodash override across transitive deps
- If no transitive consumer offers a chain to ≥4.18.0 within semver, use `package.json` `overrides` block
- **Mitigation:** `npm ls lodash` after install to verify; full build + tests; avoid `npm audit fix --force` (risks breaking peer deps)

### R5. python-multipart 0.0.22 → 0.0.26 (FastAPI 0.121.2 compatibility)
- **Mitigation:** clean venv install + import check; low risk (patch versions)

### R6. black resync (#76)
- Version `26.3.1` already matches the target. Alert auto-resolves once a fresh install/lockfile resync occurs in CI.

### Rollback plan
- A single atomic revert PR to `test` if regressions are detected post-merge but pre-release

## 5. Testing & Definition of Done

### Local verification (pre-commit, blocking)

1. **Backend Python deps install:**
   ```bash
   cd backend && pip install -r requirements.txt -r requirements-dev.txt
   cd ../bot && pip install -r requirements.txt
   ```
   Pass: resolver reports no conflicts.

2. **Backend tests:**
   ```bash
   cd tests && ./run-tests.sh backend
   ```
   Pass: all green. Pytest 9 breakages must be **fixed**, not suppressed.

3. **Frontend build:**
   ```bash
   npm install
   npm run type-check
   npm run build:css
   npm run bundle
   ```
   Pass: 0 type errors, all bundles built.

4. **Frontend unit tests:**
   ```bash
   npm run test:coverage
   ```
   Pass: all Vitest tests green (focus on fetch/cookies tests due to happy-dom).

5. **Audit verification:**
   ```bash
   npm audit --omit=dev
   npm audit
   ```
   Pass: 0 vulnerabilities.

### Post-merge verification

6. **GitHub Dependabot rescan** — after PR merges into `test`, wait for rescan and verify:
   ```bash
   gh api repos/:owner/:repo/dependabot/alerts -q '[.[] | select(.state=="open")] | length'
   ```
   Expected: `0`.

7. **CI/CD `build-and-push.yml`** — Docker images for backend and bot build successfully.

### NOT in DoD (per user decision)

- Playwright E2E — skipped; covered organically in `test` environment post-deploy
- Manual smoke-test on `fbd.ikeniborn.ru` — recommended but non-blocking

### PR completion criteria

- [ ] All 7 verification steps pass
- [ ] `VERSION` updated to 0.6.155
- [ ] Commit messages follow Conventional Commits

## 6. Implementation Steps

### Step 1 — Branch setup
```bash
git checkout test && git pull
git checkout -b dev/security-deps-2026-04
```

### Step 2 — Python runtime deps (low risk, first)
- Edit `backend/requirements.txt`:
  - `python-dotenv==1.0.1` → `python-dotenv==1.2.2`
  - `python-multipart==0.0.22` → `python-multipart==0.0.26`
- Edit `bot/requirements.txt`:
  - `python-dotenv==1.0.1` → `python-dotenv==1.2.2`
- Verify: clean-venv install for backend AND bot separately

### Step 3 — Python dev deps + pytest 9 migration (isolated commit)
- Edit `backend/requirements-dev.txt`: `pytest==8.3.4` → `pytest==9.0.3`
- Verify pytest-asyncio / pytest-cov / pytest-xdist compatibility with pytest 9; bump if needed
- Run `pytest --collect-only` → fix collection errors
- Run full backend pytest → fix runtime breakages explicitly
- Black: `pip-compile` if used, else simple reinstall — alert closes via lockfile resync

### Step 4 — npm direct deps
- Edit `package.json`:
  - `"vite": "^6.4.1"` → `"vite": "^6.4.2"`
  - `"happy-dom": "^20.0.11"` → `"happy-dom": "^20.8.9"`
- `npm install` → `package-lock.json` updates
- Run `npm run type-check && npm run build:css && npm run bundle && npm run test:coverage`

### Step 5 — npm transitive deps via overrides
- First try `npm update` — may close some alerts via semver upgrades of transitive versions
- `npm audit` to inspect remainder
- For remaining alerts, add `overrides` block to `package.json`:
  ```json
  "overrides": {
    "lodash": "^4.18.0",
    "rollup": "^4.59.0",
    "svgo": "^4.0.1",
    "minimatch": "^9.0.7",
    "flatted": "^3.4.2"
  }
  ```
- `npm install && npm audit` → expect 0 vulnerabilities
- Full build + tests again

### Step 6 — Version bump and atomic commits
- Bump `VERSION` 0.6.154 → 0.6.155 (pre-commit hook syncs package.json)
- Commit in groups for atomicity:
  1. `chore(deps): bump python runtime deps for security`
  2. `chore(deps): upgrade pytest 8 → 9 with test fixes` (separate commit if test fixes needed)
  3. `chore(deps): bump npm direct deps (vite, happy-dom)`
  4. `chore(deps): override transitive npm deps for security`
  5. `chore: bump version 0.6.154 → 0.6.155`

### Step 7 — PR to `test`
```bash
gh pr create --base test \
  --title "chore(deps): patch 15 Dependabot vulnerabilities (9 high / 6 moderate)"
```
PR body includes: CVE/GHSA list mapped to commits, DoD checklist, link to this spec.

### Step 8 — Post-merge verification
- Wait for Dependabot rescan on `test` (typically 5–15 min)
- Verify `gh api .../dependabot/alerts` returns 0 open

## 7. Out of Scope

- Unrelated dependency upgrades ("while we're here")
- E2E test runs as a blocking step
- Production deployment (handled separately by `deploy.sh` after `test` validation)
- Restructuring of `requirements*.txt` into `pyproject.toml`/uv (project still uses pip-style requirements)
