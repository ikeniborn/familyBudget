---
review:
  spec_hash: "d3b97977b5bce171"
  last_run: "2026-05-24"
  phases:
    structure:   { status: passed }
    coverage:    { status: passed }
    clarity:     { status: passed }
    consistency: { status: passed }
  findings:
    - id: F-001
      phase: clarity
      severity: WARNING
      section: "Phase 1 — Pre-deploy Check"
      section_hash: "c5e253b4f90240a8"
      text: "'Variant C (manual migration step)' referenced but not defined in spec body — reader without brainstorm context cannot act on this"
      verdict: fixed
      verdict_at: "2026-05-24"
---

# Design: Deploy v0.6.165 to Production Server

**Date:** 2026-05-24  
**Status:** approved  
**Intent:** docs/superpowers/intents/2026-05-24-update-prod-server-intent.md

## Context

Production server (`budget-prod`, `https://fb.ikeniborn.ru/`) runs `familybudget-backend:7.0.4` — same application, older development branch. DB migration chain is compatible: prod is at `4c87e46b1cd8` (2026-01-18), local repo has 4 pending migrations up to `ebf328b51e19`.

**Pending migrations:**
1. `akhmi26ypiar` — add position to shopping list items (2026-01-22)
2. `b3d9f5e7c2a1` — add temp_id to shopping list (2026-02-16)
3. `c4e9f1a2b3d0` — add unique constraint article/parent/name/type (2026-04-08)
4. `ebf328b51e19` — convert amount Decimal(15,2) → BigInteger rubles (2026-04-26) ⚠️ irreversible without backup

**Approach:** Backup-first deploy (Variant B).

## Architecture

Prod server deploy flow (no CI/CD registry — images built locally on server):
```
GitHub prod branch → ~/familyBudget (git) → /opt/budget (setup.sh) → Docker images (deploy.sh) → running containers
```

## Phase 1 — Pre-deploy Check

Check for fractional kopeck amounts (would be rounded/lost by migration `ebf328b51e19`):

```sql
SELECT COUNT(*) FROM t_f_budget_fact WHERE amount != FLOOR(amount);
```

- Result = 0 → proceed
- Result > 0 → **stop, notify user, use Variant C** (see below)

**Variant C (manual migration — only if fractional amounts found):**
```bash
./deploy.sh --profile full --no-migrate   # deploy without auto-migrations
# Then manually inspect and migrate:
docker exec familybudget-backend alembic upgrade head
```
User must decide how to handle fractional kopeck data before proceeding.

## Phase 2 — Database Backup

```bash
ssh budget-prod
cd /opt/budget
docker exec familybudget-postgres pg_dump -U familybudget familybudget \
  > /opt/budget/backups/pre-0.6.165-$(date +%Y%m%d-%H%M%S).sql
```

Verify dump size > 0 before proceeding.

## Phase 3 — Deploy

```bash
cd ~/familyBudget
git pull origin prod        # pulls to 82c86122 (v0.6.165)
./setup.sh                  # syncs ~/familyBudget → /opt/budget
cd /opt/budget
./deploy.sh --profile full  # builds images, restarts containers, runs migrations
```

## Phase 4 — Verification

| Check | Expected |
|-------|----------|
| `docker ps` | All 5 containers healthy (postgres, redis, backend, bot, nginx) |
| `cat /opt/budget/VERSION` | `0.6.165` |
| `curl https://fb.ikeniborn.ru/health` | HTTP 200 |
| Telegram bot `/start` | Bot responds |
| Alembic version | `ebf328b51e19` |

## Stop Rules

| Condition | Action |
|-----------|--------|
| pg_dump size = 0 | Stop. Investigate. Do not proceed. |
| Fractional amounts found | Stop. Switch to Variant C. Notify user. |
| `setup.sh` fails | Stop. `/opt/budget` may be partial — do not deploy. |
| `deploy.sh` fails before migrations | Safe to retry. |
| Migration fails | Restore from dump. Notify user. |
| Any data deletion risk | Stop. Ask user. |

## Constraints

- No Docker volume deletion
- Downtime acceptable
- Deploy only via `deploy.sh`
- Backup must exist before any migration runs
