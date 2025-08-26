import { writable, readable, derived } from 'svelte/store';
import { browser } from '$app/environment';

export type DeviceType = 'mobile' | 'tablet' | 'desktop';
export type OrientationType = 'portrait' | 'landscape';

interface DeviceState {
  type: DeviceType;
  orientation: OrientationType;
  width: number;
  height: number;
  isTouchDevice: boolean;
  isStandalone: boolean; // PWA mode
}

// Breakpoints for different device types
const BREAKPOINTS = {
  mobile: 640, // < 640px
  tablet: 1024, // 640px - 1024px
  desktop: Infinity // > 1024px
};

function detectDeviceType(width: number): DeviceType {
  if (width < BREAKPOINTS.mobile) return 'mobile';
  if (width < BREAKPOINTS.tablet) return 'tablet';
  return 'desktop';
}

function detectOrientation(width: number, height: number): OrientationType {
  return width > height ? 'landscape' : 'portrait';
}

function detectTouchDevice(): boolean {
  if (!browser) return false;
  
  return (
    'ontouchstart' in window ||
    navigator.maxTouchPoints > 0 ||
    // @ts-ignore
    navigator.msMaxTouchPoints > 0 ||
    window.matchMedia('(pointer: coarse)').matches
  );
}

function detectStandalone(): boolean {
  if (!browser) return false;
  
  return (
    // @ts-ignore
    window.navigator.standalone === true || // iOS Safari
    window.matchMedia('(display-mode: standalone)').matches || // PWA
    window.matchMedia('(display-mode: fullscreen)').matches
  );
}

function createDeviceStore() {
  const getInitialState = (): DeviceState => {
    if (!browser) {
      return {
        type: 'desktop',
        orientation: 'landscape',
        width: 1920,
        height: 1080,
        isTouchDevice: false,
        isStandalone: false
      };
    }

    const width = window.innerWidth;
    const height = window.innerHeight;

    return {
      type: detectDeviceType(width),
      orientation: detectOrientation(width, height),
      width,
      height,
      isTouchDevice: detectTouchDevice(),
      isStandalone: detectStandalone()
    };
  };

  const { subscribe, set } = writable<DeviceState>(getInitialState());

  if (browser) {
    // Handle resize events with debouncing
    let resizeTimer: number;
    const handleResize = () => {
      clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => {
        const width = window.innerWidth;
        const height = window.innerHeight;
        
        set({
          type: detectDeviceType(width),
          orientation: detectOrientation(width, height),
          width,
          height,
          isTouchDevice: detectTouchDevice(),
          isStandalone: detectStandalone()
        });
      }, 150); // Debounce resize events
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);
    
    // Handle PWA install state changes
    window.matchMedia('(display-mode: standalone)').addEventListener('change', handleResize);
  }

  return {
    subscribe
  };
}

// Main device store
export const deviceStore = createDeviceStore();

// Convenient derived stores
export const isMobile = derived(deviceStore, ($device) => $device.type === 'mobile');
export const isTablet = derived(deviceStore, ($device) => $device.type === 'tablet');
export const isDesktop = derived(deviceStore, ($device) => $device.type === 'desktop');
export const isMobileOrTablet = derived(deviceStore, ($device) => 
  $device.type === 'mobile' || $device.type === 'tablet'
);
export const isTouch = derived(deviceStore, ($device) => $device.isTouchDevice);
export const isPWA = derived(deviceStore, ($device) => $device.isStandalone);

// Media query utilities
export function createMediaQuery(query: string) {
  return readable(false, (set) => {
    if (!browser) return;
    
    const mediaQuery = window.matchMedia(query);
    const handleChange = (e: MediaQueryListEvent | MediaQueryList) => {
      set(e.matches);
    };
    
    // Set initial value
    handleChange(mediaQuery);
    
    // Modern browsers
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }
    
    // Legacy browsers
    // @ts-ignore
    mediaQuery.addListener(handleChange);
    // @ts-ignore
    return () => mediaQuery.removeListener(handleChange);
  });
}

// Common media queries
export const prefersReducedMotion = createMediaQuery('(prefers-reduced-motion: reduce)');
export const prefersDarkMode = createMediaQuery('(prefers-color-scheme: dark)');
export const supportsHover = createMediaQuery('(hover: hover)');

// Utility functions
export function getDeviceClasses($device: DeviceState): string[] {
  const classes = [
    `device-${$device.type}`,
    `orientation-${$device.orientation}`
  ];
  
  if ($device.isTouchDevice) classes.push('touch-device');
  if ($device.isStandalone) classes.push('pwa-mode');
  
  return classes;
}