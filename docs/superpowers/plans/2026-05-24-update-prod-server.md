# Deploy v0.6.165 to Production Server — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deploy GitHub prod branch (v0.6.165) to `budget-prod` server, applying 4 pending DB migrations safely.

**Architecture:** Backup-first deploy — pg_dump before any migration, then git pull → setup.sh → deploy.sh on the server. Images are built locally on the server (no registry). All 4 pending migrations run automatically via deploy.sh.

**Tech Stack:** Docker Compose, PostgreSQL 16, Alembic, bash

---

### Task 1: Pre-deploy check — fractional amounts

**Files:**
- No files changed — SSH command only

- [ ] **Step 1: Connect to prod server**

```bash
ssh budget-prod
```

- [ ] **Step 2: Query for fractional kopeck amounts**

```bash
docker exec familybudget-postgres psql -U familybudget -d familybudget \
  -c "SELECT COUNT(*) FROM t_f_budget_fact WHERE amount != FLOOR(amount);"
```

Expected output:
```
 count
-------
     0
(1 row)
```

- [ ] **Step 3: Evaluate result**

If count = 0 → proceed to Task 2.

If count > 0 → **STOP. Do not proceed.** Report to user — fractional kopeck amounts exist, migration `ebf328b51e19` will round them. User must decide before continuing. Use Variant C (see spec) only after user approval.

---

### Task 2: Database backup

**Files:**
- No files changed — backup written to `/opt/budget/backups/` on server

- [ ] **Step 1: Create backup**

```bash
# Still on budget-prod
cd /opt/budget
BACKUP_FILE="backups/pre-0.6.165-$(date +%Y%m%d-%H%M%S).sql"
docker exec familybudget-postgres pg_dump -U familybudget familybudget > "$BACKUP_FILE"
```

- [ ] **Step 2: Verify backup is non-empty**

```bash
ls -lh "$BACKUP_FILE"
```

Expected: file size > 0 (typically several MB). If size = 0 — **STOP, investigate pg_dump failure before proceeding.**

- [ ] **Step 3: Spot-check backup content**

```bash
head -5 "$BACKUP_FILE"
```

Expected: starts with `--` PostgreSQL dump header lines, e.g.:
```
-- PostgreSQL database dump
--
-- Dumped from database version 16.x
```

---

### Task 3: Pull latest code and sync to deployment directory

**Files:**
- Modified on server: `~/familyBudget/` (git pull)
- Synced to: `/opt/budget/` (via setup.sh)

- [ ] **Step 1: Pull latest prod branch**

```bash
cd ~/familyBudget
git pull origin prod
```

Expected: `82c86122` becomes HEAD (or already at it). Confirm:
```bash
git log --oneline -1
```
Expected: `82c86122 fix(dashboard): resolve merge conflicts, restore planHints, fix periodButtons import`

- [ ] **Step 2: Verify VERSION**

```bash
cat VERSION
```

Expected: `0.6.165`

- [ ] **Step 3: Sync to deployment directory**

```bash
./setup.sh
```

Expected: outputs sync progress, no errors. If setup.sh fails — **STOP. Do not run deploy.sh.** `/opt/budget` may be in a partial state.

- [ ] **Step 4: Verify VERSION synced**

```bash
cat /opt/budget/VERSION
```

Expected: `0.6.165`

---

### Task 4: Deploy

**Files:**
- No source files changed — Docker images rebuilt on server from synced code

- [ ] **Step 1: Run deploy**

```bash
cd /opt/budget
./deploy.sh --profile full
```

This will:
1. Build new Docker images tagged `0.6.165`
2. Stop old containers (`familybudget-*:7.0.4`)
3. Start new containers (`familybudget-*:0.6.165`)
4. Run Alembic migrations (4 pending: `akhmi26ypiar`, `b3d9f5e7c2a1`, `c4e9f1a2b3d0`, `ebf328b51e19`)

Expected: deploy completes without errors, outputs container status.

If deploy.sh fails **before** migrations start → safe to retry after fixing the issue.

If deploy.sh fails **during/after** migration → **STOP. Do not retry.** Report to user. Restore from backup (Task 2 dump file) if data is corrupted.

---

### Task 5: Verification

**Files:**
- No files changed — verification only

- [ ] **Step 1: Check all containers are healthy**

```bash
docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Image}}'
```

Expected (all 5 healthy):
```
NAMES                   STATUS              IMAGE
familybudget-nginx      Up X seconds (healthy)   nginx:alpine
familybudget-bot        Up X seconds (healthy)   familybudget-bot:0.6.165
familybudget-backend    Up X seconds (healthy)   familybudget-backend:0.6.165
familybudget-postgres   Up X seconds (healthy)   postgres:16-alpine
familybudget-redis      Up X seconds (healthy)   redis:7-alpine
```

- [ ] **Step 2: Verify deployed version**

```bash
cat /opt/budget/VERSION
```

Expected: `0.6.165`

- [ ] **Step 3: Check API health**

```bash
curl -s -o /dev/null -w "%{http_code}" https://fb.ikeniborn.ru/health
```

Expected: `200`

- [ ] **Step 4: Verify Alembic migration applied**

```bash
docker exec familybudget-postgres psql -U familybudget -d familybudget \
  -c "SELECT version_num FROM alembic_version;"
```

Expected:
```
 version_num
--------------
 ebf328b51e19
(1 row)
```

- [ ] **Step 5: Verify Telegram bot responds**

Send `/start` to the bot in Telegram.

Expected: bot replies (any response confirms it's alive).

- [ ] **Step 6: Exit server**

```bash
exit
```

All checks passed → deployment complete.
