/**
 * Push Notification Manager для Family Budget PWA
 * Управление Push Notifications для уведомлений о синхронизации
 *
 * Browser Support:
 * - Chrome/Edge: ✅ Full support
 * - Safari 16.4+: ✅ Full support
 * - Яндекс.Браузер: ✅ Full support
 *
 * @version 2.0.0
 * @date 2026-01-05
 */

interface PushManagerInitOptions {
    requestPermission?: boolean;
}

interface VapidKeyResponse {
    configured?: boolean;
    public_key?: string;
}

interface PushStatusResponse {
    supported: boolean;
    configured: boolean;
    permission: NotificationPermission | null;
    subscribed: boolean;
    subscription?: PushSubscriptionJSON | null;
}

interface NotificationOptions {
    body?: string;
    tag?: string;
    icon?: string;
    badge?: string;
    requireInteraction?: boolean;
    data?: any;
}

class PushNotificationManager {
    private vapidPublicKey: string | null = null;
    private subscription: PushSubscription | null = null;
    private isSupported: boolean;

    constructor() {
        this.isSupported = this.checkSupport();
    }

    /**
     * Check if Push Notifications are supported
     */
    checkSupport(): boolean {
        return 'Notification' in window &&
               'serviceWorker' in navigator &&
               'PushManager' in window;
    }

    /**
     * Initialize Push Manager
     * @param options - Initialization options
     */
    async init(options: PushManagerInitOptions = {}): Promise<boolean> {
        if (!this.isSupported) {
            this._updateUI();  // Update UI to hide button
            return false;
        }

        // Load VAPID public key from server
        try {
            await this.loadVapidKey();
        } catch (error) {
            console.error('[Push] Failed to load VAPID key:', error);
            this._updateUI();  // Update UI to hide button
            return false;
        }

        // Check if VAPID key is valid (may have been invalidated in loadVapidKey)
        if (!this.isSupported || !this.vapidPublicKey) {
            // Push not configured on server - silently disable
            this._updateUI();  // Update UI to hide button
            return false;
        }

        // Check current permission
        if (Notification.permission === 'granted') {
            try {
                await this.subscribe();
            } catch (error) {
                // Subscription failed - don't break initialization
                console.error('[Push] Auto-subscription failed:', error);
                this._updateUI();  // Update UI to show button (even if subscription failed)
                return false;
            }
        } else if (Notification.permission === 'default') {
            // Request permission if requested (requires user gesture on iOS)
            if (options.requestPermission) {
                await this.requestPermission();
            }
        }

        // CRITICAL FIX: Update UI after successful initialization
        // This shows the push bell button after VAPID key is loaded
        this._updateUI();
        return true;
    }

    /**
     * Load VAPID public key from backend
     */
    private async loadVapidKey(): Promise<void> {
        try {
            const response = await fetch('/api/v1/push/vapid-key', {
                credentials: 'include'
            });

            if (!response.ok) {
                throw new Error('Failed to load VAPID key');
            }

            const data: VapidKeyResponse = await response.json();

            // Check if push notifications are configured on server
            if (data.configured === false || !data.public_key) {
                this.vapidPublicKey = null;
                this.isSupported = false;
                return;
            }

            this.vapidPublicKey = data.public_key;

            // Validate VAPID key format (should be base64url, 65+ chars)
            if (!this.vapidPublicKey || this.vapidPublicKey.length < 65 ||
                this.vapidPublicKey.includes('PLACEHOLDER') ||
                this.vapidPublicKey.includes('0123456789')) {
                console.error('[Push] Invalid VAPID key format');
                this.vapidPublicKey = null;
                this.isSupported = false;
                return;
            }
        } catch (error) {
            console.error('[Push] loadVapidKey failed:', error);
            throw error;
        }
    }

    /**
     * Request notification permission
     * @returns true if granted
     */
    async requestPermission(): Promise<boolean> {
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
     */
    async subscribe(): Promise<PushSubscription> {
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
                const applicationServerKey = this.urlBase64ToUint8Array(this.vapidPublicKey!);
                subscription = await registration.pushManager.subscribe({
                    userVisibleOnly: true,
                    applicationServerKey: applicationServerKey as BufferSource
                });
            }

            this.subscription = subscription;

            // Send subscription to backend
            await this.sendSubscriptionToBackend(subscription);

            return subscription;
        } catch (error) {
            console.error('[Push] subscribe failed:', error);
            throw error;
        }
    }

    /**
     * Unsubscribe from push notifications
     */
    async unsubscribe(): Promise<boolean> {
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
            console.error('[Push] unsubscribe failed:', error);
            throw error;
        }
    }

    /**
     * Send subscription to backend
     */
    private async sendSubscriptionToBackend(subscription: PushSubscription): Promise<void> {
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
     */
    private async removeSubscriptionFromBackend(subscription: PushSubscription): Promise<void> {
        try {
            const response = await fetch('/api/v1/push/unsubscribe', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    subscription: subscription.toJSON(),
                    user_agent: navigator.userAgent
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
     * @param title - Notification title
     * @param options - Notification options
     */
    async showLocalNotification(title: string, options: NotificationOptions = {}): Promise<void> {
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
     * @param count - Number of synced items
     */
    async notifySyncCompleted(count: number): Promise<void> {
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
     * @param count - Number of failed items
     */
    async notifySyncFailed(count: number): Promise<void> {
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
    async notifyNetworkRestored(): Promise<void> {
        await this.showLocalNotification('Соединение восстановлено', {
            body: 'Начинаем синхронизацию...',
            tag: 'network-restored',
            icon: '/static/icons/icon-192.png',
            data: { type: 'network_restored' }
        });
    }

    /**
     * Convert VAPID key from base64 to Uint8Array
     */
    private urlBase64ToUint8Array(base64String: string): Uint8Array {
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
     */
    async getStatus(): Promise<PushStatusResponse> {
        if (!this.isSupported) {
            return {
                supported: false,
                configured: false,
                permission: null,
                subscribed: false
            };
        }

        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();

        return {
            supported: true,
            configured: !!this.vapidPublicKey,
            permission: Notification.permission,
            subscribed: !!subscription,
            subscription: subscription ? subscription.toJSON() : null
        };
    }

    /**
     * Toggle subscription state (for UI button)
     * @returns New subscription state
     */
    async toggleSubscription(): Promise<boolean> {
        this._setButtonLoading(true);

        try {
            const status = await this.getStatus();

            if (status.subscribed) {
                await this.unsubscribe();
            } else {
                // Check if permission is already granted
                if (Notification.permission === 'granted') {
                    // Permission already granted, just subscribe
                    await this.subscribe();
                } else {
                    // Need to request permission first
                    const granted = await this.requestPermission();
                    if (!granted) {
                        this._updateUI();
                        return false;
                    }
                }
            }

            this._updateUI();
            return (await this.getStatus()).subscribed;
        } catch (error) {
            console.error('[Push] toggleSubscription failed:', error);
            this._updateUI();

            // Show user-friendly error message
            if (window.showToast) {
                window.showToast(
                    'Ошибка при изменении подписки на уведомления. Попробуйте позже.',
                    'error'
                );
            }

            return false;
        } finally {
            this._setButtonLoading(false);
        }
    }

    /**
     * Update UI elements based on current state
     */
    private _updateUI(): void {
        const bellBtn = document.getElementById('push-bell-btn');
        const bellIcon = document.getElementById('push-bell-icon');
        const bellTooltip = document.getElementById('push-bell-tooltip');

        if (!bellBtn) return;

        // Show/hide based on support and configuration
        if (!this.isSupported) {
            bellBtn.classList.add('hidden');
            if (bellTooltip) bellTooltip.textContent = 'Push-уведомления не поддерживаются';
            return;
        }

        if (!this.vapidPublicKey) {
            bellBtn.classList.add('hidden');
            if (bellTooltip) bellTooltip.textContent = 'Push-уведомления не настроены';
            return;
        }

        bellBtn.classList.remove('hidden');
        const permission = Notification.permission;

        // Update icon based on subscription state
        if (bellIcon) {
            if (permission === 'denied') {
                // Permission denied - show muted bell
                bellIcon.innerHTML = `<path stroke-linecap="round" stroke-linejoin="round" d="M9.143 17.082a24.248 24.248 0 0 0 3.844.148m-3.844-.148a23.856 23.856 0 0 1-5.455-1.31 8.964 8.964 0 0 0 2.3-5.542m3.155 6.852a3 3 0 0 0 5.667 1.97m-5.667-1.97a24.25 24.25 0 0 0 3.844.148m0 0c.99-.009 1.977-.052 2.955-.13a4.503 4.503 0 0 0 1.976-7.294m-8.775 7.276c-1.632-.139-3.241-.376-4.819-.707m8.82.707a4.485 4.485 0 0 0-1.255-8.774" /><path stroke-linecap="round" stroke-linejoin="round" d="M3 3l18 18" />`;
                bellBtn.classList.remove('text-primary');
                bellBtn.classList.add('text-error');
                if (bellTooltip) bellTooltip.textContent = 'Push-уведомления заблокированы';
            } else if (this.subscription) {
                // Subscribed - filled bell with color
                bellIcon.innerHTML = `<path stroke-linecap="round" stroke-linejoin="round" d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" />`;
                bellBtn.classList.add('text-primary');
                bellBtn.classList.remove('text-error');
                if (bellTooltip) bellTooltip.textContent = 'Push-уведомления включены';
            } else {
                // Not subscribed - outline bell
                bellIcon.innerHTML = `<path stroke-linecap="round" stroke-linejoin="round" d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" />`;
                bellBtn.classList.remove('text-primary', 'text-error');
                if (bellTooltip) bellTooltip.textContent = 'Включить push-уведомления';
            }
        }
    }

    /**
     * Set loading state for push button
     * @param isLoading - Whether button should show loading state
     */
    private _setButtonLoading(isLoading: boolean): void {
        const bellBtn = document.getElementById('push-bell-btn') as HTMLButtonElement | null;
        if (!bellBtn) return;

        if (isLoading) {
            bellBtn.disabled = true;
            bellBtn.classList.add('loading');
        } else {
            bellBtn.disabled = false;
            bellBtn.classList.remove('loading');
        }
    }
}

// Export as global
if (typeof window !== 'undefined') {
    window.PushNotificationManager = PushNotificationManager;
    // Create singleton instance
    // NOTE: Cannot use 'pushManager' - conflicts with Safari iOS native PushManager API
    window.budgetPushManager = new PushNotificationManager();

    // Auto-init REMOVED - initialization is handled by base.html
    // This ensures budgetPushManager only initializes for authenticated users
    // (when loaded inside {% if user %} block)
}
