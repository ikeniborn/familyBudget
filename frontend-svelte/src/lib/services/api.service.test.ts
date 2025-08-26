/**
 * Tests for API service
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { apiService } from './api.service';

describe('API Service', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		// Reset fetch mock
		global.fetch = vi.fn();
	});

	describe('request method', () => {
		it('should make GET request successfully', async () => {
			const mockData = { id: 1, name: 'Test' };
			vi.mocked(fetch).mockResolvedValueOnce({
				ok: true,
				json: async () => ({ success: true, data: mockData })
			} as Response);

			const result = await apiService.get('/test');
			
			expect(fetch).toHaveBeenCalledWith(
				expect.stringContaining('/test'),
				expect.objectContaining({
					method: 'GET',
					credentials: 'include',
					headers: expect.objectContaining({
						'Content-Type': 'application/json'
					})
				})
			);
			expect(result).toEqual({ success: true, data: mockData });
		});

		it('should make POST request with body', async () => {
			const requestData = { name: 'New Item' };
			const responseData = { id: 1, ...requestData };
			
			vi.mocked(fetch).mockResolvedValueOnce({
				ok: true,
				json: async () => ({ success: true, data: responseData })
			} as Response);

			const result = await apiService.post('/items', requestData);
			
			expect(fetch).toHaveBeenCalledWith(
				expect.stringContaining('/items'),
				expect.objectContaining({
					method: 'POST',
					body: JSON.stringify(requestData),
					credentials: 'include'
				})
			);
			expect(result).toEqual({ success: true, data: responseData });
		});

		it('should make PUT request', async () => {
			const updateData = { name: 'Updated Item' };
			
			vi.mocked(fetch).mockResolvedValueOnce({
				ok: true,
				json: async () => ({ success: true, data: updateData })
			} as Response);

			const result = await apiService.put('/items/1', updateData);
			
			expect(fetch).toHaveBeenCalledWith(
				expect.stringContaining('/items/1'),
				expect.objectContaining({
					method: 'PUT',
					body: JSON.stringify(updateData)
				})
			);
		});

		it('should make DELETE request', async () => {
			vi.mocked(fetch).mockResolvedValueOnce({
				ok: true,
				json: async () => ({ success: true })
			} as Response);

			const result = await apiService.delete('/items/1');
			
			expect(fetch).toHaveBeenCalledWith(
				expect.stringContaining('/items/1'),
				expect.objectContaining({
					method: 'DELETE'
				})
			);
			expect(result).toEqual({ success: true });
		});
	});

	describe('error handling', () => {
		it('should handle 401 unauthorized error', async () => {
			vi.mocked(fetch).mockResolvedValueOnce({
				ok: false,
				status: 401,
				json: async () => ({ error: 'Unauthorized' })
			} as Response);

			const result = await apiService.get('/protected');
			
			expect(result).toEqual({
				success: false,
				error: 'Unauthorized'
			});
		});

		it('should handle 404 not found error', async () => {
			vi.mocked(fetch).mockResolvedValueOnce({
				ok: false,
				status: 404,
				json: async () => ({ error: 'Not found' })
			} as Response);

			const result = await apiService.get('/nonexistent');
			
			expect(result).toEqual({
				success: false,
				error: 'Not found'
			});
		});

		it('should handle network error', async () => {
			vi.mocked(fetch).mockRejectedValueOnce(new Error('Network error'));

			const result = await apiService.get('/test');
			
			expect(result).toEqual({
				success: false,
				error: 'Network error'
			});
		});

		it('should handle JSON parse error', async () => {
			vi.mocked(fetch).mockResolvedValueOnce({
				ok: true,
				json: async () => {
					throw new Error('Invalid JSON');
				}
			} as Response);

			const result = await apiService.get('/test');
			
			expect(result.success).toBe(false);
			expect(result.error).toContain('Invalid JSON');
		});
	});

	describe('query parameters', () => {
		it('should append query parameters to URL', async () => {
			vi.mocked(fetch).mockResolvedValueOnce({
				ok: true,
				json: async () => ({ success: true, data: [] })
			} as Response);

			await apiService.get('/items', {
				params: {
					page: 1,
					limit: 10,
					search: 'test'
				}
			});
			
			expect(fetch).toHaveBeenCalledWith(
				expect.stringContaining('/items?page=1&limit=10&search=test'),
				expect.any(Object)
			);
		});

		it('should handle empty query parameters', async () => {
			vi.mocked(fetch).mockResolvedValueOnce({
				ok: true,
				json: async () => ({ success: true, data: [] })
			} as Response);

			await apiService.get('/items', { params: {} });
			
			expect(fetch).toHaveBeenCalledWith(
				expect.stringContaining('/items'),
				expect.any(Object)
			);
		});

		it('should encode query parameters', async () => {
			vi.mocked(fetch).mockResolvedValueOnce({
				ok: true,
				json: async () => ({ success: true, data: [] })
			} as Response);

			await apiService.get('/items', {
				params: {
					search: 'test value with spaces'
				}
			});
			
			expect(fetch).toHaveBeenCalledWith(
				expect.stringContaining('search=test%20value%20with%20spaces'),
				expect.any(Object)
			);
		});
	});

	describe('request headers', () => {
		it('should include default headers', async () => {
			vi.mocked(fetch).mockResolvedValueOnce({
				ok: true,
				json: async () => ({ success: true })
			} as Response);

			await apiService.get('/test');
			
			expect(fetch).toHaveBeenCalledWith(
				expect.any(String),
				expect.objectContaining({
					headers: expect.objectContaining({
						'Content-Type': 'application/json'
					})
				})
			);
		});

		it('should allow custom headers', async () => {
			vi.mocked(fetch).mockResolvedValueOnce({
				ok: true,
				json: async () => ({ success: true })
			} as Response);

			await apiService.get('/test', {
				headers: {
					'X-Custom-Header': 'custom-value'
				}
			});
			
			expect(fetch).toHaveBeenCalledWith(
				expect.any(String),
				expect.objectContaining({
					headers: expect.objectContaining({
						'X-Custom-Header': 'custom-value'
					})
				})
			);
		});
	});

	describe('request interceptors', () => {
		it('should handle request timeout', async () => {
			vi.mocked(fetch).mockImplementationOnce(() => 
				new Promise((resolve) => {
					setTimeout(() => {
						resolve({
							ok: true,
							json: async () => ({ success: true })
						} as Response);
					}, 5000);
				})
			);

			const controller = new AbortController();
			setTimeout(() => controller.abort(), 100);

			const result = await apiService.get('/test', {
				signal: controller.signal
			}).catch(err => ({
				success: false,
				error: err.message
			}));
			
			expect(result.success).toBe(false);
		});
	});

	describe('response transformation', () => {
		it('should handle empty response', async () => {
			vi.mocked(fetch).mockResolvedValueOnce({
				ok: true,
				json: async () => null
			} as Response);

			const result = await apiService.get('/test');
			
			expect(result).toBeNull();
		});

		it('should handle non-JSON response', async () => {
			vi.mocked(fetch).mockResolvedValueOnce({
				ok: true,
				headers: new Headers({ 'content-type': 'text/plain' }),
				text: async () => 'Plain text response',
				json: async () => {
					throw new Error('Not JSON');
				}
			} as Response);

			const result = await apiService.get('/test');
			
			expect(result.success).toBe(false);
		});
	});
});