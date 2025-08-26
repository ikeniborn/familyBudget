/**
 * Tests for auth store
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { authStore } from './auth.store';
import { mockFetch } from '../../test/utils';

describe('AuthStore', () => {
	beforeEach(() => {
		// Reset store state before each test
		authStore.logout();
		vi.clearAllMocks();
	});

	describe('initialization', () => {
		it('should initialize with default values', () => {
			let state: any;
			const unsubscribe = authStore.subscribe(s => state = s);
			
			expect(state.user).toBeNull();
			expect(state.isAuthenticated).toBe(false);
			expect(state.loading).toBe(false);
			
			unsubscribe();
		});
	});

	describe('login', () => {
		it('should login user successfully', async () => {
			const mockUser = {
				id: 1,
				username: 'testuser',
				email: 'test@example.com',
				user_name: 'Test User'
			};

			mockFetch({
				success: true,
				data: { user: mockUser }
			});

			const result = await authStore.login('testuser', 'password123');
			
			expect(result.success).toBe(true);
			expect(result.data?.user).toEqual(mockUser);
			
			let state: any;
			const unsubscribe = authStore.subscribe(s => state = s);
			expect(state.user).toEqual(mockUser);
			expect(state.isAuthenticated).toBe(true);
			unsubscribe();
		});

		it('should handle login failure', async () => {
			mockFetch(
				{ success: false, error: 'Invalid credentials' },
				401
			);

			const result = await authStore.login('testuser', 'wrongpassword');
			
			expect(result.success).toBe(false);
			expect(result.error).toBe('Invalid credentials');
			
			let state: any;
			const unsubscribe = authStore.subscribe(s => state = s);
			expect(state.user).toBeNull();
			expect(state.isAuthenticated).toBe(false);
			unsubscribe();
		});

		it('should handle network error during login', async () => {
			vi.mocked(fetch).mockRejectedValueOnce(new Error('Network error'));

			const result = await authStore.login('testuser', 'password123');
			
			expect(result.success).toBe(false);
			expect(result.error).toContain('Network error');
		});
	});

	describe('register', () => {
		it('should register user successfully', async () => {
			const userData = {
				username: 'newuser',
				password: 'Password123!',
				user_name: 'New User',
				email: 'new@example.com'
			};

			const mockUser = {
				id: 2,
				username: userData.username,
				email: userData.email,
				user_name: userData.user_name
			};

			mockFetch({
				success: true,
				data: { user: mockUser }
			});

			const result = await authStore.register(userData);
			
			expect(result.success).toBe(true);
			expect(result.data?.user).toEqual(mockUser);
		});

		it('should handle registration failure', async () => {
			const userData = {
				username: 'existinguser',
				password: 'Password123!',
				user_name: 'Existing User',
				email: 'existing@example.com'
			};

			mockFetch(
				{ success: false, error: 'Username already exists' },
				409
			);

			const result = await authStore.register(userData);
			
			expect(result.success).toBe(false);
			expect(result.error).toBe('Username already exists');
		});
	});

	describe('logout', () => {
		it('should logout user successfully', async () => {
			// First login
			const mockUser = {
				id: 1,
				username: 'testuser',
				email: 'test@example.com',
				user_name: 'Test User'
			};

			mockFetch({
				success: true,
				data: { user: mockUser }
			});

			await authStore.login('testuser', 'password123');

			// Then logout
			mockFetch({ success: true });
			
			await authStore.logout();
			
			let state: any;
			const unsubscribe = authStore.subscribe(s => state = s);
			expect(state.user).toBeNull();
			expect(state.isAuthenticated).toBe(false);
			unsubscribe();
		});
	});

	describe('checkAuth', () => {
		it('should check authentication status', async () => {
			const mockUser = {
				id: 1,
				username: 'testuser',
				email: 'test@example.com',
				user_name: 'Test User'
			};

			mockFetch({
				success: true,
				data: { user: mockUser }
			});

			await authStore.checkAuth();
			
			let state: any;
			const unsubscribe = authStore.subscribe(s => state = s);
			expect(state.user).toEqual(mockUser);
			expect(state.isAuthenticated).toBe(true);
			unsubscribe();
		});

		it('should handle unauthenticated state', async () => {
			mockFetch(
				{ success: false, error: 'Not authenticated' },
				401
			);

			await authStore.checkAuth();
			
			let state: any;
			const unsubscribe = authStore.subscribe(s => state = s);
			expect(state.user).toBeNull();
			expect(state.isAuthenticated).toBe(false);
			unsubscribe();
		});
	});

	describe('loading state', () => {
		it('should manage loading state during operations', async () => {
			let loadingStates: boolean[] = [];
			const unsubscribe = authStore.subscribe(s => {
				loadingStates.push(s.loading);
			});

			// Mock delayed response
			vi.mocked(fetch).mockImplementationOnce(() => 
				new Promise(resolve => setTimeout(() => {
					resolve({
						ok: true,
						json: async () => ({ success: true, data: { user: {} } })
					} as Response);
				}, 10))
			);

			const promise = authStore.login('testuser', 'password123');
			
			// Should be loading
			expect(loadingStates[loadingStates.length - 1]).toBe(true);
			
			await promise;
			
			// Should not be loading after completion
			expect(loadingStates[loadingStates.length - 1]).toBe(false);
			
			unsubscribe();
		});
	});

	describe('updateUser', () => {
		it('should update user data', () => {
			const initialUser = {
				id: 1,
				username: 'testuser',
				email: 'test@example.com',
				user_name: 'Test User'
			};

			// Set initial user
			authStore.setUser(initialUser);

			// Update user
			const updatedData = {
				email: 'newemail@example.com',
				user_name: 'Updated Name'
			};

			authStore.updateUser(updatedData);

			let state: any;
			const unsubscribe = authStore.subscribe(s => state = s);
			expect(state.user.email).toBe(updatedData.email);
			expect(state.user.user_name).toBe(updatedData.user_name);
			expect(state.user.username).toBe(initialUser.username); // Should remain unchanged
			unsubscribe();
		});
	});
});