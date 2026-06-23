# Domain

The business domain of Family Budget centers on tracking household money: who earned or spent it, from which account, against which budget category. The core schema is a **star schema** — a central fact table (`t_f_budget_fact`) referencing dimension tables (articles, financial centers, cost centers). Dimensions use **SCD Type 1** (in-place updates) with full change history kept in parallel `*_history` tables (**SCD Type 2**), so fact-table foreign keys stay stable forever. This page covers the budget-tracking entities; the medicine cabinet lives in [[medicine]] and bank/CSV ingestion in [[import]]. For persistence patterns see [[database]]; for REST contracts see [[api]].

## Financial Facts (Transactions)

A financial fact is a single income or expense event — the heart of the domain. `BudgetFact` (`t_f_budget_fact`, model `backend/app/models/fact.py`) is the fact table in the star schema; it is partitioned by month on `fact_date` at the DB level and intentionally does **not** use SCD.

Each row references dimensions: `article_id` (required), `financial_center_id` and `cost_center_id` (optional FK columns, though the API requires a financial center on create), plus `user_id` for the creator. Key attributes:

- `amount` — `BigInteger`, **always positive**; the sign (income vs expense) is derived from the article's `type`, never stored on the fact.
- `fact_date` — the transaction date and the partition key.
- `record_type` — `"fact"` for actual transactions or `"plan"` for budgeted/planned entries.
- `transfer_id` — links a paired expense+income fact representing a transfer between financial centers.
- `recurring_plan_id` — references the [[domain#Recurring Plans]] template that generated this fact (no DB FK, because the table is partitioned).

**Transfers** are not a separate entity: `TransferCreate` (`backend/app/schemas/transfer.py`) produces two `BudgetFact` rows (an expense on the source FC, an income on the destination FC) sharing one `transfer_id`. The two financial centers must differ. CRUD lives in [[api]].

## Cost Centers

Cost centers group spending by project, department, or initiative (e.g. "Home Renovation", "Summer Vacation 2025"). `CostCenter` (`t_d_cost_center`, `backend/app/models/cost_center.py`) is an optional dimension on a fact — a budgeting refinement layered on top of articles.

It follows the shared-reference architecture: all cost centers are readable by every user, but only administrators create/update/delete them; `user_id` records the creator for audit only. Fields: `name`, optional `description`, optional `code` (auto-generated business code like `MVZ-1`), and `is_active` for soft-archival. Updates are SCD Type 1 (in-place, stable `id`) via `update_cost_center_profile()` in `backend/app/services/cost_center_service.py`, which simultaneously closes the prior `CostCenterHistory` (SCD2) version and writes a fresh snapshot. Time-travel reads use `get_cost_center_version_at_date()`. History mechanics: [[database]].

Cost centers can be scoped to specific financial centers via the `CostCenterFinancialCenter` whitelist link (see [[domain#Financial Centers & Balances]]).

## Financial Centers & Balances

A financial center models where money physically sits — a bank account, card, or cash wallet (e.g. "Sberbank", "Tinkoff Card", "Cash Wallet"). `FinancialCenter` (`t_d_financial_center`, `backend/app/models/financial_center.py`) is the dimension that gives each transaction a real-world money location and is the unit over which balances are computed.

Same shared-reference + SCD1 model as cost centers: `name`, `description`, `code` (auto-generated, e.g. `CFO-1`), `is_active`; managed by `financial_center_service.py` (`update_financial_center_profile()`, history, time-travel) with full history in `FinancialCenterHistory`.

**Balance** is never stored on the financial center — it is derived by summing facts: income/credit articles add, expense/debit articles subtract (`SUM(CASE Article.type ...)`). Because scanning all history is expensive, monthly snapshots are pre-aggregated (see [[domain#Balance Aggregation]]).

**Whitelist linking** — two simple junction tables (no SCD) restrict which dimensions appear when posting a transaction to a given FC:
- `ArticleFinancialCenter` (`t_article_financial_center`) — links **leaf** articles to FCs.
- `CostCenterFinancialCenter` (`t_cost_center_financial_center`) — links cost centers to FCs.

Semantics for both: **no links = available for ALL financial centers**; one or more links = available **only** for the listed FCs. `update_financial_center_links()` in `article_service.py` replaces an article's link set wholesale.

## Articles

Articles are the budget categories that classify every transaction as income or expense (e.g. "Food → Groceries", "Salary"). `Article` (`t_d_article`, `backend/app/models/article.py`) is the required dimension on every fact and the one entity whose `type` field determines a fact's sign.

Structure and behavior:
- `type` — `"income"` or `"expense"` (CHECK-enforced); balance math also recognizes `"credit"`/`"debit"`.
- `parent_id` — self-referential **adjacency list** building a category tree (root articles have `parent_id = NULL`). Only **leaf** articles may carry financial-center whitelist links and are selectable on transactions.
- Shared-reference + SCD1, with history in `ArticleHistory` (managed by `article_service.py`).

A companion table `ArticleUsageStats` (`t_article_usage_stats`, same model file) caches per-article transaction counts, recalculated daily by an APScheduler cron via the `recalculate_article_usage_stats()` SQL function, to sort categories by popularity in dropdowns. The richer closure-table hierarchy used for subtree queries is documented in [[database]] and [[architecture]]; endpoints in [[api]].

## Product Groups

Product groups categorize physical products for shopping (e.g. "Food → Dairy → Milk") and are distinct from budget articles. `ProductGroup` (`t_d_product_group`, `backend/app/models/product_group.py`) is an admin-managed, shared dimension referenced by shopping-list items, not by budget facts.

It mirrors the article pattern: SCD1 main table + `ProductGroupHistory` (SCD2), `parent_id` adjacency list, `creator_id` for audit, `code` (e.g. `PGRP-1`), and `is_active`. Profile edits and tree moves go through `product_group_service.py` (`update_product_group_profile()`, `move_product_group()`).

Unlike articles, product-group hierarchy is **also materialized in a closure table** `ProductGroupHierarchy` (`t_d_product_group_hierarchy`), storing every ancestor→descendant path with a `depth` (0 = self, 1 = direct child). It is maintained exclusively by `product_group_hierarchy_service.py` (`get_subtree`, `get_ancestors`, `get_direct_children`, `move_subtree`, `rebuild_hierarchy`) — never touched directly. Closure-table mechanics: [[database]].

## Family Members

Family members represent the people a household manages — including children without their own login. `FamilyMember` (`t_d_family_member`, `backend/app/models/family_member.py`) exists primarily to attach medicine courses to a person while routing reminders to a responsible adult.

Fields: optional `linked_user_id` (set when the member also has an account), required `guardian_user_id` (reminders always go here), `name`, optional `birth_date` (for age-based dosing), `notes` (allergies/specifics), and `is_active` (soft-archive). Service `family_member_service.py` provides CRUD plus `has_active_links()`, which blocks deletion while the member still has non-deleted [[medicine]] courses; `archive_family_member()` performs the soft-archive (no hard delete by design). This entity is consumed mainly by the medicine domain — see [[medicine]].

## Recurring Plans

A recurring plan is a template that auto-generates future facts on a schedule — for rent, subscriptions, recurring income, etc. `RecurringPlan` (`t_d_recurring_plan`, `backend/app/models/recurring_plan.py`) is a dimension (SCD Type 1 with soft delete via `is_active`) that spawns `BudgetFact` rows; the facts carry `recurring_plan_id` back to their template.

A plan holds a full transaction template (`article_id`, `financial_center_id`, optional `cost_center_id`, `amount`, `description`, `record_type`) plus schedule config:
- `frequency_type` — `daily`, `weekly`, `monthly`, `quarterly` (the service also handles `yearly`).
- `frequency_value` — weekday `0–6` for weekly, day-of-month `1–28` for monthly/quarterly, `MMDD` for yearly.
- Bounds — open-ended, or capped by `end_date` or `occurrences_count`; progress tracked via `occurrences_generated`, `next_generation_date`, `last_generated_date`.
- Optional reminders — `enable_reminder` + `reminder_hour`/`reminder_minute` create `ScheduledReminder` rows per generated fact.

`RecurringPlanService` (`backend/app/services/recurring_plan_service.py`) handles CRUD and generation. On create it pre-generates ~3 months ahead (`DEFAULT_GENERATION_HORIZON_DAYS = 90`); a daily scheduler job calls `generate_pending_facts()` to extend the horizon. Generation is idempotent (`_check_fact_exists` per date), and `detach_fact_from_plan()` can sever an individual fact (decrementing `occurrences_generated`). Scheduler wiring: [[architecture]]; reminder delivery: [[bot]].

## Shopping Lists

Shopping lists track what to buy, modeled as a **Header + Lines** pair shared across the whole household. The header `ShoppingList` (`t_f_shopping_list`, `backend/app/models/shopping_list.py`) holds `name`, `description`, optional `google_sheets_url`, and `is_active` (archived = completed); `creator_id` records the owner.

Sharing rules: any authenticated user may create, view, and edit any list, but **only the creator may delete** (enforced at the API layer; non-owners get 403). Deleting a header CASCADE-deletes its items. `shopping_list_service.py` provides `get_shopping_lists_with_stats()` (item counts + completion percentage for the card grid), `get_shopping_list_with_items()`, and archive/restore helpers.

The **lines** are `ShoppingListItem` (`t_f_shopping_list_item`, `backend/app/models/shopping_list_item.py`), each requiring `store_id`, `product_group_id`, and `product_name`, with optional `quantity`/`unit`/`comment` and a `position` for ordering. Items support **optimistic locking** (`version`) and **soft delete** (`deleted_at`, kept for autocomplete history); `is_completed`/`completed_at` mark purchases. `shopping_list_item_service.py` offers batch operations (`batch_complete_items`, `batch_delete_items`, `restore_item`) and filtered reads by completion/store/product-group. The [[medicine]] cabinet reuses this infrastructure: `medicine_shopping_integration.py` adds out-of-stock medicines to an "Аптечка — докупить" list.

## Stores

Stores are the shopping locations referenced by list items (e.g. "Walmart", "Аптека"). `Store` (`t_d_store`, `backend/app/models/store.py`) is an admin-managed, shared dimension following the standard SCD1 + history pattern.

Fields: `name` (unique, case-insensitive), optional `address`, `description`, `code` (e.g. `STORE-1`), and `is_active`; `creator_id` for audit. Edits go through `store_service.py` (`update_store_profile()` writing to `StoreHistory` SCD2, plus `get_store_history()` / `get_store_version_at_date()`). Stores are referenced by [[domain#Shopping Lists]] items via `store_id` (required) and are auto-created on demand by import and medicine-restock flows.

## Balance Aggregation

Because a financial center's balance is the cumulative sum of all its facts, recomputing it from the beginning of time on every request is costly. The `FinancialCenterBalanceMonthly` table (`t_agg_financial_center_balance_monthly`, `backend/app/models/financial_center_balance_monthly.py`) stores a pre-calculated **closing balance** per `(financial_center_id, year, month)`.

The rule is `Opening Balance(month N) = Closing Balance(month N-1)`; current balance = that opening figure plus this month's movements. `closing_balance` is cumulative across all history; `transaction_count` is per-month for verification (`Decimal(15,2)`, unique constraint on the business key).

`balance_aggregation_service.py` implements the logic:
- `refresh_monthly_balances()` — idempotent UPSERT that rebuilds snapshots for all/selected FCs and months (heavy; intended as a background or admin-triggered job), iterating from the earliest `record_type="fact"` date.
- `get_opening_balance()` — fast path reads the prior-month aggregate; slow-path fallback computes from full history when a snapshot is missing.
- `get_opening_balances_bulk()` — batched version for many financial centers in one query.

Balance endpoints and the admin refresh trigger are documented in [[api]]; the income/expense sign convention (`income`/`credit` add, `expense`/`debit` subtract) is shared with [[domain#Financial Centers & Balances]].
