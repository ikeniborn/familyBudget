/**
 * Edit Modal Feature Module
 *
 * Exports all edit modal functionality.
 */

// Dropdown cache
export {
  remindersMap,
  loadCategoriesForEdit,
  loadEditFinancialCenters,
  loadEditCostCenters,
  loadRemindersForEdit,
  populateFinancialCentersDropdown,
  populateCostCentersDropdown,
} from './dropdownCache';

// Reminder helpers
export {
  toggleEditReminderSettings,
  initEditReminderCalendarWidget,
  updateEditReminderDatetime,
  populateEditReminderFields,
  resetEditReminderFields,
  getReminderStatusBadge,
} from './reminderHelpers';

// Form population
export {
  getCurrentEditingRecordType,
  setCurrentEditingState,
  setEditModalMode,
  updateEditCategoryTypeBadge,
  setupEditCategoryTypeButtons,
  initEditCategoryTreeSelect,
  openEditModal,
  closeEditModal,
} from './formPopulation';

// Save operations
export { updateFact } from './saveOperations';

// Delete operations
export {
  showRecurringDeleteDialog,
  handleRecurringDeleteChoice,
  deleteFromEditModal,
  deleteFactFromDashboard,
} from './deleteOperations';
