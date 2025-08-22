import { browser } from '$app/environment';
import { dev } from '$app/environment';
import crypto from 'crypto';
import { shouldUseMockAuth, getMockUser } from '$lib/config/auth';

export interface TelegramAuthData {
  id: string;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
}

/**
 * Generates Telegram OAuth URL for redirect-based authentication
 */
export function generateTelegramOAuthUrl(botName: string, returnUrl?: string): string {
  if (!browser) return '';
  
  const baseUrl = `https://oauth.telegram.org/auth`;
  const params = new URLSearchParams({
    bot_id: botName,
    origin: window.location.origin,
    return_to: returnUrl || `${window.location.origin}/auth/callback`,
  });
  
  return `${baseUrl}?${params.toString()}`;
}

/**
 * Parses Telegram auth data from URL hash fragment
 * URL format: #tgAuthResult={...telegram_data}
 */
export function parseTelegramAuthFromUrl(url: string = ''): TelegramAuthData | null {
  try {
    const urlObj = new URL(url || (browser ? window.location.href : ''));
    const hash = urlObj.hash;
    
    if (!hash.startsWith('#tgAuthResult=')) {
      return null;
    }
    
    const authResultJson = decodeURIComponent(hash.substring('#tgAuthResult='.length));
    const authData = JSON.parse(authResultJson);
    
    // Validate required fields
    if (!authData.id || !authData.first_name || !authData.auth_date || !authData.hash) {
      return null;
    }
    
    return {
      id: authData.id.toString(),
      first_name: authData.first_name,
      last_name: authData.last_name,
      username: authData.username,
      photo_url: authData.photo_url,
      auth_date: parseInt(authData.auth_date),
      hash: authData.hash
    };
  } catch (error) {
    console.error('Failed to parse Telegram auth data from URL:', error);
    return null;
  }
}

/**
 * Parses Telegram auth data from URL query parameters
 * This is alternative format that some Telegram OAuth implementations use
 */
export function parseTelegramAuthFromQuery(url: string = ''): TelegramAuthData | null {
  try {
    const urlObj = new URL(url || (browser ? window.location.href : ''));
    const params = urlObj.searchParams;
    
    const id = params.get('id');
    const firstName = params.get('first_name');
    const authDate = params.get('auth_date');
    const hash = params.get('hash');
    
    if (!id || !firstName || !authDate || !hash) {
      return null;
    }
    
    return {
      id: id,
      first_name: firstName,
      last_name: params.get('last_name') || undefined,
      username: params.get('username') || undefined,
      photo_url: params.get('photo_url') || undefined,
      auth_date: parseInt(authDate),
      hash: hash
    };
  } catch (error) {
    console.error('Failed to parse Telegram auth data from query:', error);
    return null;
  }
}

/**
 * Validates Telegram auth hash (client-side check)
 * Note: This should always be verified on the server side for security
 */
export function validateTelegramAuthHash(data: TelegramAuthData, botToken: string): boolean {
  if (!botToken || dev) {
    // Skip validation in development or when bot token is not available
    return true;
  }
  
  try {
    // Create data check string (all parameters except hash, sorted alphabetically)
    const checkData: { [key: string]: string } = {};
    
    if (data.id) checkData.id = data.id.toString();
    if (data.first_name) checkData.first_name = data.first_name;
    if (data.last_name) checkData.last_name = data.last_name;
    if (data.username) checkData.username = data.username;
    if (data.photo_url) checkData.photo_url = data.photo_url;
    if (data.auth_date) checkData.auth_date = data.auth_date.toString();
    
    const dataCheckString = Object.keys(checkData)
      .sort()
      .map(key => `${key}=${checkData[key]}`)
      .join('\n');
    
    // Create secret key
    const secretKey = crypto.createHash('sha256').update(botToken).digest();
    
    // Create hash
    const hash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
    
    return hash === data.hash;
  } catch (error) {
    console.error('Failed to validate Telegram auth hash:', error);
    return false;
  }
}

/**
 * Creates mock Telegram auth data for development
 */
export function createMockTelegramAuth(): TelegramAuthData {
  const now = Math.floor(Date.now() / 1000);
  const mockUser = getMockUser();
  
  return {
    id: mockUser.id,
    first_name: mockUser.first_name,
    last_name: mockUser.last_name,
    username: mockUser.username,
    photo_url: mockUser.photo_url,
    auth_date: now,
    hash: 'mock_hash_' + now // Mock hash for development
  };
}

/**
 * Checks if the auth data is expired (older than 24 hours)
 */
export function isAuthDataExpired(authDate: number): boolean {
  const now = Math.floor(Date.now() / 1000);
  const maxAge = 24 * 60 * 60; // 24 hours in seconds
  return (now - authDate) > maxAge;
}

/**
 * Redirects to Telegram OAuth or handles development mode
 */
export function startTelegramOAuth(botName: string, returnUrl?: string): void {
  if (!browser) return;
  
  if (shouldUseMockAuth()) {
    // Development mode - redirect to callback with mock data
    console.log('Development mode: Using mock Telegram auth');
    const mockData = createMockTelegramAuth();
    const callbackUrl = new URL('/auth/callback', window.location.origin);
    
    // Add return URL as state parameter if provided
    if (returnUrl) {
      callbackUrl.searchParams.set('state', returnUrl);
    }
    
    callbackUrl.hash = `#tgAuthResult=${encodeURIComponent(JSON.stringify(mockData))}`;
    window.location.href = callbackUrl.toString();
    return;
  }
  
  // Production mode - redirect to actual Telegram OAuth
  const oauthUrl = generateTelegramOAuthUrl(botName, returnUrl);
  window.location.href = oauthUrl;
}