# Fix-Documents Integration Mapping
**Generated:** 2026-01-21
**Phase:** PHASE 2 - Fix-Documents Review

## Summary

Analyzed 6 fix-documents (7 files total including duplicate) to determine integration strategy.

| Document | Size | Version | Date | Status | Target Destination |
|----------|------|---------|------|--------|-------------------|
| env-syntax-fix.md | 3.1K | 6.5.1 | 2025-12-30 | INTEGRATED | guides/deployment-troubleshooting.md |
| setup-admin-fix-v1.0.md | 7.9K | 1.0 | 2025-12-27 | VALUABLE | admin-setup.md |
| cache-busting-fix.md | 16K | 6.5.2-6.5.3 | 2025-12-30 | VALUABLE | ci-cd-build-deploy.md (merge target) |
| modal-hints-fix.md | 22K | 6.7.0 | 2025-12-30 | VALUABLE | NEW: frontend/modals.yaml |
| recurring-plans-fixes.md | 17K | - | Dec 2025 | VALUABLE | recurring-plans.md + websocket.md |
| category-selection-fix.md | 29K | 6.6.1 | 2025-12-28 | VALUABLE | NEW: frontend/forms-patterns.yaml |
| frontend/category-selection-fix.md | 23K | 6.6.1 | 2025-12-28 | DUPLICATE | RESOLVE: merge or delete |

## Detailed Analysis

### 1. env-syntax-fix.md ✅ INTEGRATED

**Type:** Bugfix
**Problem:** Unquoted environment variable with whitespace caused "command not found" error
**Fix Applied:** `.env.example` line 193 - added quotes around `WEBAUTHN_RP_NAME="Family Budget"`
**Verification:** ✅ Fix confirmed in `.env.example`

**Valuable Information to Extract:**
- **Validation Rules** (lines 61-88):
  - Always quote multi-word values in .env files
  - Shell interpretation behavior explanation
  - Common error patterns

- **Prevention Guidelines** (lines 123-138):
  - `bash -n .env.example` syntax check
  - `grep -nE '^[A-Z_]+=.+\s+\w'` pattern for finding unquoted values

**Integration Target:** `guides/deployment-troubleshooting.md`

**Section to Add:** "Environment Variable Syntax Errors"

**Content to Integrate:**
```markdown
### Environment Variable Syntax Errors

**Problem:** Unquoted multi-word values cause "command not found" errors

**Example:**
```bash
# ❌ INCORRECT
WEBAUTHN_RP_NAME=Family Budget
# Bash interprets: WEBAUTHN_RP_NAME=Family + Budget (command)

# ✅ CORRECT
WEBAUTHN_RP_NAME="Family Budget"
```

**Prevention:**
```bash
# Syntax validation
bash -n .env.example

# Find unquoted multi-word values
grep -nE '^[A-Z_]+=.+\s+\w' .env.example
```

**Reference:** See [Bash Quoting Rules](https://www.gnu.org/software/bash/manual/html_node/Quoting.html)
```

**Action:** After integration → DELETE `env-syntax-fix.md`

---

### 2. setup-admin-fix-v1.0.md ⭐ VALUABLE

**Type:** Critical bugfix
**Problems:**
1. **CRITICAL:** sed special character bug - passwords with `&` corrupted .env
2. Email validation didn't clear password on error
3. No empty password validation
4. Missing debug logging

**Fixes:**
1. Changed sed delimiter `/` → `|` to avoid special char conflicts
2. Added password reset on email validation failure
3. Added empty password validation
4. Added debug logging for .env write operations

**Valuable Information to Extract:**

**A. Validation Patterns** (lines 44-106):
- sed delimiter best practices
- Input validation error handling
- Credential consistency checks

**B. Testing Procedures** (lines 134-262):
- Test 1: Auto-generated password flow
- Test 2: Special characters in password
- Test 3: Invalid email validation
- Test 4: Skip admin config

**Integration Target:** `admin-setup.md`

**Section to Add:** "Troubleshooting Admin Setup"

**Content to Integrate:**
```markdown
## Troubleshooting Admin Setup

### Special Characters in Password

**Issue:** Passwords containing `&` may corrupt `.env` file if sed uses wrong delimiter

**Solution:** `setup.sh` uses `|` delimiter instead of `/`:
```bash
# ✅ CORRECT (v1.0+)
sed -i "s|^ADMIN_PASSWORD=.*|ADMIN_PASSWORD=${password}|" .env

# ❌ OLD (broken with & in password)
sed -i "s/^ADMIN_PASSWORD=.*/ADMIN_PASSWORD=${password}/" .env
```

### Validation Best Practices

When adding credential validation:
1. Clear ALL related fields on validation error (email + password)
2. Validate for empty values after user input
3. Add debug logging (hide sensitive values)

**Example:**
```bash
if ! validate_email "${email}"; then
    error "Invalid email format"
    email=""
    password=""  # ✅ Clear both fields
    warning "Admin configuration cancelled due to validation error"
fi
```

### Testing Admin Credentials

**Test special characters:**
```bash
# Test password with special chars
sudo ./setup.sh
# Password: Test&Pass!123@

# Verify .env
cat /opt/budget/.env | grep ADMIN_PASSWORD
# Expected: ADMIN_PASSWORD=Test&Pass!123@
# NOT: ADMIN_PASSWORD=TestADMIN_PASSWORD=old123 (corrupted)
```

**Database verification:**
```bash
docker compose exec postgres psql -U familybudget -d familybudget -c \
  "SELECT email, is_admin, is_active FROM t_d_user WHERE email='admin@example.com';"
```
```

**Action:** After integration → DELETE `setup-admin-fix-v1.0.md`

---

### 3. cache-busting-fix.md ⭐ VALUABLE

**Type:** Enhancement + Bugfix
**Problems:**
1. Old script only processed `sw.js`, ignored HTML templates
2. Cache busting ran BEFORE minification (wrong order)

**Fixes:**
1. New script `update-cache-busting.sh` processes sw.min.js + all HTML templates
2. Moved cache busting AFTER `npm run build` in deploy.sh
3. Re-compresses `sw.min.js.gz` after timestamp update

**Valuable Information to Extract:**

**A. Build Pipeline Order** (CRITICAL):
```
1. npm run build (minification)
2. update-cache-busting.sh (timestamp update)
3. Re-compress .gz files
```

**B. Cache Busting Patterns**:
- `?v=PLACEHOLDER` → `?v=v20251230_1830`
- Regex: `s/\([?&]v\?e\?r\?s\?i\?o\?n\?=\)PLACEHOLDER/\1${NEW_VERSION}/g`

**Integration Target:** `ci-cd-build-deploy.md` (will be merged with ci-cd-pipeline.md in PHASE 3)

**Section to Update:** "Cache Busting Process"

**Content to Integrate:**
```markdown
## Cache Busting Process

**Execution Order** (CRITICAL):
1. ✅ `npm run build` - Minify sw.js → sw.min.js
2. ✅ `scripts/update-cache-busting.sh` - Update timestamps
3. ✅ Re-compress sw.min.js.gz

**Why Order Matters:**
- ❌ OLD: Cache bust sw.js → minify → sw.min.js still has PLACEHOLDER
- ✅ NEW: Minify sw.js → cache bust sw.min.js → correct timestamp

**Script:** `scripts/update-cache-busting.sh`

**Patterns Replaced:**
```html
<!-- Before -->
<script src="/static/js/file.js?v=PLACEHOLDER"></script>

<!-- After -->
<script src="/static/js/file.js?v=v20260121_1830"></script>
```

**Validation:**
```bash
# Zero PLACEHOLDER tokens allowed
grep -r "PLACEHOLDER" frontend/web/templates/
# Expected: (no matches)
```

**Files Updated:**
- `sw.min.js` - Service Worker (minified version)
- `sw.min.js.gz` - Compressed version (re-compressed)
- All HTML templates in `frontend/web/templates/`
```

**Action:** After integration → DELETE `cache-busting-fix.md`

---

### 4. modal-hints-fix.md ⭐ VALUABLE

**Type:** Bug fix + Feature
**Problems:**
1. Category auto-filled on first modal open (phantom selection)
2. Plan Hints loaded without checking both FC + article
3. Plan hints stub function not implemented

**Fixes:**
1. Added `clearSelection()` call in `openAddPlanModal()`
2. Implemented `loadPlanHints()` with dual-field validation
3. Parity with plan.html implementation

**Valuable Information to Extract:**

**A. Modal Lifecycle Pattern:**
```javascript
function openAddPlanModal() {
    // CRITICAL: Clear selection for create modals
    if (planCategoryTreeSelect) {
        planCategoryTreeSelect.clearSelection();
        planCategoryTreeSelect.options.financialCenterId = null;
    }
    // ... rest of modal setup
}
```

**B. Hints Loading Pattern:**
```javascript
async function loadPlanHints() {
    const fcId = planFinancialCenterSelect.value;
    const articleId = planCategoryTreeSelect.element.value;

    // CRITICAL: Require BOTH fields
    if (!fcId || !articleId) {
        console.log('[HINTS] Skipping - need FC + article');
        return;
    }

    // Load hints...
}
```

**Integration Target:** NEW FILE: `frontend/modals.yaml`

**Structure:**
```yaml
meta:
  version: "1.0.0"
  description: "Modal window patterns and best practices"

patterns:
  create_modal_lifecycle:
    description: "Lifecycle pattern for create modals"
    steps:
      - "Clear previous selection state"
      - "Reset filter options (financialCenterId = null)"
      - "Initialize form with empty values"

  edit_modal_lifecycle:
    description: "Lifecycle pattern for edit modals"
    steps:
      - "Load existing data from backend"
      - "Populate form fields"
      - "Preserve selection state"

  hints_loading:
    description: "Pattern for loading contextual hints"
    validation:
      - "Require ALL mandatory fields before loading"
      - "Show loading indicator during fetch"
      - "Handle empty results gracefully"

examples:
  create_plan_modal:
    file: "frontend/web/templates/index.html"
    function: "openAddPlanModal()"
    critical_calls:
      - "planCategoryTreeSelect.clearSelection()"
      - "planCategoryTreeSelect.options.financialCenterId = null"

  load_plan_hints:
    file: "frontend/web/templates/index.html"
    function: "loadPlanHints()"
    validation_check: "if (!fcId || !articleId) return;"
```

**Action:** After integration → DELETE `modal-hints-fix.md`

---

### 5. recurring-plans-fixes.md ⭐ VALUABLE

**Type:** Bug fixes
**Problems:**
1. Real-time updates not working on `/plan` page (WebSocket)
2. Redis Pub/Sub subscriber blocked (used `listen()` inside `async with`)
3. Filter `has_recurring_plan` incorrectly enabled

**Fixes:**
1. Added WebSocket handlers in `plan.html` for `plan_*` and `recurring_plan_*` events
2. Changed Redis subscriber to use `get_message()` in loop instead of `listen()`
3. Confirmed filter defaults to OFF

**Valuable Information to Extract:**

**A. WebSocket Handler Pattern** (lines 14-47):
```javascript
// Plan created
window.budgetWSClient.on('plan_created', async (data) => {
    if (shouldReloadOnPlanCreated(data)) {
        await loadFacts();
        showToast('success', '✅ Добавлена новая плановая запись');
    }
});

// Recurring plan created
window.budgetWSClient.on('recurring_plan_created', async (data) => {
    await loadFacts();
    showToast('success', `✅ Регламентный платеж создан (${data.facts_generated} записей)`);
});

// Helper function for filter matching
function shouldReloadOnPlanCreated(planData) {
    // Check if plan matches current filters
    return matchesCurrentFilters(planData);
}
```

**B. Redis Pub/Sub Pattern** (lines 48-98):
```python
# ❌ WRONG: listen() blocks inside async with
async with get_redis() as redis:
    pubsub = redis.pubsub()
    await pubsub.subscribe(channel)
    async for message in pubsub.listen():  # Blocks forever
        # Connection closes before receiving messages
        ...

# ✅ CORRECT: get_message() in loop
async with get_redis() as redis:
    pubsub = redis.pubsub()
    await pubsub.subscribe(channel)

    while True:
        message = await pubsub.get_message(timeout=1.0)
        if message is None:
            await asyncio.sleep(0.01)
            continue

        if message["type"] == "message":
            event = json.loads(message["data"])
            await handle_event(event)
```

**Integration Targets:**
1. `recurring-plans.md` - Add WebSocket events section
2. `websocket.md` - Add Redis Pub/Sub pattern

**Content to Integrate:**

**In `recurring-plans.md`:**
```markdown
## Real-time Updates

### WebSocket Events

Recurring plans emit following events for real-time synchronization:

| Event | Emitted When | Payload |
|-------|--------------|---------|
| `recurring_plan_created` | New recurring plan created | `{plan_id, facts_generated}` |
| `plan_created` | Individual plan instance generated | `{plan_id, date, amount}` |
| `plan_updated` | Plan instance updated | `{plan_id}` |
| `plan_deleted` | Plan instance deleted | `{plan_id}` |

### Frontend Handler Pattern

**File:** `frontend/web/templates/plan.html`

```javascript
window.budgetWSClient.on('recurring_plan_created', async (data) => {
    await loadFacts(); // Reload table
    showToast('success', `Создано ${data.facts_generated} записей`);
});
```

**Filter Matching:**
After receiving `plan_created` event, check if plan matches current filters before reloading:
```javascript
function shouldReloadOnPlanCreated(planData) {
    const currentFC = getCurrentFinancialCenter();
    const currentArticle = getCurrentArticle();

    return (!currentFC || planData.fc_id === currentFC) &&
           (!currentArticle || planData.article_id === currentArticle);
}
```
```

**In `websocket.md`:**
```markdown
## Redis Pub/Sub Subscriber Pattern

### Problem: `listen()` blocking

**DON'T:**
```python
async with get_redis() as redis:
    pubsub = redis.pubsub()
    await pubsub.subscribe("channel")
    async for message in pubsub.listen():  # ❌ Blocks forever
        # Connection auto-closes before receiving messages
        ...
```

**DO:**
```python
async with get_redis() as redis:
    pubsub = redis.pubsub()
    await pubsub.subscribe("channel")

    while True:
        message = await pubsub.get_message(ignore_subscribe_messages=False, timeout=1.0)

        if message is None:
            await asyncio.sleep(0.01)  # Prevent CPU spin
            continue

        if message["type"] == "message":
            event = json.loads(message["data"])
            await forward_to_clients(event)
```

**Why:**
- `listen()` creates infinite async generator
- Inside `async with`, connection closes automatically
- `get_message()` gives explicit control over message polling
```

**Action:** After integration → DELETE `recurring-plans-fixes.md`

---

### 6. category-selection-fix.md ⭐ VALUABLE (+ DUPLICATE)

**Type:** Bug fix
**Problem:** Phantom auto-selection of category in create modals
**Fix:** Added `mode: 'create'|'edit'` option + `clearSelection()` method to ChoicesCategoryTree

**Duplicate Status:**
- `docs/architecture/category-selection-fix.md` - 29K, 653 lines
- `docs/architecture/frontend/category-selection-fix.md` - 23K, size unknown

**Need to:** Compare files and determine which is canonical

**Valuable Information to Extract:**

**A. ChoicesCategoryTree API Pattern:**
```javascript
// Constructor option
const categoryTree = new ChoicesCategoryTree('#category', {
    mode: 'create',  // 'create' | 'edit'
    financialCenterId: null,
    // ...
});

// Public method
categoryTree.clearSelection();  // Clears both Choices.js + element.value
```

**B. Selection Preservation Logic:**
```javascript
updateFinancialCenter(newFcId) {
    const previousSelection = this.element.value;
    const categoryStillAvailable = checkAvailability(previousSelection, newFcId);

    const shouldPreserve = this.options.mode === 'edit' && categoryStillAvailable;

    if (shouldPreserve) {
        await this.setSelectedCategory(previousSelection);
    } else {
        this.choices.removeActiveItems();  // Clear selection
    }
}
```

**C. Modal Usage Pattern:**
```javascript
// Create modal - clear selection
function openAddTransactionModal() {
    transactionCategoryTreeSelect.clearSelection();
    transactionCategoryTreeSelect.options.financialCenterId = null;
    // ...
}

// Edit modal - preserve selection
function openEditTransactionModal(factId) {
    const fact = await loadFact(factId);
    editCategoryTreeSelect.options.financialCenterId = fact.fc_id;
    await editCategoryTreeSelect.setSelectedCategory(fact.article_id);
    // ...
}
```

**Integration Target:** NEW FILE: `frontend/forms-patterns.yaml`

**Structure:**
```yaml
meta:
  version: "1.0.0"
  description: "Form component patterns and state management"

components:
  choices_category_tree:
    file: "frontend/shared/static/js/choicesCategoryTree.js"
    description: "Hierarchical category selector with financial center filtering"

    options:
      mode:
        type: "'create' | 'edit'"
        default: "'edit'"
        description: "Controls selection preservation on FC change"
        values:
          create: "Never preserve selection (always clear)"
          edit: "Preserve selection if category available for new FC"

    methods:
      clearSelection():
        description: "Clear category selection (Choices.js + element.value)"
        use_case: "Call in create modals before opening"

      setSelectedCategory(articleId):
        description: "Set category selection by ID"
        use_case: "Call in edit modals when loading data"

      updateFinancialCenter(fcId):
        description: "Update FC filter and optionally preserve selection"
        behavior: "Depends on mode option"

patterns:
  create_modal_clear:
    description: "Always clear selection in create modals"
    example: |
      function openAddTransactionModal() {
          transactionCategoryTreeSelect.clearSelection();
          transactionCategoryTreeSelect.options.financialCenterId = null;
      }

  edit_modal_preserve:
    description: "Preserve selection in edit modals"
    example: |
      function openEditTransactionModal(factId) {
          const fact = await loadFact(factId);
          editCategoryTreeSelect.options.financialCenterId = fact.fc_id;
          await editCategoryTreeSelect.setSelectedCategory(fact.article_id);
      }

  fc_change_behavior:
    create_mode: "Clear selection on FC change"
    edit_mode: "Preserve if category available for new FC"
```

**Action After Integration:**
1. Resolve duplicate (compare files, keep canonical version)
2. DELETE both `category-selection-fix.md` files after integration

---

## Integration Summary

### Files to Create (3 new YAML files)

1. **frontend/modals.yaml** (modal-hints-fix.md content)
   - Modal lifecycle patterns
   - Hints loading patterns
   - Create vs Edit modal differences

2. **frontend/forms-patterns.yaml** (category-selection-fix.md content)
   - ChoicesCategoryTree API
   - Selection preservation logic
   - Form state management patterns

3. **frontend/_index.yaml** - Update to include new files

### Files to Update (4 files)

1. **guides/deployment-troubleshooting.md**
   - Add "Environment Variable Syntax Errors" section
   - Source: env-syntax-fix.md

2. **admin-setup.md**
   - Add "Troubleshooting Admin Setup" section
   - Source: setup-admin-fix-v1.0.md

3. **recurring-plans.md**
   - Add "Real-time Updates" section (WebSocket events)
   - Source: recurring-plans-fixes.md

4. **websocket.md**
   - Add "Redis Pub/Sub Subscriber Pattern" section
   - Source: recurring-plans-fixes.md

### Files to Merge (PHASE 3)

**ci-cd-build-deploy.md** (will be merged with ci-cd-pipeline.md)
- Add detailed cache busting section
- Source: cache-busting-fix.md

### Files to Delete (7 files after integration)

1. ✅ env-syntax-fix.md
2. ✅ setup-admin-fix-v1.0.md
3. ✅ cache-busting-fix.md
4. ✅ modal-hints-fix.md
5. ✅ recurring-plans-fixes.md
6. ✅ category-selection-fix.md
7. ✅ frontend/category-selection-fix.md (resolve duplicate first)

---

## Next Steps (for implementation)

1. **Resolve duplicate category-selection-fix.md**
   - Compare both files
   - Determine canonical version
   - Delete outdated version

2. **Create new YAML files** (PHASE 5 can do this)
   - frontend/modals.yaml
   - frontend/forms-patterns.yaml

3. **Update existing docs** (can be done now or in PHASE 6)
   - guides/deployment-troubleshooting.md
   - admin-setup.md
   - recurring-plans.md
   - websocket.md

4. **Delete fix-docs** (ONLY after confirming integration complete)
   - Verify all valuable content extracted
   - Create archive/ directory if needed
   - Move files to archive OR delete

---

**Status:** PHASE 2 COMPLETE
**Next Action:** Proceed to PHASE 3 (CI/CD Documentation Merge)
