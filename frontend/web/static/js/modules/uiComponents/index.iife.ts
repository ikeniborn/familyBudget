/**
 * UIComponents IIFE Bundle - Entry point for standalone browser build
 *
 * Creates window.UIComponents global object with all exported components and functions.
 *
 * @module uiComponents-iife
 * @version 1.0.0
 *
 * Window exports:
 * - window.UIComponents.* - All exported components
 */

import { ConfirmDialog, getConfirmDialogHTML } from './modals/ConfirmDialog';
import { BaseModal } from './modals/BaseModal';
import { FormModal } from './modals/FormModal';
import { CrudModal } from './modals/CrudModal';

// Core components
import { FormField } from './core/FormField';
import { TextInput } from './core/TextInput';
import { TextareaInput } from './core/TextareaInput';
import { AmountInput } from './core/AmountInput';
import { SelectDropdown } from './core/SelectDropdown';
import { DateInput } from './core/DateInput';
import { HierarchySelect } from './core/HierarchySelect';

// Composite components
import { FinancialCenterSelect } from './composite/FinancialCenterSelect';
import { ArticleSelect } from './composite/ArticleSelect';
import { CostCenterSelect } from './composite/CostCenterSelect';
import { RecurringPlanSettings } from './composite/RecurringPlanSettings';
import { ReminderSettings } from './composite/ReminderSettings';

// Form components
import { TransactionForm } from './forms/TransactionForm';
import { TransferForm } from './forms/TransferForm';
import { RecurringPlanForm } from './forms/RecurringPlanForm';
import { AdminCrudForm } from './forms/AdminCrudForm';

// Extend Window interface
declare global {
  interface Window {
    UIComponents: {
      // Modal classes
      ConfirmDialog: typeof ConfirmDialog;
      getConfirmDialogHTML: typeof getConfirmDialogHTML;
      BaseModal: typeof BaseModal;
      FormModal: typeof FormModal;
      CrudModal: typeof CrudModal;

      // Core components
      FormField: typeof FormField;
      TextInput: typeof TextInput;
      TextareaInput: typeof TextareaInput;
      AmountInput: typeof AmountInput;
      SelectDropdown: typeof SelectDropdown;
      DateInput: typeof DateInput;
      HierarchySelect: typeof HierarchySelect;

      // Composite components
      FinancialCenterSelect: typeof FinancialCenterSelect;
      ArticleSelect: typeof ArticleSelect;
      CostCenterSelect: typeof CostCenterSelect;
      RecurringPlanSettings: typeof RecurringPlanSettings;
      ReminderSettings: typeof ReminderSettings;

      // Form components
      TransactionForm: typeof TransactionForm;
      TransferForm: typeof TransferForm;
      RecurringPlanForm: typeof RecurringPlanForm;
      AdminCrudForm: typeof AdminCrudForm;
    };
  }
}

// Create window.UIComponents global
if (typeof window !== 'undefined') {
  window.UIComponents = {
    // Modal classes
    ConfirmDialog,
    getConfirmDialogHTML,
    BaseModal,
    FormModal,
    CrudModal,

    // Core components
    FormField,
    TextInput,
    TextareaInput,
    AmountInput,
    SelectDropdown,
    DateInput,
    HierarchySelect,

    // Composite components
    FinancialCenterSelect,
    ArticleSelect,
    CostCenterSelect,
    RecurringPlanSettings,
    ReminderSettings,

    // Form components
    TransactionForm,
    TransferForm,
    RecurringPlanForm,
    AdminCrudForm,
  };
}

// Export all for module usage
export {
  // Modal classes
  ConfirmDialog,
  getConfirmDialogHTML,
  BaseModal,
  FormModal,
  CrudModal,

  // Core components
  FormField,
  TextInput,
  TextareaInput,
  AmountInput,
  SelectDropdown,
  DateInput,
  HierarchySelect,

  // Composite components
  FinancialCenterSelect,
  ArticleSelect,
  CostCenterSelect,
  RecurringPlanSettings,
  ReminderSettings,

  // Form components
  TransactionForm,
  TransferForm,
  RecurringPlanForm,
  AdminCrudForm,
};
