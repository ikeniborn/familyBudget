/**
 * Validation helpers for Dexie
 * Dexie не поддерживает SQL CHECK constraints, нужна JavaScript validation
 */

import { toCents, validateType, validateAmount } from '../core/database';

/**
 * Validate LocalArticle before insert/update
 */
export function validateArticle(article: {
  type: string;
  name: string;
  user_id: number;
}): void {
  // Validate type
  const allowedTypes = ['income', 'expense', 'debit', 'credit'] as const;
  if (!validateType(article.type, allowedTypes)) {
    throw new Error(`Invalid article type: ${article.type}. Must be one of: ${allowedTypes.join(', ')}`);
  }

  // Validate name (not empty)
  if (!article.name || article.name.trim().length === 0) {
    throw new Error('Article name cannot be empty');
  }

  // Validate user_id (positive integer)
  if (!Number.isInteger(article.user_id) || article.user_id < 0) {
    throw new Error(`Invalid user_id: ${article.user_id}. Must be a positive integer`);
  }
}

/**
 * Validate LocalBudgetFact before insert/update
 */
export function validateFact(fact: {
  amount: number;
  date: string;
  record_type: string;
  user_id: number;
  article_id: number;
}): void {
  // Validate amount (positive number)
  if (!validateAmount(fact.amount)) {
    throw new Error(`Invalid amount: ${fact.amount}. Must be a positive number`);
  }

  // Validate date format (YYYY-MM-DD)
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(fact.date)) {
    throw new Error(`Invalid date format: ${fact.date}. Must be YYYY-MM-DD`);
  }

  // Validate record_type
  const allowedTypes = ['fact', 'plan'] as const;
  if (!validateType(fact.record_type, allowedTypes)) {
    throw new Error(`Invalid record_type: ${fact.record_type}. Must be 'fact' or 'plan'`);
  }

  // Validate user_id and article_id
  if (!Number.isInteger(fact.user_id) || fact.user_id < 0) {
    throw new Error(`Invalid user_id: ${fact.user_id}`);
  }
  if (!Number.isInteger(fact.article_id) || fact.article_id < 0) {
    throw new Error(`Invalid article_id: ${fact.article_id}`);
  }
}

/**
 * Validate LocalShoppingListItem before insert/update
 */
export function validateShoppingItem(item: {
  name: string;
  quantity: number;
  position: number;
}): void {
  // Validate name
  if (!item.name || item.name.trim().length === 0) {
    throw new Error('Shopping item name cannot be empty');
  }

  // Validate quantity (positive integer)
  if (!Number.isInteger(item.quantity) || item.quantity <= 0) {
    throw new Error(`Invalid quantity: ${item.quantity}. Must be a positive integer`);
  }

  // Validate position (non-negative integer)
  if (!Number.isInteger(item.position) || item.position < 0) {
    throw new Error(`Invalid position: ${item.position}. Must be a non-negative integer`);
  }
}

/**
 * Validate sync_status value
 */
export function validateSyncStatus(status: string): void {
  const allowedStatuses = ['synced', 'pending', 'conflict', 'deleted'] as const;
  if (!validateType(status, allowedStatuses)) {
    throw new Error(`Invalid sync_status: ${status}. Must be one of: ${allowedStatuses.join(', ')}`);
  }
}

/**
 * Convert and validate amount to cents
 * Combines toCents() + validateAmount()
 */
export function amountToCents(amount: number): number {
  if (!validateAmount(amount)) {
    throw new Error(`Invalid amount: ${amount}. Must be a positive number`);
  }
  return toCents(amount);
}
