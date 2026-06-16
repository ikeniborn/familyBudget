// Medicines bundle entry — wires the manager onto window for onclick handlers + WS.
import {
  loadCatalog, createMedicineFromForm, medicineArchive,
  loadStock, loadMedicineOptions, createStockFromForm, stockDelete, handleMedicineEvent,
} from './medicines/medicinesManager';

const windowExports = {
  loadCatalog, createMedicineFromForm, medicineArchive,
  loadStock, loadMedicineOptions, createStockFromForm, stockDelete, handleMedicineEvent,
};

try {
  if (typeof window !== 'undefined') {
    Object.assign(window, windowExports);
    document.addEventListener('DOMContentLoaded', () => {
      if (document.getElementById('medicines-catalog-body')) loadCatalog();
      if (document.getElementById('medicines-stock-body')) loadStock();
    });
    const ws = (window as any).budgetWSClient;
    if (ws && typeof ws.addEventListener === 'function') {
      ['medicine_catalog_changed', 'medicine_stock_changed'].forEach(t =>
        ws.addEventListener(t, () => handleMedicineEvent(t)));
    }
  }
} catch (e) {
  console.error('[MEDICINES_BUNDLE] init error', e);
}
