/**
 * Article Creation Fix Tests
 * Tests for 422 error fix when creating articles without user_id
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import { get } from 'svelte/store';
import ArticlesPage from '../../frontend-svelte/src/routes/(protected)/settings/articles/+page.svelte';
import { articlesService } from '../../frontend-svelte/src/lib/services/articles.service';
import { useToast } from '../../frontend-svelte/src/lib/stores/toast.store';

vi.mock('../../frontend-svelte/src/lib/services/articles.service');
vi.mock('../../frontend-svelte/src/lib/stores/toast.store');
vi.mock('../../frontend-svelte/src/lib/stores/auth.store', () => ({
  isAdmin: { subscribe: vi.fn((fn) => { fn(true); return () => {}; }) }
}));

describe('Article Creation Without user_id', () => {
  let toastSuccess: ReturnType<typeof vi.fn>;
  let toastError: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    toastSuccess = vi.fn();
    toastError = vi.fn();

    vi.mocked(useToast).mockReturnValue({
      success: toastSuccess,
      error: toastError,
      warning: vi.fn(),
      info: vi.fn()
    });

    // Mock initial data load
    vi.mocked(articlesService.getAll).mockResolvedValue({
      success: true,
      data: []
    });

    vi.mocked(articlesService.getStats).mockResolvedValue({
      success: true,
      data: {
        total: 0,
        active: 0,
        inactive: 0
      }
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should not include user_id in article creation payload', async () => {
    const createMock = vi.fn().mockResolvedValue({
      success: true,
      data: {
        id: 1,
        code: 'TEST',
        name: 'Test Article',
        description: 'Test Description',
        is_active: true,
        user_id: 1
      }
    });
    vi.mocked(articlesService.create).mockImplementation(createMock);

    render(ArticlesPage);

    // Wait for initial load
    await waitFor(() => {
      expect(screen.getByText('Управление статьями')).toBeInTheDocument();
    });

    // Open create modal
    const createButton = screen.getByText('Создать статью');
    await fireEvent.click(createButton);

    // Fill form
    const codeInput = screen.getByLabelText('Код статьи *');
    const nameInput = screen.getByLabelText('Название *');
    const descriptionInput = screen.getByLabelText('Описание');

    await fireEvent.input(codeInput, { target: { value: 'TEST' } });
    await fireEvent.input(nameInput, { target: { value: 'Test Article' } });
    await fireEvent.input(descriptionInput, { target: { value: 'Test Description' } });

    // Submit form
    const submitButton = screen.getAllByText('Создать')[1]; // Second "Создать" is in modal
    await fireEvent.click(submitButton);

    // Verify the payload does NOT include user_id
    await waitFor(() => {
      expect(createMock).toHaveBeenCalledWith({
        code: 'TEST',
        name: 'Test Article',
        description: 'Test Description',
        is_active: true
        // user_id should NOT be here
      });
    });

    // Verify user_id is NOT in the payload
    const callArgs = createMock.mock.calls[0][0];
    expect(callArgs).not.toHaveProperty('user_id');
  });

  it('should handle successful article creation without user_id', async () => {
    vi.mocked(articlesService.create).mockResolvedValue({
      success: true,
      data: {
        id: 1,
        code: 'SUCCESS',
        name: 'Success Article',
        is_active: true,
        user_id: 1
      }
    });

    render(ArticlesPage);
    await waitFor(() => screen.getByText('Управление статьями'));

    // Create article
    const createButton = screen.getByText('Создать статью');
    await fireEvent.click(createButton);

    await fireEvent.input(screen.getByLabelText('Код статьи *'), { target: { value: 'SUCCESS' } });
    await fireEvent.input(screen.getByLabelText('Название *'), { target: { value: 'Success Article' } });

    const submitButton = screen.getAllByText('Создать')[1];
    await fireEvent.click(submitButton);

    // Verify success
    await waitFor(() => {
      expect(toastSuccess).toHaveBeenCalledWith('Article "Success Article" created successfully');
    });
  });

  it('should handle 422 error gracefully', async () => {
    vi.mocked(articlesService.create).mockRejectedValue({
      success: false,
      error: 'Validation failed',
      details: {
        code: ['Field required']
      }
    });

    render(ArticlesPage);
    await waitFor(() => screen.getByText('Управление статьями'));

    // Try to create article
    const createButton = screen.getByText('Создать статью');
    await fireEvent.click(createButton);

    await fireEvent.input(screen.getByLabelText('Название *'), { target: { value: 'Test' } });

    const submitButton = screen.getAllByText('Создать')[1];
    await fireEvent.click(submitButton);

    // Verify error handling
    await waitFor(() => {
      expect(toastError).toHaveBeenCalledWith(expect.stringContaining('Failed to create article'));
    });
  });

  it('should not send managed_by field from frontend', async () => {
    const createMock = vi.fn().mockResolvedValue({
      success: true,
      data: { id: 1, code: 'TEST', name: 'Test', user_id: 1 }
    });
    vi.mocked(articlesService.create).mockImplementation(createMock);

    render(ArticlesPage);
    await waitFor(() => screen.getByText('Управление статьями'));

    const createButton = screen.getByText('Создать статью');
    await fireEvent.click(createButton);

    await fireEvent.input(screen.getByLabelText('Код статьи *'), { target: { value: 'TEST' } });
    await fireEvent.input(screen.getByLabelText('Название *'), { target: { value: 'Test' } });

    const submitButton = screen.getAllByText('Создать')[1];
    await fireEvent.click(submitButton);

    await waitFor(() => {
      const callArgs = createMock.mock.calls[0][0];
      expect(callArgs).not.toHaveProperty('managed_by');
    });
  });
});