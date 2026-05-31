# Domain

Family budget management domain: users track income/expense transactions grouped by categories (articles), cost centers, and financial accounts.

## Article (Budget Category)

The primary classification dimension for transactions. Articles form a tree hierarchy (e.g., Food → Groceries → Organic). Stored with adjacency list (`parent_id`) plus [[database#Closure Table]] for efficient subtree queries.

Model: `backend/app/models/article.py`. SCD pattern: [[database#SCD Type 2]] — updates create new versions preserving full history.

## Budget Fact

A single income or expense transaction. The core fact in the star schema.

Fields: `user_id`, `article_id`, `cost_center_id`, `financial_center_id`, `fact_date`, `amount`, `description`. Table `t_f_budget_fact` is partitioned by month for query performance. See [[database#Fact Table]].

## Cost Center

Budget allocation grouping for projects or departments (e.g., "Home Renovation", "Marketing"). Global — shared across all users. Only admins can create/update/delete.

SCD pattern: [[database#SCD Type 1 with History]] — main table holds current data only; full history in `t_d_cost_center_history`. Stable `id` ensures FK integrity in fact tables never breaks on update.

## Financial Center

Represents a funding source or financial account (bank account, cash, card). User-specific. Each fact can reference a financial center to track which account was used.

Model: `backend/app/models/financial_center.py`.

## Product Group

Category hierarchy for shopping lists and store products. Separate tree from articles — models product taxonomy (e.g., Dairy → Milk). Uses [[database#Closure Table]] via `t_d_product_group_hierarchy`.

## Shopping List

Temporary list of items to purchase. Items can reference product groups and stores. Supports offline creation via [[frontend#Dexie Offline Sync]].

## Recurring Plan

A template for transactions that repeat on a schedule. Service `recurring_plan_service.py` generates fact entries. See `backend/app/services/recurring_plan_service.py`.

## Analytics

Aggregated spending views by article, cost center, financial center, or time period. Computed queries — no separate aggregate tables. Exposed via `api/v1/endpoints/facts.py` analytics routes.
