# GitHub Workflows Cleanup Design

**Date:** 2026-05-31  
**Status:** Approved

## Problem

Three redundant workflows in `.github/workflows/`:

1. `backend-static-checks.yml` — duplicates the `backend-quality` job in `pr-checks.yml` (mypy + ruff, same paths, same commands).
2. `diagnose-backend.yml` — subset of `collect-backend-logs.yml`. Both `workflow_dispatch`, both SSH into test server, both run `docker ps/logs/inspect`.
3. `collect-backend-logs.yml` — superset of diagnose (adds asyncpg/uvicorn/.so checks). Created later to extend diagnose's capability without cleaning up the original.

## Solution

### 1. Delete `backend-static-checks.yml`

No replacement needed. `pr-checks.yml` already covers:
- mypy type checking (`backend-quality` job)
- ruff linting (`backend-quality` job)
- Same path filters (`backend/**`, `bot/**`)

### 2. Merge diagnose + collect → new `diagnose-backend.yml`

Single `workflow_dispatch` workflow with `mode` input:

```yaml
inputs:
  mode:
    description: 'Diagnosis depth'
    type: choice
    options: [quick, full]
    default: quick
```

**quick mode** (replaces `diagnose-backend.yml`):
- `docker ps -a | grep familybudget-backend`
- `docker logs familybudget-backend --tail 150`
- `docker inspect .State`
- `docker-compose ps`
- `docker-compose config | grep -A 10 "backend:"`

**full mode** (replaces `collect-backend-logs.yml`), adds:
- asyncpg import test via `docker run`
- uvicorn version check via `docker run`
- `.so` dependency scan via `ldd`

Steps marked `if: inputs.mode == 'full'` for conditional execution.

## Files Changed

| Action | File |
|--------|------|
| Delete | `.github/workflows/backend-static-checks.yml` |
| Delete | `.github/workflows/collect-backend-logs.yml` |
| Replace | `.github/workflows/diagnose-backend.yml` |

## Unchanged Workflows

| File | Reason |
|------|--------|
| `build-and-push.yml` | Main CI/CD pipeline |
| `pr-checks.yml` | Consolidated PR gate (absorbs backend-static-checks) |
| `api-contract-tests.yml` | OpenAPI schema + TS types validation (unique) |
| `cache-busting-validation.yml` | Cache version + PLACEHOLDER validation (unique) |
| `security-scan.yml` | npm audit + pip-audit + Trivy, daily schedule (unique) |
| `e2e-tests.yml` | Playwright E2E against fbd.ikeniborn.ru (unique) |
| `deploy-prod.yml` | SSH deploy to production (unique) |

## Implementation Steps

1. Delete `backend-static-checks.yml`
2. Delete `collect-backend-logs.yml`
3. Write new `diagnose-backend.yml` merging both originals
4. Commit all three changes in one commit on `dev/cleanup-legacy-workflows`
5. PR → `test`
