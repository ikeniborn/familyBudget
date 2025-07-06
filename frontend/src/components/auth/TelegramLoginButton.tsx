import React, { useEffect, useRef } from 'react';
import { useAuthStore } from '../../stores/authStore';
import { useNavigate } from 'react-router-dom';

interface TelegramLoginButtonProps {
  botName: string;
  buttonSize?: 'large' | 'medium' | 'small';
  cornerRadius?: number;
  showAvatar?: boolean;
  dataAuthUrl?: string;
}

declare global {
  interface Window {
    onTelegramAuth: (user: any) => void;
  }
}

export const TelegramLoginButton: React.FC<TelegramLoginButtonProps> = ({
  botName,
  buttonSize = 'large',
  cornerRadius,
  showAvatar = true,
  dataAuthUrl,
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const login = useAuthStore((state) => state.login);
  const navigate = useNavigate();

  useEffect(() => {
    // Define callback function
    window.onTelegramAuth = async (user: any) => {
      try {
        await login(user);
        navigate('/dashboard');
      } catch (error) {
        console.error('Login failed:', error);
      }
    };

    // Create script element
    const script = document.createElement('script');
    script.src = 'https://telegram.org/js/telegram-widget.js?22';
    script.async = true;
    script.setAttribute('data-telegram-login', botName);
    script.setAttribute('data-size', buttonSize);
    
    if (cornerRadius !== undefined) {
      script.setAttribute('data-radius', cornerRadius.toString());
    }
    
    if (dataAuthUrl) {
      script.setAttribute('data-auth-url', dataAuthUrl);
    } else {
      script.setAttribute('data-onauth', 'onTelegramAuth(user)');
    }
    
    script.setAttribute('data-request-access', 'write');
    
    if (!showAvatar) {
      script.setAttribute('data-userpic', 'false');
    }

    // Append script to ref element
    if (ref.current) {
      ref.current.appendChild(script);
    }

    // Cleanup
    return () => {
      if (ref.current && script.parentNode) {
        script.parentNode.removeChild(script);
      }
      (window as any).onTelegramAuth = undefined;
    };
  }, [botName, buttonSize, cornerRadius, showAvatar, dataAuthUrl, login, navigate]);

  return <div ref={ref} className="telegram-login-button" />;
};