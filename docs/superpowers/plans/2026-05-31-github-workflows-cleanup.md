# GitHub Workflows Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove one duplicate workflow and merge two overlapping debug workflows into one parameterized workflow.

**Architecture:** Three file operations — delete `backend-static-checks.yml`, delete `collect-backend-logs.yml`, replace `diagnose-backend.yml` with a merged version that accepts `mode: quick|full` input.

**Tech Stack:** GitHub Actions YAML, appleboy/ssh-action@v1.0.3

---

## File Map

| Action | File |
|--------|------|
| Delete | `.github/workflows/backend-static-checks.yml` |
| Delete | `.github/workflows/collect-backend-logs.yml` |
| Replace | `.github/workflows/diagnose-backend.yml` |

---

### Task 1: Create dev branch

- [ ] **Step 1: Create branch from test**

```bash
git checkout test
git pull origin test
git checkout -b dev/cleanup-legacy-workflows
```

- [ ] **Step 2: Verify branch**

```bash
git branch --show-current
```

Expected output: `dev/cleanup-legacy-workflows`

---

### Task 2: Delete `backend-static-checks.yml`

**Files:**
- Delete: `.github/workflows/backend-static-checks.yml`

**Context:** This workflow runs mypy + ruff on `backend/**` and `bot/**` for PRs to `test`. The `backend-quality` job in `pr-checks.yml` already runs the same checks with the same path filters. No replacement needed.

- [ ] **Step 1: Verify the duplicate before deleting**

```bash
# Confirm pr-checks.yml covers the same checks
grep -A5 "backend-quality" .github/workflows/pr-checks.yml | grep -E "mypy|ruff"
```

Expected: lines containing `mypy` and `ruff`

- [ ] **Step 2: Delete the file**

```bash
git rm .github/workflows/backend-static-checks.yml
```

- [ ] **Step 3: Commit**

```bash
git commit -m "chore(ci): remove backend-static-checks.yml (duplicate of pr-checks.yml)

mypy + ruff already run in pr-checks.yml backend-quality job
with identical path filters and commands.

🤖 Generated with Claude Code

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

### Task 3: Write new `diagnose-backend.yml` and delete `collect-backend-logs.yml`

**Files:**
- Replace: `.github/workflows/diagnose-backend.yml`
- Delete: `.github/workflows/collect-backend-logs.yml`

**Context:** `diagnose-backend.yml` (quick check: status/logs/inspect) and `collect-backend-logs.yml` (deep check: adds asyncpg/uvicorn/.so tests) are merged into one workflow with a `mode: quick|full` input.

- [ ] **Step 1: Write new `diagnose-backend.yml`**

Replace the entire file contents with:

```yaml
name: Diagnose Backend Container

on:
  workflow_dispatch:
    inputs:
      mode:
        description: 'Diagnosis depth'
        required: false
        type: choice
        options: [quick, full]
        default: quick

jobs:
  diagnose:
    name: Diagnose backend (${{ inputs.mode || 'quick' }})
    runs-on: ubuntu-latest

    steps:
      - name: Container status
        uses: appleboy/ssh-action@v1.0.3
        with:
          host: ${{ secrets.TEST_SERVER_HOST }}
          username: ${{ secrets.TEST_SERVER_USER }}
          key: ${{ secrets.TEST_SERVER_SSH_KEY }}
          port: ${{ secrets.TEST_SERVER_SSH_PORT }}
          script: |
            echo "=== Backend Container Status ==="
            sudo docker ps -a | grep familybudget-backend || echo "No backend container found"

            echo -e "\n=== Backend Container Logs (last 150 lines) ==="
            sudo docker logs familybudget-backend --tail 150 2>&1 || echo "Cannot read logs"

            echo -e "\n=== Container State ==="
            sudo docker inspect familybudget-backend --format='{{json .State}}' | jq '.' || echo "Cannot inspect container"

            echo -e "\n=== All Running Containers ==="
            cd ~/familyBudget
            sudo docker-compose ps

            echo -e "\n=== Docker Compose Config Check ==="
            sudo docker-compose config | grep -A 10 "backend:"

      - name: Deep runtime checks (full mode only)
        if: ${{ inputs.mode == 'full' }}
        uses: appleboy/ssh-action@v1.0.3
        with:
          host: ${{ secrets.TEST_SERVER_HOST }}
          username: ${{ secrets.TEST_SERVER_USER }}
          key: ${{ secrets.TEST_SERVER_SSH_KEY }}
          port: ${{ secrets.TEST_SERVER_SSH_PORT }}
          script: |
            echo "=== Test Python Import (asyncpg) ==="
            sudo docker run --rm --entrypoint python ghcr.io/ikeniborn/familybudget-backend:test \
              -c "import sys; print(f'Python: {sys.version}'); import asyncpg; print('✅ asyncpg imported successfully')" \
              2>&1 || echo "❌ asyncpg import failed"

            echo -e "\n=== Check asyncpg .so Dependencies ==="
            sudo docker run --rm --entrypoint sh ghcr.io/ikeniborn/familybudget-backend:test \
              -c "find /opt/venv/lib/python3.11/site-packages/asyncpg -name '*.so' -exec ldd {} \; 2>&1 | grep -E '(not found|=>)'" \
              || echo "Cannot check .so dependencies"

            echo -e "\n=== Check uvicorn ==="
            sudo docker run --rm --entrypoint sh ghcr.io/ikeniborn/familybudget-backend:test \
              -c "which uvicorn && uvicorn --version" 2>&1 || echo "uvicorn not found"
```

- [ ] **Step 2: Delete `collect-backend-logs.yml`**

```bash
git rm .github/workflows/collect-backend-logs.yml
```

- [ ] **Step 3: Stage new diagnose-backend.yml**

```bash
git add .github/workflows/diagnose-backend.yml
```

- [ ] **Step 4: Verify staged changes look correct**

```bash
git diff --staged --stat
```

Expected output:
```
.github/workflows/collect-backend-logs.yml | 46 --------
.github/workflows/diagnose-backend.yml    | 37 +++---
2 files changed, 20 insertions(+), 63 deletions(-)
```
(exact numbers may differ slightly)

- [ ] **Step 5: Commit**

```bash
git commit -m "chore(ci): merge diagnose + collect-backend-logs into one workflow

collect-backend-logs.yml was a superset of diagnose-backend.yml.
Merged into diagnose-backend.yml with mode=quick|full input.

quick: container status, logs (150 lines), inspect, docker-compose ps
full:  quick + asyncpg import test, .so deps check, uvicorn version

🤖 Generated with Claude Code

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

### Task 4: Open PR to `test`

- [ ] **Step 1: Push branch**

```bash
git push -u origin dev/cleanup-legacy-workflows
```

- [ ] **Step 2: Create PR**

```bash
gh pr create \
  --base test \
  --title "chore(ci): remove legacy duplicate workflows" \
  --body "$(cat <<'EOF'
## Summary

- Delete `backend-static-checks.yml` — duplicate of `pr-checks.yml` backend-quality job (mypy + ruff)
- Delete `collect-backend-logs.yml` — merged into `diagnose-backend.yml`
- Replace `diagnose-backend.yml` with merged version supporting `mode: quick|full`

## Result

7 workflows remain (was 10). No functionality lost.

## Test plan

- [ ] Trigger `diagnose-backend` with `mode=quick` — verify container status/logs output
- [ ] Trigger `diagnose-backend` with `mode=full` — verify asyncpg/uvicorn output added
- [ ] Open a PR to `test` — verify `backend-static-checks` no longer runs, `pr-checks` mypy+ruff still runs

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Self-Review

**Spec coverage:**
- ✅ Delete `backend-static-checks.yml` → Task 2
- ✅ Delete `collect-backend-logs.yml` → Task 3
- ✅ New `diagnose-backend.yml` with `mode: quick|full` → Task 3, Step 1
- ✅ quick = status + logs + inspect + docker-compose → Step 1 SSH script
- ✅ full = quick + asyncpg + .so + uvicorn → Step 2 SSH script (conditional)
- ✅ PR to test → Task 4

**Placeholder scan:** None found. All steps contain exact commands and full YAML.

**Type consistency:** N/A — YAML only, no typed code.
