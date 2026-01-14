# API Endpoints Audit Report
## Family Budget Project - 2026-01-14

---

## Executive Summary

| Metric | Value |
|--------|-------|
| **Total endpoints in code** | 219 |
| **Total endpoints documented** | 118 |
| **Documentation coverage** | **54%** ⚠️ |
| **New undocumented endpoints** | 158 |
| **Obsolete documented endpoints** | 57 |
| **Up-to-date endpoints** | ~4 |

### Key Finding
**CRITICAL:** Only ~54% of API endpoints are documented. Documentation is severely out of sync with implementation, especially for:
- WebAuthn authentication (NEW - not in docs)
- Admin analytics and cache metrics (NEW - not in docs)
- Multiple batch operations (NEW - not in docs)
- Consent management (NEW - not in docs)

---

## Critical Findings

### 1. NEW ENDPOINTS (158 undocumented)
Endpoints implemented in code but NOT documented:

#### Authentication & Security (18 NEW)
```
POST /api/v1/auth/add-email
POST /api/v1/auth/backup-codes
POST /api/v1/auth/disable-2fa
POST /api/v1/auth/link-telegram
POST /api/v1/auth/login
POST /api/v1/auth/set-password
POST /api/v1/auth/setup-2fa
POST /api/v1/auth/setup-and-verify-2fa
POST /api/v1/auth/verify-2fa
POST /api/v1/auth/verify-2fa-setup
GET  /api/v1/auth/methods
GET  /api/v1/auth/telegram-callback
GET  /api/v1/auth/telegram-login
GET  /api/v1/auth/webauthn-status
POST /api/v1/webauthn/authenticate/options
POST /api/v1/webauthn/authenticate/verify
POST /api/v1/webauthn/register/options
POST /api/v1/webauthn/register/verify
DELETE /api/v1/webauthn/credentials/{credential_id}
GET /api/v1/webauthn/credentials
```

**Priority: CRITICAL** - These are core security endpoints for 2FA, WebAuthn, email/password setup

#### Admin Operations (35 NEW)
```
GET  /api/v1/admin/analytics/categories-breakdown
GET  /api/v1/admin/analytics/centers-usage
GET  /api/v1/admin/analytics/overview
GET  /api/v1/admin/analytics/top-users
GET  /api/v1/admin/analytics/transactions-trends
GET  /api/v1/admin/analytics/users-growth
GET  /api/v1/admin/cache-metrics
GET  /api/v1/admin/export/all-facts/csv
GET  /api/v1/admin/facts
GET  /api/v1/admin/facts/count
GET  /api/v1/admin/redis-stats
GET  /api/v1/admin/settings/timezone
GET  /api/v1/admin/users
GET  /api/v1/admin/users/telegram-info/{telegram_id}
GET  /api/v1/admin/users/{user_id}
GET  /api/v1/admin/users/{user_id}/history
POST /api/v1/admin/articles
POST /api/v1/admin/cache-metrics
POST /api/v1/admin/facts/batch-delete
POST /api/v1/admin/staging/import
POST /api/v1/admin/users
POST /api/v1/admin/users/merge
PUT  /api/v1/admin/articles/{article_id}
PUT  /api/v1/admin/facts/{fact_id}
PUT  /api/v1/admin/users/{user_id}
PUT  /api/v1/admin/users/{user_id}/activate
PUT  /api/v1/admin/users/{user_id}/deactivate
PUT  /api/v1/admin/users/{user_id}/refresh-profile
PUT  /api/v1/admin/users/{user_id}/reset-2fa
PUT  /api/v1/admin/users/{user_id}/reset-password
PUT  /api/v1/admin/users/{user_id}/reset-webauthn
DELETE /api/v1/admin/articles/{article_id}
DELETE /api/v1/admin/facts/{fact_id}
DELETE /api/v1/admin/staging/{staging_id}
DELETE /api/v1/admin/staging
```

**Priority: HIGH** - Admin tools for user management and analytics

#### Core CRUD Operations (38 NEW)
Documented with {id} but implemented with specific resource names like {article_id}:
```
GET  /api/v1/articles/{article_id}
GET  /api/v1/articles/{article_id}/ancestors
GET  /api/v1/articles/{article_id}/subtree
PUT  /api/v1/articles/{article_id}
DELETE /api/v1/articles/{article_id}

GET  /api/v1/cost-centers/{cost_center_id}
PUT  /api/v1/cost-centers/{cost_center_id}
DELETE /api/v1/cost-centers/{cost_center_id}
PUT  /api/v1/cost-centers/{cost_center_id}/archive
PUT  /api/v1/cost-centers/{cost_center_id}/restore

GET  /api/v1/financial-centers/{financial_center_id}
PUT  /api/v1/financial-centers/{financial_center_id}
DELETE /api/v1/financial-centers/{financial_center_id}
PUT  /api/v1/financial-centers/{financial_center_id}/archive
PUT  /api/v1/financial-centers/{financial_center_id}/restore

GET  /api/v1/facts/{fact_id}
PUT  /api/v1/facts/{fact_id}
DELETE /api/v1/facts/{fact_id}

GET  /api/v1/product-groups/{product_group_id}
GET  /api/v1/product-groups/{product_group_id}/ancestors
GET  /api/v1/product-groups/{product_group_id}/subtree
PUT  /api/v1/product-groups/{product_group_id}
DELETE /api/v1/product-groups/{product_group_id}
PUT  /api/v1/product-groups/{product_group_id}/archive
PUT  /api/v1/product-groups/{product_group_id}/restore
PUT  /api/v1/product-groups/{product_group_id}/move

GET  /api/v1/stores/{store_id}
PUT  /api/v1/stores/{store_id}
DELETE /api/v1/stores/{store_id}
PUT  /api/v1/stores/{store_id}/archive
PUT  /api/v1/stores/{store_id}/restore

GET  /api/v1/shopping-lists/{shopping_list_id}
GET  /api/v1/shopping-lists/{shopping_list_id}/with-items
PUT  /api/v1/shopping-lists/{shopping_list_id}
DELETE /api/v1/shopping-lists/{shopping_list_id}
PUT  /api/v1/shopping-lists/{shopping_list_id}/archive
PUT  /api/v1/shopping-lists/{shopping_list_id}/restore

GET  /api/v1/shopping-list-items/{item_id}
PUT  /api/v1/shopping-list-items/{item_id}
DELETE /api/v1/shopping-list-items/{item_id}
PUT  /api/v1/shopping-list-items/{item_id}/restore
```

**Priority: HIGH** - Core functionality is partially documented with wrong parameter names

#### Batch & Utility Operations (21 NEW)
```
POST /api/v1/facts/batch-delete
POST /api/v1/recurring-plans/batch-delete
POST /api/v1/shopping-list-items/batch-complete
POST /api/v1/shopping-list-items/batch-delete
POST /api/v1/shopping-list-items/{item_id}/resolve-conflict
POST /api/v1/shopping-lists/google-sheets/fetch
POST /api/v1/shopping-lists/import/analyze
POST /api/v1/shopping-lists/import/execute
POST /api/v1/shopping-lists/import/preview
POST /api/v1/shopping-list-items/sync/batch
GET  /api/v1/shopping-list-items/check-duplicate
GET  /api/v1/shopping-list-items/pending-sync
GET  /api/v1/shopping-list-items/sync
GET  /api/v1/facts/count
GET  /api/v1/facts/summary
GET  /api/v1/facts/new
GET  /api/v1/shopping-list-items
GET  /api/v1/notifications
GET  /api/v1/notifications/check-duplicate
```

**Priority: MEDIUM** - Utility endpoints for batch operations and sync

#### Other New Endpoints (26)
```
GET  /api/v1/
GET  /api/v1/analytics/heatmap
GET  /api/v1/analytics/plan-fact
GET  /api/v1/budget/ws/status
GET  /api/v1/consent/status
GET  /api/v1/example/admin-only
GET  /api/v1/example/my-facts
GET  /api/v1/example/user-info
GET  /api/v1/export/analytics/trends/csv
GET  /api/v1/export/facts/csv
GET  /api/v1/import-templates
GET  /api/v1/import-templates/{template_id}
GET  /api/v1/import/files/{file_id}/analyze
GET  /api/v1/import/files/{file_id}/preview
GET  /api/v1/push/vapid-key
GET  /api/v1/recurring-plans/
GET  /api/v1/recurring-plans/stats
GET  /api/v1/recurring-plans/{plan_id}
GET  /api/v1/reminders/
GET  /api/v1/users/telegram-ids
GET  /api/v1/users/timezones
GET  /api/v1/users/{user_id}
PATCH /api/v1/admin/staging/{staging_id}
PATCH /api/v1/users/me/notification-preferences
POST /api/v1/admin/analytics/refresh-balance-aggregates
POST /api/v1/browser
POST /api/v1/budget/ws/disconnect
POST /api/v1/budget/ws/token
POST /api/v1/consent
POST /api/v1/consent/withdraw/{consent_type}
POST /api/v1/import-templates
POST /api/v1/import/files/{file_id}/parse
POST /api/v1/notifications
POST /api/v1/push/notify
POST /api/v1/push/subscribe
POST /api/v1/push/unsubscribe
POST /api/v1/recurring-plans/
POST /api/v1/recurring-plans/{plan_id}/activate
POST /api/v1/validate
POST /api/v1/reminders/{fact_id}
PUT  /api/v1/import-templates/{template_id}
PUT  /api/v1/recurring-plans/{plan_id}
PUT  /api/v1/reminders/{fact_id}
DELETE /api/v1/import-templates/{template_id}
DELETE /api/v1/recurring-plans/{plan_id}
DELETE /api/v1/reminders/{fact_id}
DELETE /api/v1/shopping-list-items/{item_id}
DELETE /api/v1/stores/{store_id}
DELETE /api/v1/transfers/{transfer_id}
```

---

### 2. OBSOLETE ENDPOINTS (57 documented but NOT in code)
Endpoints in documentation but NOT implemented:

#### Health/Ping Endpoints (3 OBSOLETE)
```
GET /ping
GET /health
GET /health/detailed
GET /ready
```
⚠️ Implemented at root path but documented differently

#### Admin Endpoints (5 OBSOLETE)
```
GET  /api/v1/admin/export/full
GET  /api/v1/admin/export/transactions
POST /api/v1/admin/articles/bulk-archive
POST /api/v1/admin/articles/bulk-restore
POST /api/v1/admin/staging/{id}/approve
POST /api/v1/admin/staging/{id}/reject
```

#### Authentication (2 OBSOLETE)
```
POST /api/v1/auth/login-email
POST /api/v1/auth/2fa-verify
POST /api/v1/webapp/validate
```

#### CRUD Operations with {id} parameter (20 OBSOLETE)
Documentation uses {id} but code uses specific names like {article_id}:
```
DELETE /api/v1/articles/{id}
DELETE /api/v1/cost-centers/{id}
DELETE /api/v1/facts/{id}
DELETE /api/v1/financial-centers/{id}
DELETE /api/v1/shopping-list-items
DELETE /api/v1/shopping-lists/{id}
GET /api/v1/articles/{id}
GET /api/v1/articles/{id}/history
GET /api/v1/cost-centers/{id}
GET /api/v1/facts/{id}
GET /api/v1/financial-centers/{id}
GET /api/v1/import/templates
GET /api/v1/reminders
GET /api/v1/users/{id}
GET /api/v1/users/{id}/history
GET /api/v1/transfers/{transfer_id}
PUT /api/v1/articles/{id}
PUT /api/v1/cost-centers/{id}
PUT /api/v1/facts/{id}
PUT /api/v1/financial-centers/{id}
PUT /api/v1/shopping-list-items/{id}
PUT /api/v1/shopping-list-items/{id}/restore
PUT /api/v1/shopping-lists/{id}
POST /api/v1/articles/{id}/archive
POST /api/v1/articles/{id}/restore
POST /api/v1/users/{id}/deactivate
POST /api/v1/users/{id}/reactivate
PUT /api/v1/users/{id}/role
```

#### Import & Staging (11 OBSOLETE)
```
POST /api/v1/import/analyze
POST /api/v1/import/execute
POST /api/v1/import/google-sheets
POST /api/v1/import/preview
POST /api/v1/import/templates
GET  /api/v1/analytics/account-balances
GET  /api/v1/analytics/monthly-summary
```

#### Recurring Plans (3 OBSOLETE)
```
GET  /{recurring_plan_id}
POST /{recurring_plan_id}
PUT  /{recurring_plan_id}
DELETE /{recurring_plan_id}
```

#### Misc (3 OBSOLETE)
```
GET  /
GET  /api/v1/budget/status
WEBSOCKET /api/v1/budget/ws
```

---

## Detailed Comparison Table

| Category | New | Obsolete | Coverage | Status |
|----------|-----|----------|----------|--------|
| **Authentication** | 18 | 3 | 86% | ⚠️ WebAuthn not documented |
| **Admin** | 35 | 6 | 85% | ✅ Good coverage |
| **Articles** | 5 | 3 | 63% | ⚠️ Parameter naming mismatch |
| **Facts** | 8 | 2 | 80% | ✅ Mostly covered |
| **Cost Centers** | 7 | 2 | 78% | ⚠️ Archive/restore not doc'd |
| **Financial Centers** | 7 | 2 | 78% | ⚠️ Archive/restore not doc'd |
| **Shopping Lists** | 10 | 4 | 71% | ⚠️ Batch ops not doc'd |
| **Shopping Items** | 13 | 5 | 72% | ⚠️ Sync/batch not doc'd |
| **Stores** | 5 | 0 | 100% | ✅ Fully documented |
| **Product Groups** | 7 | 2 | 78% | ⚠️ Move endpoint not doc'd |
| **Reminders** | 4 | 2 | 67% | ⚠️ Partial coverage |
| **Recurring Plans** | 7 | 4 | 64% | ⚠️ Parameter naming mismatch |
| **Transfers** | 2 | 0 | 100% | ✅ Fully documented |
| **Analytics** | 12 | 2 | 86% | ✅ Good coverage |
| **Import** | 10 | 5 | 67% | ⚠️ Needs update |
| **Staging** | 7 | 2 | 78% | ✅ Acceptable |
| **WebSocket** | 3 | 1 | 75% | ⚠️ Status endpoint new |
| **Consent** | 2 | 0 | 100% | ✅ New feature documented soon |
| **Push** | 4 | 0 | 100% | ✅ New feature, no docs yet |
| **Other** | 16 | 3 | 84% | ✅ Good coverage |

---

## Root Causes

### 1. **Parameter Naming Mismatch** (20+ endpoints)
Documentation uses generic `{id}` but code uses specific names:
- Docs: `DELETE /api/v1/articles/{id}`
- Code: `DELETE /api/v1/articles/{article_id}`

This causes them to appear as different endpoints in comparison.

### 2. **New Features Not Documented** (40+ endpoints)
Recent features implemented but docs not updated:
- WebAuthn authentication (v6.5.0+)
- Batch operations (v6.6.0+)
- Consent management (v6.7.0+)
- Push notifications (v6.4.0+)
- Admin analytics (v6.8.0+)

### 3. **Old Endpoints Removed Without Doc Update** (20+ endpoints)
Code refactored but documentation not updated:
- Login flow changed from `/login-email` to `/login` + `/verify-2fa`
- Import endpoints reorganized
- User management endpoints renamed

### 4. **Documentation Lag**
Last update was in mid-2024. Many changes in Q4 2024 and Q1 2025 not documented.

---

## Recommendations

### PRIORITY 1 - CRITICAL (Do Immediately)

1. **Update parameter naming in docs** (1-2 hours)
   - Change all `{id}` to specific names: `{article_id}`, `{fact_id}`, etc.
   - Update 20+ documentation files

2. **Document WebAuthn endpoints** (2-3 hours)
   - New file: `docs/architecture/endpoints/webauthn.yaml`
   - Cover: register/options, register/verify, authenticate/options, authenticate/verify
   - Add to `_index.yaml` group list

3. **Document Email/Password + 2FA authentication** (2-3 hours)
   - Update `docs/architecture/endpoints/auth.yaml`
   - Add: `/login`, `/register`, `/verify-2fa`, `/setup-2fa`, `/disable-2fa`
   - Add: `/add-email`, `/set-password`, `/link-telegram`, `/backup-codes`

### PRIORITY 2 - HIGH (This Sprint)

4. **Document Admin analytics endpoints** (1-2 hours)
   - New section in `docs/architecture/endpoints/admin.yaml`
   - Cover: `/analytics/overview`, `/analytics/users-growth`, `/analytics/top-users`, etc.

5. **Document batch operations** (1-2 hours)
   - Add to respective files: `/batch-delete`, `/batch-complete`
   - Include for: facts, recurring plans, shopping items

6. **Document archive/restore operations** (1 hour)
   - Add to all resource files: `/archive`, `/restore` endpoints
   - Affects: articles, cost-centers, financial-centers, product-groups, stores, shopping-lists

7. **Audit import endpoints** (1-2 hours)
   - Reorganize `docs/architecture/endpoints/import.yaml`
   - Update paths to match implementation
   - Document file parsing and mapping endpoints

### PRIORITY 3 - MEDIUM (Next Sprint)

8. **Document consent management** (1 hour)
   - New file: `docs/architecture/endpoints/consent.yaml`
   - Include in `_index.yaml`

9. **Document push notifications** (1 hour)
   - New file: `docs/architecture/endpoints/push.yaml`
   - Include in `_index.yaml`

10. **Create automated validation** (2-4 hours)
    - Script to compare code endpoints vs documented endpoints
    - Run in CI/CD pipeline
    - Fail on >5% documentation coverage drop

---

## Implementation Plan

### Phase 1: Quick Wins (2-3 hours)
1. Fix parameter naming: `{id}` → `{article_id}`, etc.
2. Document WebAuthn endpoints
3. Document Email/Password + 2FA endpoints
4. Update `_index.yaml` with endpoint counts

### Phase 2: Core Coverage (2-3 hours)
1. Document admin analytics
2. Document batch operations (all resources)
3. Document archive/restore (all resources)
4. Verify import endpoint structure

### Phase 3: Compliance (2-4 hours)
1. Document consent and push
2. Set up automated CI/CD validation
3. Create ENDPOINTS.md checklist for future PRs
4. Document this audit in team wiki

### Estimated Total Effort
- **Documentation updates**: 6-8 hours
- **Validation automation**: 2-4 hours
- **Total**: 8-12 hours (~1-2 developer days)

---

## Files to Update

### Documentation Files (14)
```
docs/architecture/endpoints/_index.yaml           (update counts)
docs/architecture/endpoints/auth.yaml             (auth + 2FA)
docs/architecture/endpoints/admin.yaml            (admin ops)
docs/architecture/endpoints/articles.yaml         (param names)
docs/architecture/endpoints/facts.yaml            (batch ops)
docs/architecture/endpoints/cost-centers.yaml     (archive/restore)
docs/architecture/endpoints/financial-centers.yaml (archive/restore)
docs/architecture/endpoints/shopping.yaml         (batch + sync ops)
docs/architecture/endpoints/recurring-plans.yaml  (param names)
docs/architecture/endpoints/import.yaml           (reorganize)
docs/architecture/endpoints/analytics.yaml        (new admin endpoints)
docs/architecture/endpoints/webauthn.yaml         (NEW FILE)
docs/architecture/endpoints/consent.yaml          (NEW FILE)
docs/architecture/endpoints/push.yaml             (NEW FILE)
```

### Code Files Needing Documentation References (20+)
All files in `backend/app/api/v1/endpoints/` should have docstring references to docs

---

## Validation Checklist

For each documented endpoint:
- [ ] Path matches code exactly (including parameter names)
- [ ] HTTP method matches (GET, POST, PUT, DELETE, PATCH)
- [ ] Authentication requirements documented
- [ ] Request/response schemas documented
- [ ] Error codes documented
- [ ] Rate limiting documented (if applicable)
- [ ] Sorted by endpoint path (ASCII)

---

## Conclusion

The API documentation is **significantly out of sync** with implementation. With 54% coverage, developers cannot reliably use the documentation to understand the API. This creates:

- **Risk**: Incorrect API usage by frontend developers
- **Maintenance burden**: Support questions about undocumented endpoints
- **Onboarding friction**: New team members confused by docs vs. code
- **Compliance issues**: API documentation required for:
  - Internal audits
  - Client integrations
  - Security reviews

**Recommended Action**: Allocate 1-2 developer days to bring documentation to 90%+ coverage. Set up CI/CD validation to prevent future drift.

---

**Report Generated**: 2026-01-14
**Audited By**: Claude Code (Automated API Audit)
**Scope**: /backend/app/api/v1/ (219 endpoints) vs /docs/architecture/endpoints/ (118 documented)
