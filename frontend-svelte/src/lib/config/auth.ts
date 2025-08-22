import { dev } from '$app/environment';
import { browser } from '$app/environment';

export interface AuthConfig {
  botName: string;
  isDevelopmentMode: boolean;
  enableMockAuth: boolean;
  mockUser: {
    id: string;
    first_name: string;
    last_name?: string;
    username?: string;
    photo_url?: string;
  };
}

/**
 * Authentication configuration
 */
export const authConfig: AuthConfig = {
  // Bot name - in production this should be configured properly
  botName: 'familybudget_test_bot',
  
  // Development mode detection
  isDevelopmentMode: dev,
  
  // Enable mock auth when in development and bot is not properly configured
  enableMockAuth: dev && (!browser || !getConfiguredBotName()),
  
  // Mock user data for development
  mockUser: {
    id: '12345678',
    first_name: 'Тестовый',
    last_name: 'Пользователь',
    username: 'test_user',
    photo_url: undefined,
  }
};

/**
 * Gets the configured bot name from environment or default
 */
function getConfiguredBotName(): string | null {
  // In a real environment, this would come from environment variables
  // For now, we check if the bot name looks like a real bot name
  const botName = authConfig.botName;
  
  if (botName && botName.endsWith('_bot') && botName.length > 4) {
    return botName;
  }
  
  return null;
}

/**
 * Checks if we should use mock authentication
 */
export function shouldUseMockAuth(): boolean {
  return authConfig.enableMockAuth || (dev && !getConfiguredBotName());
}

/**
 * Gets the effective bot name for OAuth
 */
export function getEffectiveBotName(): string {
  return getConfiguredBotName() || authConfig.botName;
}

/**
 * Gets mock user data for development
 */
export function getMockUser() {
  return { ...authConfig.mockUser };
}