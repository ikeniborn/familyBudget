/**
 * Facts Manager - Dropdown API Integration
 *
 * Load dropdown data (users, articles, financial centers, cost centers).
 *
 * Phase 1.4: Extract API Integration
 * Extracted from: frontend/web/templates/facts.html (lines 691-1155)
 */

import type { User, Article, FinancialCenter, CostCenter, ArticleTreeNode } from '../types/models';
import { dataLayer } from '../../data/DataLayer';
import { getCurrentUserId } from '@shared/utils/userHelpers';

// ============================================================================
// Load Users
// ============================================================================

/**
 * Load all users
 */
export async function loadUsers(): Promise<User[]> {
    const response = await fetch('/api/v1/users', {
        credentials: 'include'
    });

    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    // Backend returns UserListResponse: {users: [...], total, limit, offset}
    // Support both new and old format
    return data.users || data;
}

// ============================================================================
// Load Articles
// ============================================================================

/**
 * Load all articles (categories)
 */
export async function loadArticles(): Promise<Article[]> {
    // Use DataLayer (Dexie-first with API fallback)
    const articles = await dataLayer.getArticles() as unknown as Article[];

    if (!Array.isArray(articles)) {
        console.error('Invalid response format:', articles);
        throw new Error('Expected array of articles');
    }

    return articles;
}

// ============================================================================
// Load Financial Centers
// ============================================================================

/**
 * Load all financial centers (accounts)
 */
export async function loadFinancialCenters(): Promise<FinancialCenter[]> {
    // Get user ID for data layer queries
    const userId = await getCurrentUserId();

    // Use DataLayer (Dexie-first with API fallback)
    return await dataLayer.getFinancialCenters(userId, true) as unknown as FinancialCenter[];
}

// ============================================================================
// Load Cost Centers
// ============================================================================

/**
 * Load all cost centers
 */
export async function loadCostCenters(): Promise<CostCenter[]> {
    // Get user ID for data layer queries
    const userId = await getCurrentUserId();

    // Use DataLayer (Dexie-first with API fallback)
    return await dataLayer.getCostCenters(userId, null, true) as unknown as CostCenter[];
}

/**
 * Filter cost centers by financial center ID
 */
export function filterCostCentersByFC(
    costCenters: CostCenter[],
    financialCenterId: number | null
): CostCenter[] {
    if (!financialCenterId) {
        return costCenters;
    }

    return costCenters.filter(cc => cc.financial_center_id === financialCenterId);
}

// ============================================================================
// Article Tree Building
// ============================================================================

/**
 * Build hierarchical tree from flat article list
 */
export function buildArticleTree(articles: Article[]): ArticleTreeNode[] {
    // Sort all articles alphabetically for proper hierarchy sorting
    const sortedArticles = [...articles].sort((a, b) =>
        a.name.localeCompare(b.name, 'ru')
    );

    const roots = sortedArticles.filter(a => !a.parent_id);

    function buildNode(article: Article, level: number = 0): ArticleTreeNode {
        const children = sortedArticles
            .filter(a => a.parent_id === article.id)
            .map(child => buildNode(child, level + 1));

        return {
            id: article.id,
            name: article.name,
            type: article.type,
            parent_id: article.parent_id,
            level,
            path: article.path,
            children
        };
    }

    return roots.map(root => buildNode(root));
}

/**
 * Flatten article tree for rendering (preserves hierarchy order)
 */
export function flattenArticleTree(nodes: ArticleTreeNode[]): ArticleTreeNode[] {
    const result: ArticleTreeNode[] = [];

    function traverse(node: ArticleTreeNode) {
        result.push(node);
        if (node.children && node.children.length > 0) {
            node.children.forEach(traverse);
        }
    }

    nodes.forEach(traverse);
    return result;
}

/**
 * Group articles by type while preserving hierarchical order
 * Returns articles in order: expense → income → debit → credit
 */
export function groupArticlesByType(articles: Article[]): ArticleTreeNode[] {
    // Build tree and flatten
    const tree = buildArticleTree(articles);
    const flatNodes = flattenArticleTree(tree);

    // Group by type while preserving hierarchical order within each type
    const groupedByType: Record<string, ArticleTreeNode[]> = {
        'expense': [],
        'income': [],
        'debit': [],
        'credit': []
    };

    flatNodes.forEach(node => {
        if (groupedByType[node.type]) {
            groupedByType[node.type].push(node);
        }
    });

    // Flatten back in type order
    return [
        ...groupedByType['expense'],
        ...groupedByType['income'],
        ...groupedByType['debit'],
        ...groupedByType['credit']
    ];
}

// ============================================================================
// Batch Load (Performance Optimization)
// ============================================================================

/**
 * Load all dropdown data in parallel
 * Returns all data in single call for performance
 */
export async function loadAllDropdownData(): Promise<{
    users: User[];
    articles: Article[];
    financialCenters: FinancialCenter[];
    costCenters: CostCenter[];
}> {
    const [users, articles, financialCenters, costCenters] = await Promise.all([
        loadUsers(),
        loadArticles(),
        loadFinancialCenters(),
        loadCostCenters()
    ]);

    return {
        users,
        articles,
        financialCenters,
        costCenters
    };
}
