/**
 * Push Notification Manager для Family Budget PWA
 * Управление Push Notifications для уведомлений о синхронизации
 *
 * Browser Support:
 * - Chrome/Edge: ✅ Full support
 * - Safari 16.4+: ✅ Full support
 * - Яндекс.Браузер: ✅ Full support
 *
 * @version 1.0.0
 */

class PushNotificationManager {
    constructor() {
        this.vapidPublicKey = null; // Will be loaded from server
        this.subscription = null;
        this.isSupported = this.checkSupport();
    }

    /**
     * Check if Push Notifications are supported
     * @returns {boolean}
     */
    checkSupport() {
        return 'Notification' in window &&
               'serviceWorker' in navigator &&
               'PushManager' in window;
    }

    /**
     * Initialize Push Manager
     * @param {Object} options - Initialization options
     * @param {boolean} options.requestPermission - Request permission on init (default: false)
     */
    async init(options = {}) {
        if (!this.isSupported) {
            return false;
        }

        // Load VAPID public key from server
        try {
            await this.loadVapidKey();
        } catch (error) {
            return false;
        }

        // Check if VAPID key is valid (may have been invalidated in loadVapidKey)
        if (!this.isSupported || !this.vapidPublicKey) {
            // Push not configured on server - silently disable
            return false;
        }

        // Check current permission
        if (Notification.permission === 'granted') {
            try {
                await this.subscribe();
            } catch (error) {
                // Subscription failed - don't break initialization
                console.warn('[Push] Subscription failed:', error.message);
                return false;
            }
        } else if (Notification.permission === 'default') {
            // Request permission if requested (requires user gesture on iOS)
            if (options.requestPermission) {
                await this.requestPermission();
            }
        }

        return true;
    }

    /**
     * Load VAPID public key from backend
     * @private
     */
    async loadVapidKey() {
        try {
            const response = await fetch('/api/v1/push/vapid-key', {
                credentials: 'include'
            });

            if (!response.ok) {
                throw new Error('Failed to load VAPID key');
            }

            const data = await response.json();
            this.vapidPublicKey = data.public_key;

            // Validate VAPID key format (should be base64url, 65+ chars)
            if (!this.vapidPublicKey || this.vapidPublicKey.length < 65 ||
                this.vapidPublicKey.includes('PLACEHOLDER') ||
                this.vapidPublicKey.includes('0123456789')) {
                this.vapidPublicKey = null;
                this.isSupported = false;
                return;
            }
        } catch (error) {
            throw error;
        }
    }

    /**
     * Request notification permission
     * @returns {Promise<boolean>} true if granted
     */
    async requestPermission() {
        if (!this.isSupported) {
            return false;
        }

        if (Notification.permission === 'granted') {
            return true;
        }

        const permission = await Notification.requestPermission();

        if (permission === 'granted') {
            await this.subscribe();
            return true;
        } else {
            return false;
        }
    }

    /**
     * Subscribe to push notifications
     * @returns {Promise<PushSubscription>}
     */
    async subscribe() {
        if (!this.isSupported) {
            throw new Error('Push Notifications not supported');
        }

        if (!this.vapidPublicKey) {
            await this.loadVapidKey();
        }

        try {
            const registration = await navigator.serviceWorker.ready;

            // Check if already subscribed
            let subscription = await registration.pushManager.getSubscription();

            if (!subscription) {
                // Create new subscription
                subscription = await registration.pushManager.subscribe({
                    userVisibleOnly: true,
                    applicationServerKey: this.urlBase64ToUint8Array(this.vapidPublicKey)
                });
            }

            this.subscription = subscription;

            // Send subscription to backend
            await this.sendSubscriptionToBackend(subscription);

            return subscription;
        } catch (error) {
            throw error;
        }
    }

    /**
     * Unsubscribe from push notifications
     * @returns {Promise<boolean>}
     */
    async unsubscribe() {
        if (!this.isSupported) {
            return false;
        }

        try {
            const registration = await navigator.serviceWorker.ready;
            const subscription = await registration.pushManager.getSubscription();

            if (subscription) {
                await subscription.unsubscribe();

                // Remove subscription from backend
                await this.removeSubscriptionFromBackend(subscription);

                this.subscription = null;
                return true;
            }

            return false;
        } catch (error) {
            throw error;
        }
    }

    /**
     * Send subscription to backend
     * @private
     */
    async sendSubscriptionToBackend(subscription) {
        try {
            const response = await fetch('/api/v1/push/subscribe', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    subscription: subscription.toJSON(),
                    user_agent: navigator.userAgent
                }),
                credentials: 'include'
            });

            if (!response.ok) {
                throw new Error('Failed to send subscription to backend');
            }
        } catch (error) {
            throw error;
        }
    }

    /**
     * Remove subscription from backend
     * @private
     */
    async removeSubscriptionFromBackend(subscription) {
        try {
            const response = await fetch('/api/v1/push/unsubscribe', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    subscription: subscription.toJSON()
                }),
                credentials: 'include'
            });

            if (!response.ok) {
                throw new Error('Failed to remove subscription from backend');
            }
        } catch (error) {
            throw error;
        }
    }

    /**
     * Show local notification (without push)
     * @param {string} title - Notification title
     * @param {Object} options - Notification options
     */
    async showLocalNotification(title, options = {}) {
        if (!this.isSupported || Notification.permission !== 'granted') {
            return;
        }

        try {
            const registration = await navigator.serviceWorker.ready;

            await registration.showNotification(title, {
                icon: '/static/icons/icon-192.png',
                badge: '/static/icons/icon-192.png',
                requireInteraction: false,
                ...options
            });
        } catch (error) {
            // Ignore notification errors
        }
    }

    /**
     * Notify sync completed
     * @param {number} count - Number of synced items
     */
    async notifySyncCompleted(count) {
        await this.showLocalNotification('Синхронизация завершена', {
            body: `Синхронизировано записей: ${count}`,
            tag: 'sync-completed',
            icon: '/static/icons/icon-192.png',
            badge: '/static/icons/icon-192.png',
            data: { type: 'sync_completed', count }
        });
    }

    /**
     * Notify sync failed
     * @param {number} count - Number of failed items
     */
    async notifySyncFailed(count) {
        await this.showLocalNotification('Ошибка синхронизации', {
            body: `Не удалось синхронизировать ${count} записей`,
            tag: 'sync-failed',
            icon: '/static/icons/icon-192.png',
            badge: '/static/icons/icon-192.png',
            requireInteraction: true,
            data: { type: 'sync_failed', count }
        });
    }

    /**
     * Notify network restored
     */
    async notifyNetworkRestored() {
        await this.showLocalNotification('Соединение восстановлено', {
            body: 'Начинаем синхронизацию...',
            tag: 'network-restored',
            icon: '/static/icons/icon-192.png',
            data: { type: 'network_restored' }
        });
    }

    /**
     * Convert VAPID key from base64 to Uint8Array
     * @private
     */
    urlBase64ToUint8Array(base64String) {
        const padding = '='.repeat((4 - base64String.length % 4) % 4);
        const base64 = (base64String + padding)
            .replace(/-/g, '+')
            .replace(/_/g, '/');

        const rawData = window.atob(base64);
        const outputArray = new Uint8Array(rawData.length);

        for (let i = 0; i < rawData.length; ++i) {
            outputArray[i] = rawData.charCodeAt(i);
        }

        return outputArray;
    }

    /**
     * Get current subscription status
     * @returns {Promise<Object>}
     */
    async getStatus() {
        if (!this.isSupported) {
            return {
                supported: false,
                permission: null,
                subscribed: false
            };
        }

        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();

        return {
            supported: true,
            permission: Notification.permission,
            subscribed: !!subscription,
            subscription: subscription ? subscription.toJSON() : null
        };
    }
}

// Export as global
if (typeof window !== 'undefined') {
    window.PushNotificationManager = PushNotificationManager;
}
