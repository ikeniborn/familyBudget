/**
 * UI Components Library - Barrel Export
 *
 * Entry point for the component library. Exports all components and types.
 *
 * @module uiComponents
 * @version 1.3.0 (Phase 4: Modal System)
 *
 * @example
 * ```typescript
 * // Import specific components
 * import { FormField, AmountInput, DateInput } from '@components';
 *
 * // Import composite components
 * import { FinancialCenterSelect, ArticleSelect } from '@components';
 *
 * // Import form components
 * import { TransactionForm, AdminCrudForm } from '@components';
 *
 * // Import modal components
 * import { BaseModal, FormModal, CrudModal } from '@components';
 *
 * // Or import all
 * import * as UIComponents from '@components';
 * ```
 */
// ============================================================================
// Core Components (Base primitives)
// ============================================================================
export { FormField } from './core/FormField';
export { TextInput } from './core/TextInput';
export { TextareaInput } from './core/TextareaInput';
export { AmountInput } from './core/AmountInput';
export { SelectDropdown } from './core/SelectDropdown';
export { DateInput } from './core/DateInput';
export { HierarchySelect } from './core/HierarchySelect';
// ============================================================================
// Composite Components (Business Logic)
// ============================================================================
export { FinancialCenterSelect } from './composite/FinancialCenterSelect';
export { ArticleSelect } from './composite/ArticleSelect';
export { CostCenterSelect } from './composite/CostCenterSelect';
export { RecurringPlanSettings } from './composite/RecurringPlanSettings';
export { ReminderSettings } from './composite/ReminderSettings';
// ============================================================================
// Form Components (Complete Forms)
// ============================================================================
export { TransactionForm } from './forms/TransactionForm';
export { TransferForm } from './forms/TransferForm';
export { RecurringPlanForm } from './forms/RecurringPlanForm';
export { AdminCrudForm } from './forms/AdminCrudForm';
// ============================================================================
// Modal Components (Modal Management)
// ============================================================================
export { BaseModal } from './modals/BaseModal';
export { FormModal } from './modals/FormModal';
export { CrudModal } from './modals/CrudModal';
// ============================================================================
// Version Info
// ============================================================================
export const VERSION = '1.3.0';
export const PHASE = 'Phase 4: Modal System';
//# sourceMappingURL=index.js.map