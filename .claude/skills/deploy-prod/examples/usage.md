# Deploy-Prod Usage Examples

## Example 1: Standard Production Deployment

```
User: "Задеплой на production"

Claude:
[Вызывает @skill:deploy-prod]

⚠️ CRITICAL: ===========================================
⚠️ CRITICAL: PRODUCTION DEPLOYMENT WARNING
⚠️ CRITICAL: ===========================================

⚠️ CRITICAL: You are about to deploy to PRODUCTION server: budget-prod
⚠️ CRITICAL: This will affect LIVE USERS and REAL DATA

⚠️ Requirements:
  - Version tested >=7 days on budget-test
  - All tests passing
  - Backup created
  - Manual rollback plan prepared

Type 'PRODUCTION' to continue: PRODUCTION

[SUCCESS] Production deployment confirmed

[INFO] Checking test duration on budget-test...
[INFO] Version 10.0.48 deployed to budget-test: 2026-01-18 10:30:00
[INFO] Days since test deployment: 8
[SUCCESS] Test duration check passed (8 days >= 7 days)

[INFO] Executing deployment workflow...
[SUCCESS] Deployment to budget-prod completed successfully

[INFO] Post-deployment notifications sent:
  - Telegram bot: @familybudget_team
  - Monitoring: alerts enabled
```

## Example 2: Deployment Blocked (Insufficient Testing)

```
User: "Deploy to production"

Claude:
[Вызывает @skill:deploy-prod]

⚠️ CRITICAL: PRODUCTION DEPLOYMENT WARNING
Type 'PRODUCTION' to continue: PRODUCTION

[INFO] Checking test duration on budget-test...
[INFO] Version 10.0.49 deployed to budget-test: 2026-01-24 14:00:00
[INFO] Days since test deployment: 2
[ERROR] Minimum test duration not met
[ERROR] Required: 7 days, Actual: 2 days
[ERROR] PRODUCTION DEPLOYMENT BLOCKED

Recommendation: Continue testing on budget-test for 5 more days.
```

## Example 3: Dry-Run

```
User: "Покажи план деплоя на production"

Claude:
[Вызывает @skill:deploy-prod с --dry-run]

[INFO] Production deployment plan (dry-run):

1. Production warning (user confirmation required)
2. Test duration check (>=7 days on budget-test)
3. Pre-flight checks (7 critical + 3 production-specific)
4. Git pull on budget-prod
5. Deploy execution (registry-first)
6. Verification (logs + containers + health)
7. Notifications (Telegram + monitoring)

SAFETY: Manual rollback only, no automatic rollback
RETRY: Max 1 attempt (vs 3 for test)

No actions performed (dry-run mode).
```
