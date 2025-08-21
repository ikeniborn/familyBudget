import { writable } from 'svelte/store';
import { browser } from '$app/environment';

interface PWAState {
  isInstallable: boolean;
  isInstalled: boolean;
  isOffline: boolean;
  hasUpdate: boolean;
  isUpdating: boolean;
  registration: ServiceWorkerRegistration | null;
  networkStatus: 'online' | 'offline' | 'slow';
  installPromptEvent: any;
}

const initialState: PWAState = {
  isInstallable: false,
  isInstalled: false,
  isOffline: false,
  hasUpdate: false,
  isUpdating: false,
  registration: null,
  networkStatus: 'online',
  installPromptEvent: null
};

function createPWAStore() {
  const { subscribe, set, update } = writable<PWAState>(initialState);

  return {
    subscribe,
    
    // Initialize PWA functionality
    init: () => {
      if (!browser) return;

      update(state => ({
        ...state,
        isInstalled: window.matchMedia('(display-mode: standalone)').matches ||
                     (window.navigator as any).standalone ||
                     document.referrer.includes('android-app://'),
        isOffline: !navigator.onLine
      }));

      // Network status monitoring
      const updateNetworkStatus = () => {
        const connection = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
        let networkStatus: 'online' | 'offline' | 'slow' = 'online';

        if (!navigator.onLine) {
          networkStatus = 'offline';
        } else if (connection) {
          // Consider connection slow if effective type is 'slow-2g' or 'slow-3g'
          const effectiveType = connection.effectiveType;
          if (effectiveType === 'slow-2g' || effectiveType === '2g') {
            networkStatus = 'slow';
          }
        }

        update(state => ({
          ...state,
          isOffline: !navigator.onLine,
          networkStatus
        }));
      };

      window.addEventListener('online', updateNetworkStatus);
      window.addEventListener('offline', updateNetworkStatus);

      // Connection change monitoring
      const connection = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
      if (connection) {
        connection.addEventListener('change', updateNetworkStatus);
      }

      // Service Worker registration
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/sw.js')
          .then(registration => {
            update(state => ({ ...state, registration }));

            // Check for updates
            registration.addEventListener('updatefound', () => {
              const newWorker = registration.installing;
              if (newWorker) {
                newWorker.addEventListener('statechange', () => {
                  if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                    update(state => ({ ...state, hasUpdate: true }));
                  }
                });
              }
            });
          })
          .catch(error => {
            console.error('Service Worker registration failed:', error);
          });
      }

      // PWA install prompt
      window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        update(state => ({
          ...state,
          isInstallable: true,
          installPromptEvent: e
        }));
      });

      // App installed
      window.addEventListener('appinstalled', () => {
        update(state => ({
          ...state,
          isInstalled: true,
          isInstallable: false,
          installPromptEvent: null
        }));
      });

      updateNetworkStatus();
    },

    // Trigger app installation
    install: async () => {
      return new Promise((resolve, reject) => {
        update(state => {
          if (state.installPromptEvent) {
            state.installPromptEvent.prompt();
            state.installPromptEvent.userChoice.then((choiceResult: any) => {
              if (choiceResult.outcome === 'accepted') {
                update(s => ({
                  ...s,
                  isInstallable: false,
                  installPromptEvent: null
                }));
                resolve(true);
              } else {
                reject(new Error('Installation cancelled by user'));
              }
            });
          } else {
            reject(new Error('No install prompt available'));
          }
          return state;
        });
      });
    },

    // Update service worker
    updateApp: async () => {
      return new Promise((resolve, reject) => {
        update(state => {
          if (state.registration?.waiting) {
            state.isUpdating = true;
            
            // Tell the service worker to skip waiting
            state.registration.waiting.postMessage({ type: 'SKIP_WAITING' });

            // Listen for controller change
            const handleControllerChange = () => {
              update(s => ({ ...s, isUpdating: false, hasUpdate: false }));
              window.location.reload();
              resolve(true);
            };

            navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange, {
              once: true
            });

            // Timeout fallback
            setTimeout(() => {
              if (state.isUpdating) {
                window.location.reload();
                resolve(true);
              }
            }, 3000);
          } else {
            reject(new Error('No update available'));
          }
          return state;
        });
      });
    },

    // Dismiss install prompt
    dismissInstall: () => {
      update(state => ({
        ...state,
        isInstallable: false,
        installPromptEvent: null
      }));
      
      // Remember dismissal
      if (browser) {
        localStorage.setItem('pwa-install-dismissed', Date.now().toString());
      }
    },

    // Dismiss update prompt
    dismissUpdate: () => {
      update(state => ({
        ...state,
        hasUpdate: false
      }));
    },

    // Check for app updates manually
    checkForUpdates: async () => {
      return new Promise((resolve, reject) => {
        update(state => {
          if (state.registration) {
            state.registration.update()
              .then(() => resolve(true))
              .catch(reject);
          } else {
            reject(new Error('No service worker registration'));
          }
          return state;
        });
      });
    },

    // Get network speed estimate
    getNetworkSpeed: () => {
      if (!browser) return 'unknown';
      
      const connection = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
      if (connection) {
        return connection.effectiveType || 'unknown';
      }
      return 'unknown';
    },

    // Check if feature should be disabled due to network conditions
    shouldOptimizeForNetwork: () => {
      let shouldOptimize = false;
      update(state => {
        shouldOptimize = state.networkStatus === 'slow' || state.isOffline;
        return state;
      });
      return shouldOptimize;
    }
  };
}

export const pwaStore = createPWAStore();