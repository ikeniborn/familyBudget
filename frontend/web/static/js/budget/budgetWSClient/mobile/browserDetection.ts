/**
 * Browser Detection Module
 * Detects iOS devices and browser quirks
 *
 * Extracted from budgetWSClient.js:234-267 (BROWSER DETECTION)
 */

/**
 * Detect ANY iOS/iPadOS device regardless of browser
 * All iOS browsers use WebKit engine (Apple requirement)
 * Web Locks API is unreliable on all iOS browsers
 * Chrome iOS (CriOS), Firefox iOS (FxiOS), Edge iOS (EdgiOS) all have same issues
 */
export function detectIOSDevice(): boolean {
  const ua = navigator.userAgent;

  // Standard iOS detection
  const isIOS = /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream;

  // iPadOS in desktop mode (reports as MacIntel but has touch)
  const isPadOSDesktop = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;

  return isIOS || isPadOSDesktop;
}

/**
 * Check if browser needs longer Web Locks timeout
 */
export function needsLongerTimeout(): boolean {
  const ua = navigator.userAgent;
  const isSafari = /Safari/.test(ua) && !/Chrome/.test(ua) && !/Chromium/.test(ua);
  const isYandex = /YaBrowser/.test(ua);
  return isSafari || isYandex;
}

/**
 * Detect browser type
 */
export function detectBrowserType(): {
  isSafari: boolean;
  isChrome: boolean;
  isFirefox: boolean;
  isEdge: boolean;
  isYandex: boolean;
  isIOS: boolean;
} {
  const ua = navigator.userAgent;

  return {
    isSafari: /Safari/.test(ua) && !/Chrome/.test(ua) && !/Chromium/.test(ua),
    isChrome: /Chrome/.test(ua) && !/Chromium/.test(ua) && !/Edg/.test(ua),
    isFirefox: /Firefox/.test(ua),
    isEdge: /Edg/.test(ua),
    isYandex: /YaBrowser/.test(ua),
    isIOS: detectIOSDevice(),
  };
}

/**
 * Get browser info for state initialization
 */
export function getBrowserInfo(): {
  isSafari: boolean;
  isChrome: boolean;
  isFirefox: boolean;
  isEdge: boolean;
  isYandex: boolean;
  isIOS: boolean;
  needsLongerTimeout: boolean;
} {
  const browserType = detectBrowserType();
  return {
    ...browserType,
    needsLongerTimeout: needsLongerTimeout(),
  };
}
