/**
 * MSW API Mock Handlers
 * Mock REST API endpoints for integration testing
 */

import { http, HttpResponse } from 'msw';

// Mock API base URL
const API_BASE = 'http://localhost:8000';

export const handlers = [
    // Facts API
    http.post(`${API_BASE}/api/v1/facts`, async ({ request }) => {
        const body = await request.json() as any;

        // Simulate server response
        return HttpResponse.json({
            data: {
                id: Math.floor(Math.random() * 10000),
                ...body,
                is_synced: true,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            }
        });
    }),

    http.patch(`${API_BASE}/api/v1/facts/:id`, async ({ params, request }) => {
        const body = await request.json() as any;

        return HttpResponse.json({
            data: {
                id: Number(params.id),
                ...body,
                updated_at: new Date().toISOString()
            }
        });
    }),

    http.delete(`${API_BASE}/api/v1/facts/:id`, () => {
        return HttpResponse.json({ success: true });
    }),

    // Transfers API
    http.post(`${API_BASE}/api/v1/transfers`, async ({ request }) => {
        const body = await request.json() as any;

        return HttpResponse.json({
            data: {
                id: Math.floor(Math.random() * 10000),
                sync_hash: `sync-${Date.now()}`,
                expense_fact: { id: Math.floor(Math.random() * 10000), ...body },
                income_fact: { id: Math.floor(Math.random() * 10000), ...body }
            }
        });
    }),

    // Shopping Lists API
    http.post(`${API_BASE}/api/v1/shopping-lists`, async ({ request }) => {
        const body = await request.json() as any;

        return HttpResponse.json({
            data: {
                id: Math.floor(Math.random() * 10000),
                ...body,
                created_at: new Date().toISOString()
            }
        });
    }),

    http.post(`${API_BASE}/api/v1/shopping-list-items`, async ({ request }) => {
        const body = await request.json() as any;

        return HttpResponse.json({
            data: {
                id: Math.floor(Math.random() * 10000),
                ...body,
                created_at: new Date().toISOString()
            }
        });
    }),

    // Reference Data API
    http.get(`${API_BASE}/api/v1/articles`, () => {
        return HttpResponse.json({
            data: [
                { id: 1, name: 'Groceries', parent_id: null },
                { id: 2, name: 'Transport', parent_id: null }
            ]
        });
    }),

    http.get(`${API_BASE}/api/v1/financial-centers`, () => {
        return HttpResponse.json({
            data: [
                { id: 1, name: 'Cash', balance: 10000 },
                { id: 2, name: 'Card', balance: 50000 }
            ]
        });
    })
];

// Error handlers for testing error scenarios
export const errorHandlers = [
    http.post(`${API_BASE}/api/v1/facts`, () => {
        return HttpResponse.json(
            { error: 'Internal Server Error' },
            { status: 500 }
        );
    }),

    http.post(`${API_BASE}/api/v1/transfers`, () => {
        return HttpResponse.json(
            { error: 'Bad Request' },
            { status: 400 }
        );
    })
];
