import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { EnhancedPeriodManager } from '../EnhancedPeriodManager';
import { periodService } from '../../../services/periodService';
import { registryService } from '../../../services/registryService';
import { useAuthStore } from '../../../stores/authStore';
import { toast } from '../../ui/use-toast';

jest.mock('../../../services/periodService');
jest.mock('../../../services/registryService');
jest.mock('../../../stores/authStore');
jest.mock('../../ui/use-toast');

describe('EnhancedPeriodManager', () => {
  const mockUser = { user_id: 1, username: 'testuser' };
  
  beforeEach(() => {
    (useAuthStore as any).mockReturnValue({ user: mockUser });
    (periodService.getAll as jest.Mock).mockResolvedValue([]);
    (registryService.getAll as jest.Mock).mockResolvedValue([]);
    (toast as any).mockImplementation(() => {});
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('автоматически генерирует название периода из месяца и года', async () => {
    const mockCreate = jest.fn().mockResolvedValue({
      period_id: 1,
      period_name: 'Январь 2025',
      period_year: 2025,
      period_month: 1
    });
    (periodService.create as jest.Mock) = mockCreate;

    render(<EnhancedPeriodManager />);
    
    await waitFor(() => {
      expect(screen.getByText('Управление периодами')).toBeInTheDocument();
    });

    const addButton = screen.getByText('Добавить период');
    fireEvent.click(addButton);

    await waitFor(() => {
      const yearInput = screen.getByLabelText('Год');
      const monthSelect = screen.getByLabelText('Месяц');
      
      fireEvent.change(yearInput, { target: { value: '2025' } });
      fireEvent.change(monthSelect, { target: { value: '1' } });
    });

    const saveButton = screen.getByText('Сохранить');
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          period_name: 'Январь 2025',
          period_year: 2025,
          period_month: 1
        })
      );
    });
  });

  test('не показывает поля порядок и статус в форме', async () => {
    render(<EnhancedPeriodManager />);
    
    await waitFor(() => {
      expect(screen.getByText('Управление периодами')).toBeInTheDocument();
    });

    const addButton = screen.getByText('Добавить период');
    fireEvent.click(addButton);

    await waitFor(() => {
      expect(screen.queryByLabelText('Порядок')).not.toBeInTheDocument();
      expect(screen.queryByLabelText('Статус')).not.toBeInTheDocument();
    });
  });

  test('поле название периода нельзя редактировать', async () => {
    (periodService.getAll as jest.Mock).mockResolvedValue([
      {
        period_id: 1,
        period_name: 'Январь 2025',
        period_year: 2025,
        period_month: 1,
        user_id: 1
      }
    ]);

    render(<EnhancedPeriodManager />);
    
    await waitFor(() => {
      expect(screen.getByText('Январь 2025')).toBeInTheDocument();
    });

    const editButton = screen.getByTestId('edit-button-1');
    fireEvent.click(editButton);

    await waitFor(() => {
      const nameField = screen.queryByLabelText('Название периода');
      expect(nameField).not.toBeInTheDocument();
    });
  });

  test('поле транзакций показывается только для чтения', async () => {
    (periodService.getAll as jest.Mock).mockResolvedValue([
      {
        period_id: 1,
        period_name: 'Январь 2025',
        period_year: 2025,
        period_month: 1,
        user_id: 1
      }
    ]);
    
    (registryService.getAll as jest.Mock).mockResolvedValue([
      { registry_id: 1 },
      { registry_id: 2 }
    ]);

    render(<EnhancedPeriodManager />);
    
    await waitFor(() => {
      expect(screen.getByText('2')).toBeInTheDocument();
    });

    const editButton = screen.getByTestId('edit-button-1');
    fireEvent.click(editButton);

    await waitFor(() => {
      const transactionField = screen.queryByLabelText('Транзакций');
      expect(transactionField).not.toBeInTheDocument();
    });
  });

  test('проверяет дубликаты периодов при создании', async () => {
    (periodService.getAll as jest.Mock).mockResolvedValue([
      {
        period_id: 1,
        period_name: 'Январь 2025',
        period_year: 2025,
        period_month: 1,
        user_id: 1
      }
    ]);

    render(<EnhancedPeriodManager />);
    
    await waitFor(() => {
      expect(screen.getByText('Январь 2025')).toBeInTheDocument();
    });

    const addButton = screen.getByText('Добавить период');
    fireEvent.click(addButton);

    await waitFor(() => {
      const yearInput = screen.getByLabelText('Год');
      const monthSelect = screen.getByLabelText('Месяц');
      
      fireEvent.change(yearInput, { target: { value: '2025' } });
      fireEvent.change(monthSelect, { target: { value: '1' } });
    });

    const saveButton = screen.getByText('Сохранить');
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(toast).toHaveBeenCalledWith({
        title: 'Ошибка',
        description: 'Период Январь 2025 уже существует',
        variant: 'destructive'
      });
    });
  });
});