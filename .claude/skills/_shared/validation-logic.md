# Shared Validation Logic

Reusable validation patterns for Family Budget project.

## Critical Validations

### 1. Async/Await Correctness

**Problem**: Missing `await` on `AsyncSession` methods causes RuntimeWarning and data loss.

**Validation Pattern**:

```python
# ✅ CORRECT - All async methods have await
await session.execute(query)
await session.commit()
await session.delete(obj)
await session.refresh(obj)

# ❌ WRONG - Missing await (RuntimeWarning!)
session.delete(obj)  # Coroutine created but NOT executed
await session.commit()  # Commits empty transaction - nothing deleted!
```

**Checklist**:
- [ ] All `AsyncSession` method calls have `await`
- [ ] No `RuntimeWarning: coroutine was never awaited` in logs
- [ ] Database changes actually applied (verify with SELECT)

**Consequences of Missing Await**:
- RuntimeWarning in logs
- Coroutines not executed
- `commit()` commits empty transaction
- Data remains unchanged despite success logs
- Very hard to debug

---

### 2. History Table Field Completeness

**Problem**: Pasting only some fields into History table causes IntegrityError on NOT NULL columns.

**Validation Pattern**:

```python
# ✅ CORRECT - ALL fields copied
fact_history = BudgetFactHistory(
    fact_id=fact.id,
    user_id=fact.user_id,
    article_id=fact.article_id,
    financial_center_id=fact.financial_center_id,  # nullable, but copy!
    cost_center_id=fact.cost_center_id,            # nullable, but copy!
    amount=fact.amount,
    fact_date=fact.fact_date,
    description=fact.description,
    record_type=fact.record_type,  # CRITICAL - NOT NULL in history!
    transfer_id=fact.transfer_id,
    valid_from=datetime.utcnow(),
    is_current=True,
    change_type="CREATE"
)

# ❌ WRONG - Missing record_type
fact_history = BudgetFactHistory(
    fact_id=fact.id,
    # ... other fields ...
    # record_type NOT copied → IntegrityError!
)
```

**Checklist**:
- [ ] History table has ALL fields from main table
- [ ] NO NULL in NOT NULL columns
- [ ] `change_type` set (CREATE/UPDATE/DELETE)
- [ ] `valid_from`, `is_current` set correctly

**Common Mistakes**:
- Forgetting `record_type` field (NOT NULL)
- Forgetting nullable FK fields (should copy `NULL` too)
- Forgetting audit fields (created_at, updated_at)

---

### 3. Shared Budget Model Consistency

**Problem**: Filtering fact tables by `user_id` breaks Shared Family Budget transparency.

**Validation Pattern**:

```python
# ✅ CORRECT - Fact tables: NO user_id filter
stmt = select(BudgetFact)  # All users see all facts
facts = await session.exec(stmt).all()

# ✅ CORRECT - Dimension tables: NO user_id filter for READ
stmt = select(Article).where(Article.is_current == True)
articles = await session.exec(stmt).all()

# ✅ CORRECT - Dimension CREATE: Admin-only
@router.post("/articles")
async def create_article(data: ArticleCreate, current_user: CurrentUser):
    if not current_user.is_admin:
        raise HTTPException(403, "Only admins can create articles")
    # ...

# ❌ WRONG - User isolation in fact table!
stmt = select(BudgetFact).where(
    BudgetFact.user_id == current_user.id  # WRONG! Breaks Shared Budget
)
```

**Checklist**:
- [ ] Fact tables: NO `user_id` filtering
- [ ] Dimension tables: Admin-only CREATE/UPDATE/DELETE
- [ ] `user_id` used for audit trail only (who created/modified)
- [ ] All family members see all transactions

**Shared Budget Rules**:
- **Fact tables**: Shared (all see all)
- **Dimension tables**: Admin-managed, all read
- **user_id**: Audit only, NOT access control

---

### 4. Single-Worker SSE Constraint (Without Redis Pub/Sub)

**Problem**: Multi-worker setup breaks WebSocket/SSE because `BudgetConnectionManager` is in-memory (no Redis Pub/Sub implemented yet).

**Validation Pattern**:

```yaml
# ✅ CORRECT - docker-compose.yml
services:
  backend:
    command: uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 1

# ❌ WRONG - Multi-worker breaks WebSocket
services:
  backend:
    command: uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 4  # WRONG!
```

**Checklist**:
- [ ] `WORKERS=1` in docker-compose.yml
- [ ] WebSocket events broadcast to all clients
- [ ] SSE connection stable
- [ ] No events lost between clients

**Why WORKERS=1 is Critical**:
- `BudgetConnectionManager` is in-memory (NOT Redis Pub/Sub)
- Each worker has separate manager instance
- User A on worker 1 creates transaction → broadcast only to worker 1 clients
- User B on worker 2 doesn't receive event → stale UI

**Scaling Options** (future):
- Implement Redis Pub/Sub for event synchronization
- Share connection manager state between workers
- Use external message queue (RabbitMQ, Kafka)

---

### 5. SCD Type 2 Update Pattern

**Problem**: Direct UPDATE on dimension table breaks SCD Type 2 versioning.

**Validation Pattern**:

```python
# ✅ CORRECT - Use SCD2Service for dimension updates
from backend.app.services.scd2_service import SCD2Service

await SCD2Service.create_new_version(
    session=session,
    model_class=Article,
    current_id=article.id,
    new_data={"name": "New Name"}
)

# ❌ WRONG - Direct UPDATE breaks versioning
article.name = "New Name"
await session.commit()  # WRONG! In-place update, no history
```

**Checklist**:
- [ ] Dimension tables use `SCD2Service.create_new_version()`
- [ ] Old version closed (`is_current=False`, `valid_to=now`)
- [ ] New version created (`is_current=True`, `valid_from=now`)
- [ ] PK preserved (stable FK references)

**SCD Type 2 vs Type 1**:
- **Type 1**: In-place UPDATE (main tables: BudgetFact, User)
- **Type 2**: Create new version (dimensions: Article, FinancialCenter)

---

### 6. Migration Production Safety

**Problem**: Adding NOT NULL column without default breaks production database.

**Validation Pattern**:

```python
# ✅ CORRECT - Production-safe migration
def upgrade():
    # Step 1: Add column as nullable
    op.add_column('t_f_budget_fact', sa.Column('new_field', sa.String(), nullable=True))

    # Step 2: Backfill data
    op.execute("UPDATE t_f_budget_fact SET new_field = 'default' WHERE new_field IS NULL")

    # Step 3: Add NOT NULL constraint
    op.alter_column('t_f_budget_fact', 'new_field', nullable=False)

# ❌ WRONG - NOT NULL without default
def upgrade():
    op.add_column('t_f_budget_fact', sa.Column('new_field', sa.String(), nullable=False))
    # FAILS if table has existing rows!
```

**Checklist**:
- [ ] Alembic migration created
- [ ] `upgrade()` and `downgrade()` tested
- [ ] NOT NULL columns: nullable first, backfill, then constraint
- [ ] History table updated if main table changed

**Migration Best Practices**:
1. Add column as nullable
2. Backfill existing rows
3. Add NOT NULL constraint
4. Add indexes AFTER data loaded (faster)
5. Test downgrade() on copy of production data

---

### 7. TypeScript Hybrid Approach

**Problem**: Editing .js files or skipping type-check causes lost changes and missed type errors.

**Validation Pattern**:

```bash
# ✅ CORRECT - Development workflow
# 1. Edit .ts files (source)
vim frontend/web/static/js/offline/offlineManager.ts

# 2. Type-check before commit
npm run type-check

# 3. Build for production (Vite compiles .ts → .js)
npm run build

# ❌ WRONG - Editing .js files
vim frontend/web/static/js/offline/offlineManager.js
# Changes lost on next build! Vite overwrites .js files!

# ❌ WRONG - Skipping type-check
git commit -m "feat: new feature"
# Pre-commit hook BLOCKS commit if type errors found!
```

**Checklist**:
- [ ] Development: Edit .ts files (NOT .js files)
- [ ] Production: .js files generated by Vite (DO NOT edit manually)
- [ ] Type-check passes (`npm run type-check`)
- [ ] Pre-commit hook enabled (`.husky/pre-commit`)
- [ ] 0 errors in critical modules (offlineManager.ts, budgetWSClient.ts)

**TypeScript Hybrid Model**:
- **Source**: .ts files (type-checking, IDE support)
- **Output**: .js files (minified, browser-compatible)
- **Build**: Vite compiles .ts → .js automatically
- **Validation**: Pre-commit hook blocks commits with type errors

**Type Coverage (v7.1.0)**:
- 14 modules migrated (~16,000 lines)
- 473 non-critical errors (acceptable for gradual migration)
- 0 errors in critical modules (offlineManager.ts)

**Common TypeScript Mistakes**:
1. **Editing generated .js files** → Changes lost on rebuild
2. **Skipping `npm run type-check`** → Pre-commit hook fails
3. **Ignoring type errors** → Runtime bugs, poor IDE support
4. **Using `any` everywhere** → Defeats purpose of TypeScript

---

### 8. Vite Build System

**Problem**: Using old Rollup/bash commands causes "command not found" errors.

**Validation Pattern**:

```bash
# ✅ CORRECT - Vite commands (v7.0.0+)
npm run build              # Full build (CSS + JS + minify + gzip)
npm run dev                # Dev server with HMR
npm run watch              # Watch mode (CSS + JS)
npm run type-check         # TypeScript validation

# ❌ WRONG - Old commands (removed in v7.0.0!)
npm run bundle             # Command not found!
npm run bundle:dev         # Command not found!
npm run minify:js          # Command not found!
npm run minify:css         # Command not found!
```

**Checklist**:
- [ ] Use `npm run build` (NOT `npm run bundle`)
- [ ] Use `npm run dev` (NOT `npm run bundle:dev`)
- [ ] Vite config exists (`vite.config.ts`)
- [ ] Build time < 17 seconds (75% faster than v5.7.0)
- [ ] No references to deleted files (.terserrc.json, rollup.config.mjs)

**Build System Migration (v7.0.0)**:
- **Old**: Rollup + bash scripts (minify.sh, precompress-assets.sh)
- **New**: Vite + integrated plugins (compression, SW versioning)
- **Performance**: 15-20s → 13-17s (75% faster)
- **Commands**: Single `npm run build` replaces 5 separate scripts

**Removed Files (v7.0.0)**:
- `.terserrc.json` → Terser config now in `vite.config.ts`
- `rollup.config.mjs` → Replaced by `vite.config.ts`
- `scripts/lib/minify.sh` → Vite handles minification
- `scripts/lib/precompress-assets.sh` → `vite-plugin-compression`

**Vite Benefits**:
- Fast HMR (Hot Module Replacement) - instant updates
- Integrated TypeScript compilation
- Tree-shaking (dead code elimination)
- Smart code splitting
- Pre-bundling with esbuild (10-100x faster)

---

## Quick Reference

| Validation | Key Check | Common Mistake |
|-----------|-----------|----------------|
| Async/Await | All `AsyncSession` methods have `await` | Forgetting `await` on `.delete()` |
| History Tables | ALL fields copied to History | Missing `record_type` field |
| Shared Budget | NO `user_id` filter in fact queries | Filtering BudgetFact by user |
| SSE Workers | `WORKERS=1` in docker-compose.yml | Multi-worker setup |
| SCD Type 2 | Use `SCD2Service.create_new_version()` | Direct UPDATE on dimension |
| Migrations | Nullable first, backfill, constraint | NOT NULL without default |
| TypeScript | Edit .ts files, NOT .js files | Editing generated .js files |
| Vite Build | Use `npm run build`, NOT `bundle` | Using old Rollup commands |

---

## Usage in Skills

Skills should reference specific validations:

```markdown
**Validation Checklist**:
- [ ] Async/await correctness (see _shared/validation-logic.md#1)
- [ ] History table fields complete (see _shared/validation-logic.md#2)
- [ ] Shared Budget model (see _shared/validation-logic.md#3)
```
