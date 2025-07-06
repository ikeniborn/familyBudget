import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { TelegramLoginButton } from '../../components/auth/TelegramLoginButton';

const LoginPage: React.FC = () => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const error = useAuthStore((state) => state.error);

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
        </div>
      </div>
    </div>
  );
};

export default LoginPage;