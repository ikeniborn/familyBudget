/**
 * API Response Types
 *
 * Match backend Pydantic schemas exactly.
 * Source: backend/app/schemas/*.py
 *
 * These types ensure compile-time safety for API response field names,
 * preventing runtime errors from field name mismatches.
 */

import type {
  LocalArticle,
  LocalFinancialCenter,
  LocalCostCenter,
  LocalStore,
  ShoppingListWithStats,
  LocalShoppingListItem,
  LocalProductGroup,
  LocalBudgetFact,
  LocalRecurringPlan,
  LocalArticleHierarchy
} from '@db/pglite';

/**
 * Base pagination interface
 * Common fields for all list responses
 */
interface PaginatedResponse {
  total: number;
  limit: number;
  offset: number;
}

/**
 * Articles
 * Backend: backend/app/schemas/article.py:314-340
 * Schema: ArticleListResponse
 */
export interface ArticleListResponse extends PaginatedResponse {
  articles: LocalArticle[];
}

/**
 * Financial Centers
 * Backend: backend/app/schemas/financial_center.py:200-231
 * Schema: FinancialCenterListResponse
 */
export interface FinancialCenterListResponse extends PaginatedResponse {
  financial_centers: LocalFinancialCenter[];
}

/**
 * Cost Centers
 * Backend: backend/app/schemas/cost_center.py:222-248
 * Schema: CostCenterListResponse
 */
export interface CostCenterListResponse extends PaginatedResponse {
  cost_centers: LocalCostCenter[];
}

/**
 * Stores
 * Backend: backend/app/schemas/store.py:223-249
 * Schema: StoreListResponse
 */
export interface StoreListResponse extends PaginatedResponse {
  stores: LocalStore[];
}

/**
 * Shopping Lists
 * Backend: backend/app/schemas/shopping_list.py:303-329
 * Schema: ShoppingListListResponse
 */
export interface ShoppingListListResponse extends PaginatedResponse {
  shopping_lists: ShoppingListWithStats[];
}

/**
 * Shopping List Items
 * Backend: backend/app/schemas/shopping_list_item.py:377-403
 * Schema: ShoppingListItemListResponse
 *
 * Note: Uses generic 'items' field name (correct!)
 */
export interface ShoppingListItemListResponse extends PaginatedResponse {
  items: LocalShoppingListItem[];
}

/**
 * Product Groups
 * Backend: backend/app/schemas/product_group.py:280-306
 * Schema: ProductGroupListResponse
 */
export interface ProductGroupListResponse extends PaginatedResponse {
  product_groups: LocalProductGroup[];
}

/**
 * Budget Facts
 * Backend: backend/app/schemas/fact.py:493-519
 * Schema: FactListResponse
 */
export interface FactListResponse extends PaginatedResponse {
  facts: LocalBudgetFact[];
}

/**
 * Recurring Plans
 * Backend: backend/app/schemas/recurring_plan.py:406-441
 * Schema: RecurringPlanListResponse
 *
 * Note: Uses generic 'items' field name (correct!)
 */
export interface RecurringPlanListResponse {
  items: LocalRecurringPlan[];
  total: number;
  skip: number;  // Note: Different from offset
  limit: number;
}

/**
 * Article Hierarchy
 * Backend: TBD (endpoint not found in codebase)
 * Schema: TBD
 *
 * Note: This is likely dead code or future functionality.
 * TODO: Verify backend schema when endpoint is implemented.
 */
export interface ArticleHierarchyListResponse {
  items: LocalArticleHierarchy[];
}
