/**
 * Unit tests for the medicines manager (slice M6).
 *
 * Covers what the medicine spec originally required for the frontend:
 * dashboard grouped by family member, the patient filter, WebSocket-driven
 * refresh — plus the pure helpers (form labels, estimate text, schedule config).
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '../setup/msw';
import {
  formLabel, estimateText, buildScheduleConfig,
  loadDashboard, initDashboard, dashboardFilterChanged, handleMedicineEvent,
} from '@web/medicines/medicinesManager';

const noop = vi.fn();
(globalThis as any).showToast = noop;
(window as any).showToast = noop;

const INTAKES = {
  intakes: [
    { id: 1, course_id: 10, patient_id: 1, scheduled_at: '2026-09-15T08:00:00', status: 'scheduled',
      version: 1, medicine_name: 'Ибупрофен', patient_name: 'Маша', dose_amount: '1', dose_unit: 'шт', with_food: null },
    { id: 2, course_id: 11, patient_id: 2, scheduled_at: '2026-09-15T09:00:00', status: 'taken',
      version: 2, medicine_name: 'Аскорбинка', patient_name: 'Гриша', dose_amount: '2', dose_unit: 'шт', with_food: null },
    { id: 3, course_id: 10, patient_id: 1, scheduled_at: '2026-09-15T20:00:00', status: 'scheduled',
      version: 1, medicine_name: 'Ибупрофен', patient_name: 'Маша', dose_amount: '1', dose_unit: 'шт', with_food: null },
  ],
  total: 3, limit: 200, offset: 0,
};

describe('helpers', () => {
  it('formLabel maps enum values to Russian and falls back to the raw value', () => {
    expect(formLabel('tablet')).toBe('таблетка');
    expect(formLabel('injection')).toBe('инъекция');
    expect(formLabel('mystery')).toBe('mystery');
  });

  it('estimateText renders stock estimates', () => {
    expect(estimateText(null)).toBe('');
    expect(estimateText({ remaining: '10', intakes_left: 10, days_left: 5, in_stock: true }))
      .toContain('хватит на 10 приёмов');
    expect(estimateText({ remaining: '0', intakes_left: 0, days_left: null, in_stock: false }))
      .toContain('нет в аптечке');
  });

  it('buildScheduleConfig validates per schedule type', () => {
    document.body.innerHTML = `
      <input id="course-schedule-n" value="3">
      <input type="checkbox" class="course-day" value="mon" checked>
      <input type="checkbox" class="course-day" value="fri" checked>`;
    expect(buildScheduleConfig('daily')).toBeNull();
    expect(buildScheduleConfig('every_n_days')).toEqual({ n: 3 });
    expect(buildScheduleConfig('weekdays')).toEqual({ days: ['mon', 'fri'] });

    (document.getElementById('course-schedule-n') as HTMLInputElement).value = '0';
    expect(() => buildScheduleConfig('every_n_days')).toThrow();
    document.querySelectorAll<HTMLInputElement>('.course-day').forEach(el => { el.checked = false; });
    expect(() => buildScheduleConfig('weekdays')).toThrow();
  });
});

describe('dashboard', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <select id="dashboard-patient-filter"><option value="">Все члены семьи</option></select>
      <div id="medicines-today-body"></div>`;
    server.use(http.get('/api/v1/medicine-intakes', () => HttpResponse.json(INTAKES)));
  });

  it('groups today doses by family member', async () => {
    await loadDashboard();
    const root = document.getElementById('medicines-today-body')!;
    const headers = [...root.querySelectorAll('h2')].map(h => h.textContent);
    expect(headers).toHaveLength(2);
    expect(headers.join(' ')).toContain('Маша');
    expect(headers.join(' ')).toContain('Гриша');
    expect(root.querySelectorAll('[data-id]')).toHaveLength(3);
    // scheduled doses expose the snooze action, resolved ones disable it
    const firstCard = root.querySelector('[data-id="1"]')!;
    expect(firstCard.innerHTML).toContain('intakeSnooze(1)');
  });

  it('initDashboard populates the patient filter and passes the selection', async () => {
    const requested: string[] = [];
    server.use(
      http.get('/api/v1/family-members', () => HttpResponse.json({
        family_members: [{ id: 1, name: 'Маша' }, { id: 2, name: 'Гриша' }] })),
      http.get('/api/v1/medicine-intakes', ({ request }) => {
        requested.push(new URL(request.url).search);
        return HttpResponse.json(INTAKES);
      }),
    );
    await initDashboard();
    const sel = document.getElementById('dashboard-patient-filter') as HTMLSelectElement;
    expect(sel.options).toHaveLength(3); // «Все» + two members
    expect(requested[0]).toBe('?date=today');

    sel.value = '2';
    await dashboardFilterChanged();
    expect(requested.some(q => q.includes('patient_id=2'))).toBe(true);
  });

  it('refreshes the dashboard on medicine_intake_marked WS event', async () => {
    let hits = 0;
    server.use(http.get('/api/v1/medicine-intakes', () => {
      hits += 1;
      return HttpResponse.json(INTAKES);
    }));
    handleMedicineEvent('medicine_intake_marked');
    await vi.waitFor(() => expect(hits).toBe(1));
    handleMedicineEvent('medicine_course_changed'); // no courses table mounted → no fetch
    expect(hits).toBe(1);
  });
});
