# Domain

The core budgeting domain: a star schema of budget facts (transactions) referencing dimensions (articles, financial/cost centers), plus shopping, recurring plans, reminders, and transfers. Money is stored as positive integer rubles; sign is derived from article type.

## Star Schema Overview

Facts (`t_f_budget_fact`) are the center; dimensions (article, financial center, cost center, user) hang off them. Dimensions use [[database#SCD Type 1 + History-Table Pattern]] in-place updates with separate `*_history` audit tables ([[database#SCD Type 2 Versioning Service]]).

- Fact table: `backend/app/models/fact.py` (`BudgetFact`)
- Income vs expense is determined by `Article.type`, not by amount sign.
- See [[architecture#Application Assembly]] for how services/models are wired.

## Budget Facts (Transactions)

A `BudgetFact` records one income/expense entry with positive integer `amount` (rubles), `fact_date`, `article_id`, and optional `financial_center_id`/`cost_center_id`. `record_type` is `'fact'` or `'plan'`. Source: `backend/app/models/fact.py:16`.

- Table is partitioned monthly by `fact_date` at DB level → composite PK `(id, fact_date)`, so dependent rows (`scheduled_reminder.fact_id`, `recurring_plan_id`) carry NO FK constraint; integrity is application-level.
- `transfer_id` links paired expense/income facts; `recurring_plan_id` links auto-generated facts.
- Schemas: `backend/app/schemas/fact.py` — `FactCreate`, `FactUpdate`, `FactResponse` (denormalizes article/center names), `FactListResponse`, `FactSummary`.
- Endpoints: `facts.py`, `facts_partials.py` (prefix `/facts`) — see [[api#Domain Endpoints]].

## Fact History

Every fact change is logged to `t_f_budget_fact_history` (`BudgetFactHistory`) using full [[database#SCD Type 2 Versioning Service]] with tz-aware `valid_from`/`valid_to` and `is_current`. Source: `backend/app/models/budget_fact_history.py:20`.

- `change_type`: CREATE / UPDATE / DELETE; `changed_fields` is an array of field names.
- `cascade_delete_source` (e.g. `"article_id:123"`) records why a fact was cascade-deleted when a dimension is removed.
- No FK on `fact_id` (partitioned source); history is never deleted.

## Financial Centers

A `FinancialCenter` (`t_d_financial_center`) is where money lives — bank account, card, cash wallet. SCD Type 1 with stable `id`; `is_active` soft-archives; `code` (e.g. `CFO-1`) auto-generated. Source: `backend/app/models/financial_center.py:21`.

- Shared across all users (read by all, mutated by admins); `user_id` is the creator for audit.
- Service `financial_center_service.py` handles in-place profile updates + history append, `get_*_history`, `get_*_version_at_date`, `create_initial_history`.
- Schemas `backend/app/schemas/financial_center.py`; endpoints `financial_centers.py` ([[api#Domain Endpoints]]).

## Monthly Balance Aggregation

`FinancialCenterBalanceMonthly` (`t_agg_financial_center_balance_monthly`) stores the cumulative closing balance per `(financial_center_id, year, month)`, so balance queries skip scanning all history. Opening of month N = closing of N-1.

- Model: `backend/app/models/financial_center_balance_monthly.py:22`.
- `balance_aggregation_service.py`:
  - `refresh_monthly_balances(...)` — idempotent UPSERT of closing balances + transaction counts per FC per month (`balance_aggregation_service.py:36`).
  - `get_opening_balance(...)` — aggregate fast path, full-scan fallback (`:233`).
  - `get_opening_balances_bulk(...)` — multi-FC version, one query + fallback for misses (`:314`).
- Balance formula: `sum(income/credit amounts) - sum(expense/debit amounts)` joined on `Article.type`, only `record_type='fact'`.

## Cost Centers

A `CostCenter` (`t_d_cost_center`) is an optional budget-allocation bucket (project, department) attached to facts via `cost_center_id`. SCD Type 1, shared, `code` like `MVZ-1`. Source: `backend/app/models/cost_center.py:21`.

- Service `cost_center_service.py` mirrors the FC service: in-place update + history, `get_*_history`, `get_*_version_at_date`.
- Endpoints `cost_centers.py` ([[api#Domain Endpoints]]).

## Articles (Categories)

An `Article` (`t_d_article`) is a budget category with `type` `'income'` or `'expense'`, organized as a tree via `parent_id` (adjacency list). SCD Type 1, shared, stable `id`, `code` like `ART-1`. Source: `backend/app/models/article.py:21`.

- Business key `(name, type)`; type drives transaction sign in balance math.
- `ArticleUsageStats` (`t_article_usage_stats`) — daily-recalculated popularity counts for sorting dropdowns (`article.py:202`).
- Service `article_service.py`: profile update + history (`:43`), `validate_parent_id`, list query builders, `handle_is_active_change`.
- Schemas `backend/app/schemas/article.py`; endpoints `articles.py` ([[api#Domain Endpoints]]).

## Article ↔ Financial Center Links

`ArticleFinancialCenter` (`t_article_financial_center`) is a simple link (no SCD) implementing a whitelist: NO links = article usable for ALL financial centers; links present = usable ONLY for the listed ones.

- Source: `backend/app/models/article_financial_center.py:17`. Only LEAF articles get links; used to filter article dropdowns by selected FC during fact entry.
- Managed by `article_service.update_financial_center_links` (`article_service.py:316`); filter applied in `apply_article_filters` (`:344`).
- `CostCenterFinancialCenter` (`t_cost_center_financial_center`) is the analogous whitelist for cost centers (`backend/app/models/cost_center_financial_center.py:17`).

## Product Groups (Hierarchy)

A `ProductGroup` (`t_d_product_group`) categorizes shopping items, organized as a tree via `parent_id`. SCD Type 1, admin-managed, `creator_id` for audit, `code` like `PGRP-1`. Source: `backend/app/models/product_group.py:18`.

- Hierarchy is mirrored in a Closure Table `ProductGroupHierarchy` (`t_d_product_group_hierarchy`) storing every `(ancestor_id, descendant_id, depth)` path — see [[database#Closure Table Hierarchies]]. Source: `backend/app/models/product_group_hierarchy.py:16`.
- `product_group_hierarchy_service.py`: `get_subtree`, `get_ancestors`, `get_direct_children`, `get_depth`, `create_hierarchy_paths`, `delete_hierarchy_paths`, `move_subtree`, `rebuild_hierarchy`.
- `product_group_service.py`: profile update + history, `move_product_group` (re-parents and updates closure). Endpoints `product_groups.py` ([[api#Domain Endpoints]]).

## Stores

A `Store` (`t_d_store`) is a shopping location referenced by shopping-list items. SCD Type 1, admin-managed, `creator_id` audit, optional `address`, `code` like `STORE-1`. Source: `backend/app/models/store.py:17`.

- Service `store_service.py` (in-place update + history, version-at-date); endpoints `stores.py` ([[api#Domain Endpoints]]).

## Family Members

A `FamilyMember` (`t_d_family_member`) is a person (possibly without an account) that domain entities can be assigned to; `guardian_user_id` always receives reminders, `linked_user_id` set if they have an account.

- Source: `backend/app/models/family_member.py:7`. `is_active` soft-archives (no hard delete by design).
- `family_member_service.py`: list/get/create/update, `archive_family_member`, `has_active_links` (delete guard; returns False until medicine courses exist — see [[medicine]]).
- Endpoints `family_members.py` ([[api#Domain Endpoints]]).

## Shopping Lists & Items

`ShoppingList` (`t_f_shopping_list`, header) and `ShoppingListItem` (`t_f_shopping_list_item`, lines) form a Header+Lines pattern. Lists are shared; only `creator_id` may DELETE; deleting a list CASCADE-deletes its items.

- Sources: `shopping_list.py:18`, `shopping_list_item.py:18`. Items require `store_id`, `product_group_id`, `product_name`; optional `quantity`/`unit`/`comment`/`position`. They use optimistic locking (`version`) and soft delete (`deleted_at`, kept for autocomplete).
- `shopping_list_service.py`: `get_shopping_lists_with_stats`, `get_shopping_list_with_items`, `archive_shopping_list`, `restore_shopping_list`.
- `shopping_list_item_service.py`: `batch_complete_items`, `batch_delete_items`, `restore_item`, queries by completion/store/product group.
- Endpoints `shopping_lists.py`, `shopping_list_items.py` ([[api#Shopping Lists Endpoints]]). Live updates via [[realtime#Event Catalog & Payload Filtering]].

## Recurring Plans

A `RecurringPlan` (`t_d_recurring_plan`) is a template that auto-generates `BudgetFact` rows on a schedule: `daily`/`weekly`/`monthly`/`quarterly` with `frequency_value` (weekday 0-6 or day 1-28). Duration is indefinite, by count, or by `end_date`.

- Source: `backend/app/models/recurring_plan.py:16`. Tracks `occurrences_generated`, `next_generation_date`, `last_generated_date`; soft delete via `is_active`. Optional per-fact reminders (`enable_reminder`, `reminder_hour`/`reminder_minute`).
- `RecurringPlanService` (`recurring_plan_service.py:64`): `create_recurring_plan`, `update_recurring_plan`, `deactivate_recurring_plan`, `generate_pending_facts` (90-day horizon), `_calculate_next_occurrence`, `_create_reminders_for_facts`, `detach_fact_from_plan`, `get_stats`.
- Generated facts carry `recurring_plan_id` (no FK due to partitioning). Endpoints `recurring_plans.py` ([[api#Domain Endpoints]]); scheduler in [[architecture#Scheduler]].

## Scheduled Reminders

A `ScheduledReminder` (`t_scheduled_reminder`) is a one-to-one notification for a budget plan (`fact_id` unique, plan must be `record_type='plan'`). `reminder_datetime` is naive in SYSTEM_TIMEZONE. Status: pending, sent, failed, or cancelled.

- Source: `backend/app/models/scheduled_reminder.py:12`. Tracks per-channel delivery (`telegram_sent`, `web_push_sent`), `retry_count`, `error_message`; helpers `is_due`, `can_retry`, `mark_sent`, `increment_retry`.
- `ReminderService` (`reminder_service.py:28`): CRUD, `get_due_reminders`, `send_reminder` (Telegram + Web Push), `_generate_message`, `list_user_reminders`.
- No FK on `fact_id` (partitioned fact table); endpoints `reminders.py` ([[api#Domain Endpoints]]). Delivery channels: [[bot]] and [[realtime#Web Push (VAPID)]].

## Transfers Between Centers

A transfer moves money between two financial centers by creating TWO linked facts — an expense from the source and an income to the destination — sharing one `transfer_id`. There is no transfer table; pairing lives on `BudgetFact.transfer_id`.

- `TransferCreate` requires distinct `from_*`/`to_*` financial centers, `from_article_id` (expense) and `to_article_id` (income), positive integer `amount`, `record_type` `fact`|`plan`; `fact` dates cannot be future (+1 day tolerance). Schema `backend/app/schemas/transfer.py`.
- `transfer_id` = `max(transfer_id)+1` (`transfers.py:35`); DELETE removes all facts sharing that id.
- `TransferResponse` returns `transfer_id`, `expense_fact_id`, `income_fact_id`. Endpoints `transfers.py` ([[api#Domain Endpoints]]); live refresh broadcasts in [[realtime#Event Catalog & Payload Filtering]].

## Analytics & Hints

Analytics schemas drive plan/fact hint widgets and plan filter options, not a stored model. `PlanHintsResponse`/`FactHintsResponse` carry prior-period plan vs fact sums per article. Source: `backend/app/schemas/analytics.py`.

- `PlanFilterOptionsResponse` lists selectable financial centers, article types, and articles; `TransactionFilterEnum` enumerates fact/plan filter modes.
- Consumed by `facts_partials.py` / analytics endpoints — see [[api#Analytics Endpoints]].

## Adjacent Subsystems

Two domains live alongside core budgeting but are documented separately. They reuse the same SCD/history and partitioning patterns.

- [[medicine]] — medicine stock, courses, and expiry/intake reminders (shares `FamilyMember`).
- [[import]] — multi-bank statement import that stages and maps rows into `BudgetFact`.
