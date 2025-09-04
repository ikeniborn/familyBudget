import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import PasswordLogin from '../PasswordLogin.svelte';
import { authService } from '$lib/services/auth.service';
import { goto } from '$app/navigation';

// Моки
vi.mock('$app/navigation');
vi.mock('$lib/services/auth.service');
vi.mock('$lib/stores/auth.store', () => ({
  setCurrentUser: vi.fn()
}));
vi.mock('$lib/stores/toast.store', () => ({
  useToast: () => ({
    success: vi.fn(),
    error: vi.fn()
  })
}));

const mockGoto = vi.mocked(goto);
const mockAuthService = vi.mocked(authService);

describe('PasswordLogin - Simple Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Рендеринг компонента', () => {
    it('должен отображать основные элементы формы входа', () => {
      render(PasswordLogin);

      expect(screen.getByText('ДОМАШНИЙ БУХГАЛТЕР')).toBeInTheDocument();
      expect(screen.getByText('Управление семейным бюджетом')).toBeInTheDocument();
      expect(screen.getByLabelText('Имя пользователя')).toBeInTheDocument();
      expect(screen.getByLabelText('Пароль')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Войти' })).toBeInTheDocument();
    });

    it('должен переключаться между формами входа и регистрации', async () => {
      render(PasswordLogin);

      // По умолчанию показывается форма входа
      expect(screen.getByRole('button', { name: 'Войти' })).toBeInTheDocument();
      expect(screen.queryByLabelText('Имя')).not.toBeInTheDocument();

      // Переключаемся на регистрацию
      const registerButton = screen.getByText('Регистрация');
      await fireEvent.click(registerButton);

      expect(screen.getByLabelText('Имя')).toBeInTheDocument();
      expect(screen.getByLabelText('Фамилия')).toBeInTheDocument();
      expect(screen.getByLabelText('Подтверждение пароля')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Создать аккаунт' })).toBeInTheDocument();
    });
  });

  describe('Валидация формы', () => {
    it('должен отключать кнопку при пустых полях', () => {
      render(PasswordLogin);

      const submitButton = screen.getByRole('button', { name: 'Войти' });
      expect(submitButton).toBeDisabled();
    });

    it('должен включать кнопку при заполненных полях', async () => {
      render(PasswordLogin);

      const usernameInput = screen.getByLabelText('Имя пользователя');
      const passwordInput = screen.getByLabelText('Пароль');
      const submitButton = screen.getByRole('button', { name: 'Войти' });

      await fireEvent.input(usernameInput, { target: { value: 'testuser' } });
      await fireEvent.input(passwordInput, { target: { value: 'password123' } });

      expect(submitButton).not.toBeDisabled();
    });
  });

  describe('Обработка логина', () => {
    it('должен успешно выполнять вход', async () => {
      const mockResponse = {
        success: true,
        user: {
          id: 1,
          username: 'testuser',
          firstName: 'Test',
          lastName: 'User'
        }
      };

      mockAuthService.loginWithPassword.mockResolvedValue(mockResponse);

      render(PasswordLogin);

      const usernameInput = screen.getByLabelText('Имя пользователя');
      const passwordInput = screen.getByLabelText('Пароль');
      const submitButton = screen.getByRole('button', { name: 'Войти' });

      await fireEvent.input(usernameInput, { target: { value: 'testuser' } });
      await fireEvent.input(passwordInput, { target: { value: 'password123' } });
      await fireEvent.click(submitButton);

      await waitFor(() => {
        expect(mockAuthService.loginWithPassword).toHaveBeenCalledWith('testuser', 'password123');
        expect(mockGoto).toHaveBeenCalledWith('/dashboard');
      });
    });

    it('должен отображать ошибку при неуспешном входе', async () => {
      const mockResponse = {
        success: false,
        error: 'Неверный пароль'
      };

      mockAuthService.loginWithPassword.mockResolvedValue(mockResponse);

      render(PasswordLogin);

      const usernameInput = screen.getByLabelText('Имя пользователя');
      const passwordInput = screen.getByLabelText('Пароль');
      const submitButton = screen.getByRole('button', { name: 'Войти' });

      await fireEvent.input(usernameInput, { target: { value: 'testuser' } });
      await fireEvent.input(passwordInput, { target: { value: 'wrongpassword' } });
      await fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Неверный пароль')).toBeInTheDocument();
      });
    });
  });

  describe('Обработка регистрации', () => {
    it('должен проверять совпадение паролей', async () => {
      render(PasswordLogin);

      // Переключаемся на регистрацию
      const registerButton = screen.getByText('Регистрация');
      await fireEvent.click(registerButton);

      const usernameInput = screen.getByLabelText('Имя пользователя');
      const passwordInput = screen.getByLabelText('Пароль');
      const confirmPasswordInput = screen.getByLabelText('Подтверждение пароля');
      const submitButton = screen.getByRole('button', { name: 'Создать аккаунт' });

      await fireEvent.input(usernameInput, { target: { value: 'newuser' } });
      await fireEvent.input(passwordInput, { target: { value: 'password123' } });
      await fireEvent.input(confirmPasswordInput, { target: { value: 'differentpassword' } });
      await fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Пароли не совпадают')).toBeInTheDocument();
      });

      expect(mockAuthService.register).not.toHaveBeenCalled();
    });

    it('должен проверять минимальную длину пароля', async () => {
      render(PasswordLogin);

      // Переключаемся на регистрацию
      const registerButton = screen.getByText('Регистрация');
      await fireEvent.click(registerButton);

      const usernameInput = screen.getByLabelText('Имя пользователя');
      const passwordInput = screen.getByLabelText('Пароль');
      const confirmPasswordInput = screen.getByLabelText('Подтверждение пароля');
      const submitButton = screen.getByRole('button', { name: 'Создать аккаунт' });

      await fireEvent.input(usernameInput, { target: { value: 'newuser' } });
      await fireEvent.input(passwordInput, { target: { value: '123' } });
      await fireEvent.input(confirmPasswordInput, { target: { value: '123' } });
      await fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Пароль должен содержать минимум 6 символов')).toBeInTheDocument();
      });

      expect(mockAuthService.register).not.toHaveBeenCalled();
    });
  });

  describe('Обработка клавиатуры', () => {
    it('должен отправлять форму по нажатию Enter', async () => {
      const mockResponse = {
        success: true,
        user: {
          id: 1,
          username: 'testuser'
        }
      };

      mockAuthService.loginWithPassword.mockResolvedValue(mockResponse);

      render(PasswordLogin);

      const usernameInput = screen.getByLabelText('Имя пользователя');
      const passwordInput = screen.getByLabelText('Пароль');

      await fireEvent.input(usernameInput, { target: { value: 'testuser' } });
      await fireEvent.input(passwordInput, { target: { value: 'password123' } });
      await fireEvent.keyDown(passwordInput, { key: 'Enter' });

      await waitFor(() => {
        expect(mockAuthService.loginWithPassword).toHaveBeenCalledWith('testuser', 'password123');
      });
    });
  });
});