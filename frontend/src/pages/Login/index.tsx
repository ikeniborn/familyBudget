import React, { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { TelegramLoginButton } from '../../components/auth/TelegramLoginButton';
import { authService } from '../../services/authService';

const LoginPage: React.FC = () => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const error = useAuthStore((state) => state.error);
  const navigate = useNavigate();
  const [passwordAuthEnabled, setPasswordAuthEnabled] = useState(false);

  useEffect(() => {
    // Check if password auth is enabled
    authService.checkPasswordAuthEnabled()
      .then(response => setPasswordAuthEnabled(response.enabled))
      .catch(console.error);
  }, []);

  // If already authenticated, redirect to dashboard
  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  const botName = import.meta.env.VITE_TELEGRAM_BOT_NAME || 'YourBotName';

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Вход в систему
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Используйте свой Telegram аккаунт для входа
          </p>
        </div>
        
        <div className="mt-8 space-y-6">
          {error && (
            <div className="rounded-md bg-red-50 p-4">
              <div className="text-sm text-red-800">{error}</div>
            </div>
          )}
          
          <div className="flex justify-center">
            <TelegramLoginButton
              botName={botName}
              buttonSize="large"
              cornerRadius={20}
              showAvatar={true}
            />
          </div>
          
          <div className="text-center text-sm text-gray-500">
            <p>После входа через Telegram вы будете перенаправлены в личный кабинет</p>
          </div>
          
          {passwordAuthEnabled && (
            <div className="mt-6">
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-300" />
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-gray-50 text-gray-500">Или</span>
                </div>
              </div>
              
              <div className="mt-6">
                <button
                  onClick={() => navigate('/login/password')}
                  className="w-full flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  Войти с логином и паролем
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default LoginPage;