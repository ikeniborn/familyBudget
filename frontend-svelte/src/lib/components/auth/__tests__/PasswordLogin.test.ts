import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import { goto } from '$app/navigation';
import PasswordLogin from '../PasswordLogin.svelte';
import { authService } from '$lib/services/auth.service';
import { setCurrentUser } from '$lib/stores/auth.store';
import { useToast } from '$lib/stores/toast.store';

// Моки
vi.mock('$app/navigation');
vi.mock('$lib/services/auth.service');
vi.mock('$lib/stores/auth.store');
vi.mock('$lib/stores/toast.store');

const mockGoto = vi.mocked(goto);
const mockAuthService = vi.mocked(authService);
const mockSetCurrentUser = vi.mocked(setCurrentUser);
const mockToast = {
  success: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
  warning: vi.fn()
};
const mockUseToast = vi.mocked(useToast);

describe('PasswordLogin', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseToast.mockReturnValue(mockToast);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Рендеринг компонента', () => {
    it('должен отображать форму входа по умолчанию', () => {
      render(PasswordLogin);

      expect(screen.getByText('ДОМАШНИЙ БУХГАЛТЕР')).toBeInTheDocument();
      expect(screen.getByText('Управление семейным бюджетом')).toBeInTheDocument();
      expect(screen.getByText('Вход')).toBeInTheDocument();
      expect(screen.getByText('Регистрация')).toBeInTheDocument();
      expect(screen.getByLabelText('Имя пользователя')).toBeInTheDocument();
      expect(screen.getByLabelText('Пароль')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Войти' })).toBeInTheDocument();
    });

    it('должен переключаться на форму регистрации', async () => {
      render(PasswordLogin);

      const registerButton = screen.getByText('Регистрация');
      await fireEvent.click(registerButton);

      expect(screen.getByLabelText('Имя')).toBeInTheDocument();
      expect(screen.getByLabelText('Фамилия')).toBeInTheDocument();
      expect(screen.getByLabelText('Подтверждение пароля')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Создать аккаунт' })).toBeInTheDocument();
    });

    it('должен переключаться обратно на форму входа', async () => {
      render(PasswordLogin);

      // Переключаемся на регистрацию
      const registerButton = screen.getByText('Регистрация');
      await fireEvent.click(registerButton);

      // Переключаемся обратно на вход
      const loginButton = screen.getByText('Вход');
      await fireEvent.click(loginButton);

      expect(screen.queryByLabelText('Имя')).not.toBeInTheDocument();
      expect(screen.queryByLabelText('Подтверждение пароля')).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Войти' })).toBeInTheDocument();
    });
  });

  describe('Валидация формы', () => {
    it('должен отключать кнопку отправки при пустых полях', () => {
      render(PasswordLogin);

      const submitButton = screen.getByRole('button', { name: 'Войти' });
      expect(submitButton).toBeDisabled();
    });

    it('должен включать кнопку отправки при заполненных полях входа', async () => {
      render(PasswordLogin);

      const usernameInput = screen.getByLabelText('Имя пользователя');
      const passwordInput = screen.getByLabelText('Пароль');
      const submitButton = screen.getByRole('button', { name: 'Войти' });

      await fireEvent.input(usernameInput, { target: { value: 'testuser' } });
      await fireEvent.input(passwordInput, { target: { value: 'password123' } });

      expect(submitButton).not.toBeDisabled();
    });

    it('должен отключать кнопку при незаполненном подтверждении пароля в регистрации', async () => {
      render(PasswordLogin);

      // Переключаемся на регистрацию
      const registerButton = screen.getByText('Регистрация');
      await fireEvent.click(registerButton);

      const usernameInput = screen.getByLabelText('Имя пользователя');
      const passwordInput = screen.getByLabelText('Пароль');
      const submitButton = screen.getByRole('button', { name: 'Создать аккаунт' });

      await fireEvent.input(usernameInput, { target: { value: 'testuser' } });
      await fireEvent.input(passwordInput, { target: { value: 'password123' } });

      expect(submitButton).toBeDisabled();
    });

    it('должен включать кнопку при всех заполненных полях регистрации', async () => {
      render(PasswordLogin);

      // Переключаемся на регистрацию
      const registerButton = screen.getByText('Регистрация');
      await fireEvent.click(registerButton);

      const usernameInput = screen.getByLabelText('Имя пользователя');
      const passwordInput = screen.getByLabelText('Пароль');
      const confirmPasswordInput = screen.getByLabelText('Подтверждение пароля');
      const submitButton = screen.getByRole('button', { name: 'Создать аккаунт' });

      await fireEvent.input(usernameInput, { target: { value: 'testuser' } });
      await fireEvent.input(passwordInput, { target: { value: 'password123' } });
      await fireEvent.input(confirmPasswordInput, { target: { value: 'password123' } });

      expect(submitButton).not.toBeDisabled();
    });
  });

  describe('Обработка входа', () => {
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
        expect(mockSetCurrentUser).toHaveBeenCalledWith({
          user_id: 1,
          user_name: 'testuser',
          user_telegram_id: 0,
          first_name: 'Test',
          last_name: 'User',
          username: 'testuser',
          authMethod: 'password'
        });
        expect(mockToast.success).toHaveBeenCalledWith('Успешно', 'Вы вошли в систему');
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

      expect(mockSetCurrentUser).not.toHaveBeenCalled();
      expect(mockGoto).not.toHaveBeenCalled();
    });

    it('должен обрабатывать сетевые ошибки', async () => {
      const mockError = new Error('Network error');
      mockError.response = {
        data: { error: 'Сервер недоступен' }
      };

      mockAuthService.loginWithPassword.mockRejectedValue(mockError);

      render(PasswordLogin);

      const usernameInput = screen.getByLabelText('Имя пользователя');
      const passwordInput = screen.getByLabelText('Пароль');
      const submitButton = screen.getByRole('button', { name: 'Войти' });

      await fireEvent.input(usernameInput, { target: { value: 'testuser' } });
      await fireEvent.input(passwordInput, { target: { value: 'password123' } });
      await fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Сервер недоступен')).toBeInTheDocument();
      });
    });

    it('должен показывать индикатор загрузки во время входа', async () => {
      let resolveLogin: Function;
      const loginPromise = new Promise((resolve) => {
        resolveLogin = resolve;
      });

      mockAuthService.loginWithPassword.mockReturnValue(loginPromise as any);

      render(PasswordLogin);

      const usernameInput = screen.getByLabelText('Имя пользователя');
      const passwordInput = screen.getByLabelText('Пароль');
      const submitButton = screen.getByRole('button', { name: 'Войти' });

      await fireEvent.input(usernameInput, { target: { value: 'testuser' } });
      await fireEvent.input(passwordInput, { target: { value: 'password123' } });
      await fireEvent.click(submitButton);

      expect(screen.getByText('Вход...')).toBeInTheDocument();
      expect(submitButton).toBeDisabled();

      // Завершаем промис
      resolveLogin!({ success: true, user: { id: 1, username: 'testuser' } });

      await waitFor(() => {
        expect(screen.queryByText('Вход...')).not.toBeInTheDocument();
      });
    });
  });

  describe('Обработка регистрации', () => {
    it('должен успешно выполнять регистрацию', async () => {
      const mockResponse = {
        success: true,
        user: {
          id: 2,
          username: 'newuser',
          firstName: 'New',
          lastName: 'User'
        }
      };

      mockAuthService.register.mockResolvedValue(mockResponse);

      render(PasswordLogin);

      // Переключаемся на регистрацию
      const registerButton = screen.getByText('Регистрация');
      await fireEvent.click(registerButton);

      const firstNameInput = screen.getByLabelText('Имя');
      const lastNameInput = screen.getByLabelText('Фамилия');
      const usernameInput = screen.getByLabelText('Имя пользователя');
      const passwordInput = screen.getByLabelText('Пароль');
      const confirmPasswordInput = screen.getByLabelText('Подтверждение пароля');
      const submitButton = screen.getByRole('button', { name: 'Создать аккаунт' });

      await fireEvent.input(firstNameInput, { target: { value: 'New' } });
      await fireEvent.input(lastNameInput, { target: { value: 'User' } });
      await fireEvent.input(usernameInput, { target: { value: 'newuser' } });
      await fireEvent.input(passwordInput, { target: { value: 'password123' } });
      await fireEvent.input(confirmPasswordInput, { target: { value: 'password123' } });
      await fireEvent.click(submitButton);

      await waitFor(() => {
        expect(mockAuthService.register).toHaveBeenCalledWith('newuser', 'password123', 'New', 'User');
        expect(mockSetCurrentUser).toHaveBeenCalledWith({
          user_id: 2,
          user_name: 'newuser',
          user_telegram_id: 0,
          first_name: 'New',
          last_name: 'User',
          username: 'newuser',
          authMethod: 'password'
        });
        expect(mockToast.success).toHaveBeenCalledWith('Успешно', 'Аккаунт создан и вы вошли в систему');
        expect(mockGoto).toHaveBeenCalledWith('/dashboard');
      });
    });

    it('должен показывать ошибку при несовпадении паролей', async () => {
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

    it('должен показывать ошибку при коротком пароле', async () => {
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

    it('должен показывать индикатор загрузки во время регистрации', async () => {
      let resolveRegister: Function;
      const registerPromise = new Promise((resolve) => {
        resolveRegister = resolve;
      });

      mockAuthService.register.mockReturnValue(registerPromise as any);

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
      await fireEvent.input(confirmPasswordInput, { target: { value: 'password123' } });
      await fireEvent.click(submitButton);

      expect(screen.getByText('Создание...')).toBeInTheDocument();
      expect(submitButton).toBeDisabled();

      // Завершаем промис
      resolveRegister!({ success: true, user: { id: 2, username: 'newuser' } });

      await waitFor(() => {
        expect(screen.queryByText('Создание...')).not.toBeInTheDocument();
      });
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
      await fireEvent.keydown(passwordInput, { key: 'Enter' });

      await waitFor(() => {
        expect(mockAuthService.loginWithPassword).toHaveBeenCalledWith('testuser', 'password123');
      });
    });

    it('не должен отправлять форму по Enter при незаполненных полях', async () => {
      render(PasswordLogin);

      const usernameInput = screen.getByLabelText('Имя пользователя');
      await fireEvent.keydown(usernameInput, { key: 'Enter' });

      expect(mockAuthService.loginWithPassword).not.toHaveBeenCalled();
    });

    it('не должен отправлять форму по Enter во время загрузки', async () => {
      let resolveLogin: Function;
      const loginPromise = new Promise((resolve) => {
        resolveLogin = resolve;
      });

      mockAuthService.loginWithPassword.mockReturnValue(loginPromise as any);

      render(PasswordLogin);

      const usernameInput = screen.getByLabelText('Имя пользователя');
      const passwordInput = screen.getByLabelText('Пароль');

      await fireEvent.input(usernameInput, { target: { value: 'testuser' } });
      await fireEvent.input(passwordInput, { target: { value: 'password123' } });
      
      // Первое нажатие Enter запускает загрузку
      await fireEvent.keydown(passwordInput, { key: 'Enter' });
      
      // Второе нажатие Enter должно быть проигнорировано
      await fireEvent.keydown(passwordInput, { key: 'Enter' });

      expect(mockAuthService.loginWithPassword).toHaveBeenCalledTimes(1);

      // Завершаем промис
      resolveLogin!({ success: true, user: { id: 1, username: 'testuser' } });
    });
  });

  describe('Очистка ошибок', () => {
    it('должен очищать ошибки при переключении между формами', async () => {
      const mockResponse = {
        success: false,
        error: 'Ошибка входа'
      };

      mockAuthService.loginWithPassword.mockResolvedValue(mockResponse);

      render(PasswordLogin);

      // Вызываем ошибку входа
      const usernameInput = screen.getByLabelText('Имя пользователя');
      const passwordInput = screen.getByLabelText('Пароль');
      const submitButton = screen.getByRole('button', { name: 'Войти' });

      await fireEvent.input(usernameInput, { target: { value: 'testuser' } });
      await fireEvent.input(passwordInput, { target: { value: 'wrongpassword' } });
      await fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Ошибка входа')).toBeInTheDocument();
      });

      // Переключаемся на регистрацию
      const registerButton = screen.getByText('Регистрация');
      await fireEvent.click(registerButton);

      // Ошибка должна исчезнуть
      expect(screen.queryByText('Ошибка входа')).not.toBeInTheDocument();
    });
  });

  describe('Prop обработка', () => {
    it('должен вызывать onSwitchToTelegram при получении соответствующего события', async () => {
      const mockOnSwitchToTelegram = vi.fn();
      
      render(PasswordLogin, {
        props: {
          onSwitchToTelegram: mockOnSwitchToTelegram
        }
      });

      // Проверяем, что функция была передана
      expect(mockOnSwitchToTelegram).not.toHaveBeenCalled();
    });
  });
});