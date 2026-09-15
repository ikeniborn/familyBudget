/**
 * Unit tests for the medicine CSV/Google Sheets import wizard.
 *
 * Drives the public wizard API end-to-end (open → google-sheets fetch →
 * analyze → preview) with MSW handlers. happy-dom lacks HTMLDialogElement
 * showModal/close, so they are polyfilled below.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '../setup/msw';
import {
  openImportWizard, medicineImportGoogleSheets,
  medicineImportAnalyze, medicineImportPreview,
} from '@web/medicines/medicineImportWizard';

// happy-dom does not implement <dialog> modal methods.
HTMLDialogElement.prototype.showModal = function () { this.open = true; };
HTMLDialogElement.prototype.close = function () { this.open = false; };

// The wizard calls an ambient `showToast(msg, type)` global.
const noop = vi.fn();
(globalThis as any).showToast = noop;
(window as any).showToast = noop;

describe('medicineImportWizard', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    noop.mockClear();
  });

  it('opens the import modal with a file input', () => {
    openImportWizard('courses');
    const modal = document.getElementById('medicine-import-modal');
    expect(modal).not.toBeNull();
    expect(modal!.querySelector('#med-import-file')).not.toBeNull();
    expect(modal!.querySelector('#med-import-gs')).not.toBeNull();
  });

  it('runs google-sheets → analyze → preview and renders the wizard steps', async () => {
    server.use(
      http.post('*/api/v1/medicine-courses/google-sheets/fetch', () =>
        HttpResponse.json({ file_content: 'cGF0aWVudCxtZWRpY2luZQ==' })),
      http.post('*/api/v1/medicine-courses/import/analyze', () =>
        HttpResponse.json({
          delimiter: ',', encoding: 'utf-8', has_header: true,
          detected_columns: ['Пациент', 'Лекарство'],
          auto_mapping: { 'Пациент': 'patient', 'Лекарство': 'medicine' },
          sample_rows: [{ 'Пациент': 'Иван', 'Лекарство': 'Аспирин' }],
          total_rows: 1, confidence: 0.9,
        })),
      http.post('*/api/v1/medicine-courses/import/preview', () =>
        HttpResponse.json({ valid_rows: 1, invalid_rows: 0, is_valid: true })),
    );

    openImportWizard('courses');

    // Provide a Google Sheets URL and fetch content (sets module-private state).
    const gs = document.getElementById('med-import-gs') as HTMLInputElement;
    gs.value = 'https://docs.google.com/spreadsheets/d/abc/edit';
    await medicineImportGoogleSheets();

    // Analyze → mapping table rendered.
    await medicineImportAnalyze();
    const selects = document.querySelectorAll<HTMLSelectElement>('#med-import-step select[data-col]');
    expect(selects.length).toBe(2);
    // Each select carries its CSV column in data-col, in detected order.
    expect(selects[0].dataset.col).toBe('Пациент');
    expect(selects[1].dataset.col).toBe('Лекарство');
    // auto_mapping pre-selected the target field option (selected attribute in markup).
    const selected = (sel: HTMLSelectElement) =>
      Array.from(sel.options).find(o => o.hasAttribute('selected'))?.value;
    expect(selected(selects[0])).toBe('patient');
    expect(selected(selects[1])).toBe('medicine');

    // Preview → counts alert + Import button.
    await medicineImportPreview();
    const step = document.getElementById('med-import-step')!;
    expect(step.querySelector('.alert')).not.toBeNull();
    expect(step.textContent).toContain('Готово к импорту: 1');
    const importBtn = Array.from(step.querySelectorAll('button'))
      .find(b => b.textContent?.includes('Импортировать'));
    expect(importBtn).toBeTruthy();
    expect((importBtn as HTMLButtonElement).disabled).toBe(false);
  });
});
