// Medicines bundle entry — wires the manager onto window for onclick handlers + WS.
import {
  loadCatalog, catalogSearch, createMedicineFromForm, medicineArchive,
  loadPatients, createPatientFromForm, openPatientEdit, savePatientEdit, patientArchive,
  loadStock, loadMedicineOptions, createStockFromForm, stockDelete, openStockEdit, saveStockEdit,
  loadStockAnalytics, handleMedicineEvent,
  loadDashboard, initDashboard, dashboardFilterChanged, intakeTake, intakeSkip, intakeSnooze,
  loadCourses, coursePause, courseResume, courseComplete, openCourseForm, openCourseEdit,
  createCourseFromForm, openQuickPatient, saveQuickPatient,
  loadCourseDetail,
} from './medicines/medicinesManager';
import {
  openImportWizard, medicineImportGoogleSheets, medicineImportAnalyze,
  medicineImportPreview, medicineImportExecute,
} from './medicines/medicineImportWizard';

const windowExports = {
  loadCatalog, catalogSearch, createMedicineFromForm, medicineArchive,
  loadPatients, createPatientFromForm, openPatientEdit, savePatientEdit, patientArchive,
  loadStock, loadMedicineOptions, createStockFromForm, stockDelete, openStockEdit, saveStockEdit,
  loadStockAnalytics,
  loadDashboard, dashboardFilterChanged, intakeTake, intakeSkip, intakeSnooze,
  loadCourses, coursePause, courseResume, courseComplete, openCourseForm, openCourseEdit,
  createCourseFromForm, openQuickPatient, saveQuickPatient,
  openStockImport: () => openImportWizard('stock'),
  openCoursesImport: () => openImportWizard('courses'),
  medicineImportGoogleSheets, medicineImportAnalyze, medicineImportPreview, medicineImportExecute,
};

try {
  if (typeof window !== 'undefined') {
    Object.assign(window, windowExports);
    document.addEventListener('DOMContentLoaded', () => {
      if (document.getElementById('medicines-catalog-body')) loadCatalog();
      if (document.getElementById('medicines-patients-body')) loadPatients();
      if (document.getElementById('medicines-stock-body')) loadStock();
      if (document.getElementById('stock-analytics')) loadStockAnalytics();
      if (document.getElementById('medicines-today-body')) initDashboard();
      if (document.getElementById('medicines-courses-body')) loadCourses();
      if (document.querySelector('meta[name="course-id"]')) loadCourseDetail();
    });
    // budgetWSClient exposes `.on(eventType, handler)` (same API facts/dashboard managers use).
    const ws = (window as any).budgetWSClient;
    if (ws && typeof ws.on === 'function') {
      ['medicine_catalog_changed', 'medicine_stock_changed', 'medicine_family_member_changed',
       'medicine_intake_marked', 'medicine_course_changed'].forEach(t =>
        ws.on(t, () => handleMedicineEvent(t)));
    }
  }
} catch (e) {
  console.error('[MEDICINES_BUNDLE] init error', e);
}
