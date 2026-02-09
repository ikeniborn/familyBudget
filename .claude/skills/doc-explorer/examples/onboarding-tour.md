# Example: New Developer Onboarding Tour

Complete walkthrough of first-day onboarding experience for a new developer joining Family Budget project.

---

## Scenario

**Developer Profile:**
- Name: Alice
- Background: 3 years Python + React experience
- Joining as: Full-stack developer
- Goal: Understand architecture to start contributing

**Timeline:** Day 1, 09:00-10:30 (90 minutes)

---

## Session Log

### 09:00 - Welcome & Quick Start (10 min)

```bash
$ @skill:doc-explorer --quick-start

🎓 Welcome to Family Budget Quick Start Tour!

Developer: Alice
Duration: 5-10 minutes
What we'll cover:
  • Tech stack overview
  • Key architectural patterns
  • Directory structure
  • Basic data flow

Ready to start? (yes/no)
> yes

───────────────────────────────────────
📚 Section 1: Tech Stack

[Mermaid System Overview diagram displays]

Family Budget uses:
  Backend:  FastAPI 0.121.2 + PostgreSQL 16
  Frontend: HTMX + Tailwind CSS + TypeScript
  Offline:  Dexie.js 4.0+ (IndexedDB)
  Deploy:   Docker Compose + GitHub Actions

Why this stack?
  • FastAPI: Async support, type hints, auto docs
  • HTMX: Hypermedia approach, no complex build
  • Dexie.js: Offline-first, 80-96% API reduction
  • PostgreSQL: ACID, advanced features (ARRAY, JSON, FTS)

📖 Related docs:
  • docs/architecture/core/build-system.md
  • docs/architecture/core/pwa.md

───────────────────────────────────────
🎯 Section 2: Key Patterns (SCD Type 2)

[Code example displays]

Pattern: Slowly Changing Dimensions Type 2

What: Version history for reference data
Where: t_d_article, t_d_financial_center, t_d_cost_center

Example:
  Article renamed "Food" → "Groceries"

  Old record (closed):
  Article(id=1, name="Food", is_current=False, valid_to=2026-02-09)

  New record (active):
  Article(id=1, name="Groceries", is_current=True, valid_from=2026-02-09)

  ✓ BudgetFact.article_id=1 remains valid!

Why: Stable FK references + full history

📖 Related docs:
  • docs/architecture/database/dimensions.yaml
  • backend/app/services/scd2_service.py

[... Pattern 2: Closure Table ...]
[... Pattern 3: Shared Family Budget ...]

───────────────────────────────────────
📁 Section 3: Directory Structure

[Tree displays]

Key files you should know:
  1. backend/app/main.py - FastAPI entry point
  2. backend/app/api/v1/router.py - API routes registration
  3. frontend/web/static/js/budgetWSClient.js - WebSocket client
  4. docs/architecture/README.md - Architecture index

───────────────────────────────────────
🔄 Section 4: Data Flow Example

Transaction creation flow:

[Sequence diagram displays]

User → Frontend Form → HTMX POST → FastAPI Endpoint
  → Service Layer → SQLAlchemy Model → PostgreSQL
  → WebSocket Broadcast → budgetWSClient → UI Update

📖 Walk through code:
  1. frontend/web/templates/facts/modal.html:45
  2. backend/app/api/v1/endpoints/facts.py:120
  3. backend/app/services/fact_service.py:85
  4. backend/app/models/fact.py:25

───────────────────────────────────────
✅ Quick Start Complete! (9 min 30 sec)

Key takeaways:
  ✓ Understand tech stack (FastAPI, HTMX, PostgreSQL, Dexie.js)
  ✓ Know 3 core patterns (SCD Type 2, Closure Table, Shared Budget)
  ✓ Familiar with directory structure
  ✓ Traced transaction creation flow

📖 Next Steps - Choose your path:

  [1] Backend Developer Path (30 min)
      • Database schema deep dive
      • API patterns walkthrough
      • Service layer best practices

  [2] Frontend Developer Path (25 min)
      • HTMX + Tailwind patterns
      • Dexie.js offline architecture
      • WebSocket real-time updates

  [3] Full-Stack Path (60 min)
      • Complete feature walkthrough (Transfers)
      • End-to-end data flow
      • Testing strategies

  [4] Take Architecture Quiz (10 min)
      • Assess your understanding
      • Get personalized recommendations

Which path interests you? (1/2/3/4)
```

**Alice's choice:** `3` (Full-Stack Path)

---

### 09:10 - Full-Stack Path: Transfers Feature (30 min)

```bash
> 3

🌐 Full-Stack Path Selected

Feature: Transfer System
Duration: ~20 minutes
Difficulty: Medium

What we'll learn:
  • Transfer deduplication algorithm
  • Double-entry bookkeeping
  • Frontend form → Backend API → Database
  • WebSocket real-time sync

───────────────────────────────────────
📘 Section 1: Problem Statement (2 min)

Challenge: User creates transfer between accounts
  Account A: -$100 (expense)
  Account B: +$100 (income)

Requirements:
  1. Atomic operation (both or neither)
  2. No duplicate if user clicks twice
  3. Real-time update for all family members
  4. Offline support (sync later)

❓ Quick check: Why can't we just create 2 separate facts?

  [a] Race condition: concurrent clicks create 4 facts
  [b] Not atomic: one fails, other succeeds
  [c] Hard to find paired facts later
  [d] All of the above

> d

✓ Correct! All these problems exist without deduplication.

───────────────────────────────────────
🔧 Section 2: Backend Implementation (8 min)

[Code walkthrough: backend/app/services/transfer_service.py]

```python
async def create_transfer(
    from_account: int,
    to_account: int,
    amount: Decimal,
    session: AsyncSession
):
    # Generate unique transfer_id
    transfer_id = uuid4()

    # Create both facts with SAME transfer_id
    fact1 = BudgetFact(
        article_id=from_account,
        amount=-amount,  # Negative
        transfer_id=transfer_id
    )
    fact2 = BudgetFact(
        article_id=to_account,
        amount=amount,   # Positive
        transfer_id=transfer_id
    )

    session.add(fact1)
    session.add(fact2)
    await session.flush()  # Get IDs

    # Deduplication: Find and delete duplicates
    stmt = select(BudgetFact).where(
        BudgetFact.transfer_id == transfer_id
    )
    facts = await session.execute(stmt)
    all_facts = facts.scalars().all()

    if len(all_facts) > 2:
        # Keep first 2, delete rest
        for fact in all_facts[2:]:
            await session.delete(fact)

    await session.commit()
    return fact1, fact2
```

**Key insights:**
  1. Same transfer_id links both facts
  2. flush() before deduplication (get DB state)
  3. SELECT finds duplicates (concurrent requests)
  4. DELETE removes extras (atomic cleanup)

❓ What happens if 2 users click Transfer simultaneously?

  [a] One fails with error
  [b] Both create transfers, 4 facts total
  [c] Both create transfers, deduplication removes 2 duplicates
  [d] Database deadlock

> c

✓ Correct! Deduplication handles concurrent requests.

📖 Related docs:
  • docs/architecture/features/transfers-system.md
  • backend/app/api/v1/endpoints/transfers.py

───────────────────────────────────────
🎨 Section 3: Frontend Implementation (5 min)

[Code walkthrough: frontend/web/templates/transfers/modal.html]

```html
<form hx-post="/api/v1/transfers"
      hx-target="#fact-list"
      hx-swap="beforeend">

  <select name="from_article_id">
    <option value="1">Account A</option>
    <option value="2">Account B</option>
  </select>

  <select name="to_article_id">
    <option value="1">Account A</option>
    <option value="2">Account B</option>
  </select>

  <input type="number" name="amount" step="0.01">

  <button type="submit">Create Transfer</button>
</form>
```

**HTMX magic:**
  • hx-post: Submits form via AJAX
  • hx-target: Where to insert response
  • hx-swap: How to insert (beforeend = append)
  • No JavaScript needed!

[WebSocket integration]

```javascript
// budgetWSClient.js
wsClient.on('fact_created', (data) => {
  if (data.transfer_id) {
    // Transfer detected - update both accounts
    updateAccountBalance(data.article_id);
    // Find paired fact and update its account too
    fetchTransferPair(data.transfer_id);
  }
});
```

───────────────────────────────────────
💾 Section 4: Database & Offline (5 min)

[Database schema]

```sql
CREATE TABLE t_f_budget_fact (
  id SERIAL PRIMARY KEY,
  article_id INT NOT NULL,
  amount NUMERIC(15,2) NOT NULL,
  transfer_id UUID,  -- Links transfer facts
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_transfer_id ON t_f_budget_fact(transfer_id)
WHERE transfer_id IS NOT NULL;
```

**Index optimization:**
  • Partial index (WHERE transfer_id IS NOT NULL)
  • Saves space: only ~10% of facts are transfers
  • Faster deduplication queries

[Offline support - Dexie.js]

```typescript
// Offline transfer creation
await db.transaction('rw', db.facts, db.pendingSync, async () => {
  const transfer_id = uuid();

  // Create both facts locally
  await db.facts.add({ ...fact1, transfer_id });
  await db.facts.add({ ...fact2, transfer_id });

  // Add to sync queue
  await db.pendingSync.add({
    type: 'transfer',
    transfer_id,
    timestamp: Date.now()
  });
});

// When online, sync queue processes and calls API
```

───────────────────────────────────────
✅ Transfers Feature Complete! (22 min)

What you learned:
  ✓ Transfer deduplication algorithm
  ✓ Backend: FastAPI + SQLAlchemy
  ✓ Frontend: HTMX + WebSocket
  ✓ Database: Partial indexes
  ✓ Offline: Dexie.js sync queue

📊 Quick Quiz (3 questions)

Q1: What links two transfer facts together?
  [a] fact_id
  [b] transfer_id (UUID)
  [c] created_at timestamp
  [d] article_id

> b

✓ Correct!

Q2: Why flush() before deduplication?
  [a] Performance optimization
  [b] To get database IDs for facts
  [c] Required by SQLAlchemy
  [d] To trigger WebSocket

> b

✓ Correct!

Q3: How does HTMX handle form submission?
  [a] Full page reload
  [b] AJAX POST + partial HTML swap
  [c] WebSocket message
  [d] JavaScript fetch()

> b

✓ Perfect score! (3/3)

───────────────────────────────────────
🎉 Full-Stack Path Progress: 50% Complete

Completed:
  ✓ Quick Start Tour (10 min)
  ✓ Transfers Feature Deep Dive (22 min)

Remaining:
  • Component Trace: Transaction flow (10 min)
  • Database + API patterns (10 min)
  • Final Quiz (5 min)

Continue? (yes/no)
```

**Alice's response:** `yes`

---

### 09:40 - Component Trace + Patterns (20 min)

```bash
🔍 Component Trace: Transaction Creation

We'll trace the complete flow from UI click to database insert.

[Interactive trace with code snippets at each step]
[Database + API patterns walkthrough]
[Final quiz: 5 questions]

───────────────────────────────────────
✅ Full-Stack Onboarding Complete!

Total time: 52 minutes
Quiz score: 12/16 (75% - Good understanding)

🎓 Completion Certificate:
  Developer: Alice
  Path: Full-Stack Onboarding
  Features covered: Transfers, Offline Sync, WebSocket
  Strong areas: Backend patterns, Database design
  Review recommended: Frontend (HTMX deep dive)

📖 Recommended next steps:
  1. Read docs/architecture/frontend/responsive-design.md
  2. Review HTMX triggers: docs/architecture/web/htmx-triggers.yaml
  3. Pick your first task from backlog (label: good-first-issue)
  4. Schedule pairing session with senior developer

🚀 You're ready to start contributing!
```

---

## Outcomes

**Alice's feedback:**
- ✅ Clear understanding of architecture
- ✅ Confident to read codebase
- ✅ Identified learning gaps (HTMX patterns)
- ✅ Knows where to find docs

**Time investment:**
- Tour: 52 minutes
- Follow-up reading: ~30 minutes
- **Total:** ~1.5 hours (vs 4-6 hours of unguided exploration)

**Next day:**
- Alice picks first issue: "Add validation to transfer amount"
- Pairs with senior developer for 1 hour
- Successfully submits first PR by day 3
