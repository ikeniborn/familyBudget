// Medicines bundle entry — wires the manager onto window for onclick handlers + WS.
import {
  loadCatalog, createMedicineFromForm, medicineArchive,
  loadStock, loadMedicineOptions, createStockFromForm, stockDelete, handleMedicineEvent,
  loadDashboard, intakeTake, intakeSkip,
  loadCourses, coursePause, openCourseForm, createCourseFromForm,
  loadCourseDetail, handleMedicineEventV2,
} from './medicines/medicinesManager';

const windowExports = {
  loadCatalog, createMedicineFromForm, medicineArchive,
  loadStock, loadMedicineOptions, createStockFromForm, stockDelete,
  loadDashboard, intakeTake, intakeSkip,
  loadCourses, coursePause, openCourseForm, createCourseFromForm,
};

try {
  if (typeof window !== 'undefined') {
    Object.assign(window, windowExports);
    document.addEventListener('DOMContentLoaded', () => {
      if (document.getElementById('medicines-catalog-body')) loadCatalog();
      if (document.getElementById('medicines-stock-body')) loadStock();
      if (document.getElementById('medicines-today-body')) loadDashboard();
      if (document.getElementById('medicines-courses-body')) loadCourses();
      if (document.querySelector('meta[name="course-id"]')) loadCourseDetail();
    });
    // budgetWSClient exposes `.on(eventType, handler)` (same API facts/dashboard managers use).
    const ws = (window as any).budgetWSClient;
    if (ws && typeof ws.on === 'function') {
      ['medicine_catalog_changed', 'medicine_stock_changed'].forEach(t =>
        ws.on(t, () => handleMedicineEvent(t)));
      ['medicine_intake_marked', 'medicine_course_changed'].forEach(t =>
        ws.on(t, () => handleMedicineEventV2(t)));
    }
  }
} catch (e) {
  console.error('[MEDICINES_BUNDLE] init error', e);
}
