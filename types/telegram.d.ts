/**
 * Telegram WebApp Types
 * Family Budget PWA - Telegram WebApp Integration
 *
 * Type definitions for Telegram WebApp API (for webapp/ directory).
 *
 * @version 1.0.0
 * @date 2026-01-05
 * @see https://core.telegram.org/bots/webapps
 */

/**
 * Telegram WebApp main interface
 */
interface TelegramWebApp {
  /** Init data from Telegram */
  initData: string;
  initDataUnsafe: TelegramWebAppInitData;

  /** WebApp version */
  version: string;

  /** Platform identifier */
  platform: string;

  /** Color scheme */
  colorScheme: 'light' | 'dark';

  /** Theme parameters */
  themeParams: TelegramThemeParams;

  /** Is WebApp expanded */
  isExpanded: boolean;

  /** Viewport height */
  viewportHeight: number;

  /** Stable viewport height (without keyboard) */
  viewportStableHeight: number;

  /** Header color */
  headerColor: string;

  /** Background color */
  backgroundColor: string;

  /** Main button */
  MainButton: TelegramMainButton;

  /** Back button */
  BackButton: TelegramBackButton;

  /** Cloud Storage */
  CloudStorage: TelegramCloudStorage;

  /** Methods */
  ready(): void;
  expand(): void;
  close(): void;
  showAlert(message: string, callback?: () => void): void;
  showConfirm(message: string, callback?: (confirmed: boolean) => void): void;
  showPopup(params: TelegramPopupParams, callback?: (buttonId: string) => void): void;
  showScanQrPopup(params: TelegramScanQrParams, callback?: (text: string) => boolean): void;
  closeScanQrPopup(): void;

  /** Event handling */
  onEvent(eventType: string, callback: () => void): void;
  offEvent(eventType: string, callback: () => void): void;

  /** Haptic feedback */
  HapticFeedback: TelegramHapticFeedback;

  /** Send data to bot */
  sendData(data: string): void;

  /** Request write access */
  requestWriteAccess(callback?: (granted: boolean) => void): void;

  /** Request contact */
  requestContact(callback?: (granted: boolean, contact?: TelegramContact) => void): void;
}

/**
 * Init data from Telegram
 */
interface TelegramWebAppInitData {
  query_id?: string;
  user?: TelegramUser;
  receiver?: TelegramUser;
  chat?: TelegramChat;
  chat_type?: 'sender' | 'private' | 'group' | 'supergroup' | 'channel';
  chat_instance?: string;
  start_param?: string;
  can_send_after?: number;
  auth_date: number;
  hash: string;
}

/**
 * Telegram user
 */
interface TelegramUser {
  id: number;
  is_bot?: boolean;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  is_premium?: boolean;
  added_to_attachment_menu?: boolean;
  allows_write_to_pm?: boolean;
  photo_url?: string;
}

/**
 * Telegram chat
 */
interface TelegramChat {
  id: number;
  type: 'group' | 'supergroup' | 'channel';
  title: string;
  username?: string;
  photo_url?: string;
}

/**
 * Theme parameters
 */
interface TelegramThemeParams {
  bg_color?: string;
  text_color?: string;
  hint_color?: string;
  link_color?: string;
  button_color?: string;
  button_text_color?: string;
  secondary_bg_color?: string;
}

/**
 * Main button
 */
interface TelegramMainButton {
  text: string;
  color: string;
  textColor: string;
  isVisible: boolean;
  isActive: boolean;
  isProgressVisible: boolean;

  setText(text: string): void;
  onClick(callback: () => void): void;
  offClick(callback: () => void): void;
  show(): void;
  hide(): void;
  enable(): void;
  disable(): void;
  showProgress(leaveActive?: boolean): void;
  hideProgress(): void;
  setParams(params: TelegramMainButtonParams): void;
}

/**
 * Main button parameters
 */
interface TelegramMainButtonParams {
  text?: string;
  color?: string;
  text_color?: string;
  is_active?: boolean;
  is_visible?: boolean;
}

/**
 * Back button
 */
interface TelegramBackButton {
  isVisible: boolean;

  onClick(callback: () => void): void;
  offClick(callback: () => void): void;
  show(): void;
  hide(): void;
}

/**
 * Cloud Storage API
 */
interface TelegramCloudStorage {
  setItem(key: string, value: string, callback?: (error: Error | null, success: boolean) => void): void;
  getItem(key: string, callback: (error: Error | null, value: string | null) => void): void;
  getItems(keys: string[], callback: (error: Error | null, values: Record<string, string>) => void): void;
  removeItem(key: string, callback?: (error: Error | null, success: boolean) => void): void;
  removeItems(keys: string[], callback?: (error: Error | null, success: boolean) => void): void;
  getKeys(callback: (error: Error | null, keys: string[]) => void): void;
}

/**
 * Popup parameters
 */
interface TelegramPopupParams {
  title?: string;
  message: string;
  buttons?: TelegramPopupButton[];
}

/**
 * Popup button
 */
interface TelegramPopupButton {
  id?: string;
  type?: 'default' | 'ok' | 'close' | 'cancel' | 'destructive';
  text?: string;
}

/**
 * Scan QR parameters
 */
interface TelegramScanQrParams {
  text?: string;
}

/**
 * Haptic feedback
 */
interface TelegramHapticFeedback {
  impactOccurred(style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft'): void;
  notificationOccurred(type: 'error' | 'success' | 'warning'): void;
  selectionChanged(): void;
}

/**
 * Contact
 */
interface TelegramContact {
  phone_number: string;
  first_name: string;
  last_name?: string;
  user_id?: number;
}

/**
 * Telegram WebApp namespace (global)
 */
declare namespace Telegram {
  const WebApp: TelegramWebApp;
}
