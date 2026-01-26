# Deploy-Prod Skill v1.0.0

---
name: deploy-prod
description: Автоматизированный деплой на production сервер с обязательной валидацией и manual rollback
version: 1.0.0
author: Family Budget Team
tags: [deployment, production, critical, manual-rollback, registry-first]
dependencies: [monitoring, testing, deploy-test]
user-invocable: true
---

## ⚠️ PRODUCTION DEPLOYMENT SKILL

**CRITICAL SAFETY REQUIREMENTS:**
- Version must be tested >=7 days on budget-test
- Manual rollback only (no automatic rollback)
- Explicit user confirmation required
- Notifications mandatory (Telegram bot)

## Когда использовать

**User phrases:**
- "Задеплой на production"
- "Deploy to prod"
- "Обнови production сервер"

## Production-Specific Differences vs Deploy-Test

| Feature | Deploy-Test | Deploy-Prod |
|---------|-------------|-------------|
| **Server** | budget-test | budget-prod |
| **User Confirmation** | Optional | ⚠️ MANDATORY (type 'PRODUCTION') |
| **Test Duration** | None | >=7 days on budget-test |
| **Rollback** | Auto with --rollback-on-fail | Manual only |
| **Retry Logic** | Max 3 attempts | Max 1 attempt |
| **Auto-fix** | Available | DISABLED |
| **Notifications** | Optional | Mandatory |

## Workflow

1. **Production Warning** - Критическое предупреждение + user confirmation
2. **Test Duration Check** - Проверка что version тестировался >=7 дней на budget-test
3. **Pre-flight Checks** - Все 7 critical checks + 3 production-specific
4. **Git Pull** - Update code on server
5. **Deploy Execution** - Registry-First (pull images + docker compose up)
6. **Verification** - Logs + containers + health checks
7. **Notifications** - Telegram bot + monitoring alerts

## Usage

```bash
# Production deployment (with confirmations)
./templates/deploy-prod.sh

# Dry-run (show plan)
./templates/deploy-prod.sh --dry-run

# Verbose output
./templates/deploy-prod.sh --verbose
```

## Safety Checklist

- [ ] Version tested >=7 days on budget-test
- [ ] All tests passing (GitHub Actions green)
- [ ] No critical issues in budget-test
- [ ] Backup created (automatic)
- [ ] Manual rollback plan prepared
- [ ] Team notified about deployment
- [ ] Monitoring alerts configured

## Rollback (Manual Only)

```bash
# 1. SSH to production
ssh budget-prod

# 2. Check deployment history
tail /opt/budget/logs/deployment-history.log

# 3. Determine previous VERSION

# 4. Git checkout previous commit
cd ~/familyBudget
git checkout <previous-commit>

# 5. Deploy previous version
sudo bash deploy.sh --use-registry --sync-mode skip --cleanup-mode smart
```

## FAQ

### Q: Почему нельзя использовать --rollback-on-fail?

A: Production требует manual intervention для rollback:
- Необходим анализ причины ошибки
- Требуется оценка impact на пользователей
- Нужно уведомить команду

### Q: Что если version не тестировался 7 дней?

A: Deployment будет заблокирован:
```
ERROR: Minimum test duration not met
Required: 7 days, Actual: 3 days
PRODUCTION DEPLOYMENT BLOCKED
```

### Q: Как проверить что version готов к production?

A: Проверьте на budget-test:
```bash
ssh budget-test "grep 'tag=10.0.48' /opt/budget/logs/deployment-history.log"
```

## See Also

- `@skill:deploy-test` - Test server deployment (recommended first)
- `@skill:monitoring` - Post-deployment monitoring
- `docs/architecture/deployment-troubleshooting.md` - Troubleshooting guide
