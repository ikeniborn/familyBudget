import { browser } from '$app/environment';

export interface NotificationPermission {
  granted: boolean;
  denied: boolean;
  default: boolean;
}

export interface PushSubscriptionData {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

class PushNotificationsService {
  private registration: ServiceWorkerRegistration | null = null;
  private subscription: PushSubscription | null = null;
  private vapidPublicKey = 'YOUR_VAPID_PUBLIC_KEY'; // Replace with your VAPID key

  constructor() {
    if (browser) {
      this.initialize();
    }
  }

  private async initialize(): Promise<void> {
    if (!this.isSupported()) {
      console.warn('Push notifications are not supported in this browser');
      return;
    }

    try {
      this.registration = await navigator.serviceWorker.ready;
      this.subscription = await this.registration.pushManager.getSubscription();
    } catch (error) {
      console.error('Failed to initialize push notifications:', error);
    }
  }

  // Check if push notifications are supported
  isSupported(): boolean {
    return (
      browser &&
      'serviceWorker' in navigator &&
      'PushManager' in window &&
      'Notification' in window
    );
  }

  // Get current notification permission status
  getPermissionStatus(): NotificationPermission {
    const permission = Notification.permission;
    return {
      granted: permission === 'granted',
      denied: permission === 'denied',
      default: permission === 'default'
    };
  }

  // Request notification permission
  async requestPermission(): Promise<boolean> {
    if (!this.isSupported()) {
      throw new Error('Push notifications are not supported');
    }

    try {
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    } catch (error) {
      console.error('Failed to request notification permission:', error);
      return false;
    }
  }

  // Subscribe to push notifications
  async subscribe(): Promise<PushSubscriptionData | null> {
    if (!this.isSupported() || !this.registration) {
      throw new Error('Push notifications are not supported or service worker not registered');
    }

    const permission = this.getPermissionStatus();
    if (!permission.granted) {
      const granted = await this.requestPermission();
      if (!granted) {
        throw new Error('Notification permission denied');
      }
    }

    try {
      const subscription = await this.registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: this.urlBase64ToUint8Array(this.vapidPublicKey)
      });

      this.subscription = subscription;
      
      const subscriptionData = this.formatSubscription(subscription);
      
      // Send subscription to server
      await this.sendSubscriptionToServer(subscriptionData);
      
      return subscriptionData;
    } catch (error) {
      console.error('Failed to subscribe to push notifications:', error);
      throw error;
    }
  }

  // Unsubscribe from push notifications
  async unsubscribe(): Promise<boolean> {
    if (!this.subscription) {
      return true;
    }

    try {
      const success = await this.subscription.unsubscribe();
      
      if (success) {
        // Notify server about unsubscription
        await this.removeSubscriptionFromServer();
        this.subscription = null;
      }
      
      return success;
    } catch (error) {
      console.error('Failed to unsubscribe from push notifications:', error);
      return false;
    }
  }

  // Get current subscription status
  async getSubscription(): Promise<PushSubscriptionData | null> {
    if (!this.subscription && this.registration) {
      this.subscription = await this.registration.pushManager.getSubscription();
    }
    
    return this.subscription ? this.formatSubscription(this.subscription) : null;
  }

  // Show local notification
  async showNotification(
    title: string,
    options: {
      body?: string;
      icon?: string;
      badge?: string;
      image?: string;
      data?: any;
      tag?: string;
      renotify?: boolean;
      requireInteraction?: boolean;
      actions?: Array<{
        action: string;
        title: string;
        icon?: string;
      }>;
    } = {}
  ): Promise<void> {
    if (!this.isSupported()) {
      console.warn('Notifications not supported, falling back to console');
      console.log(`Notification: ${title}${options.body ? ` - ${options.body}` : ''}`);
      return;
    }

    const permission = this.getPermissionStatus();
    if (!permission.granted) {
      console.warn('Notification permission not granted');
      return;
    }

    const defaultOptions = {
      icon: '/icons/icon-192x192.png',
      badge: '/icons/icon-72x72.png',
      tag: 'family-budget-notification',
      data: {
        timestamp: Date.now(),
        ...options.data
      }
    };

    const notificationOptions = { ...defaultOptions, ...options };

    if (this.registration) {
      await this.registration.showNotification(title, notificationOptions);
    } else {
      new Notification(title, notificationOptions);
    }
  }

  // Show budget reminder notification
  async showBudgetReminder(message: string, amount?: number): Promise<void> {
    await this.showNotification('Напоминание о бюджете', {
      body: message,
      icon: '/icons/shortcut-budget.png',
      tag: 'budget-reminder',
      data: { type: 'budget-reminder', amount },
      actions: [
        {
          action: 'view-budget',
          title: 'Посмотреть бюджет'
        },
        {
          action: 'dismiss',
          title: 'Скрыть'
        }
      ]
    });
  }

  // Show expense notification
  async showExpenseNotification(expenseName: string, amount: number): Promise<void> {
    await this.showNotification('Новый расход', {
      body: `${expenseName}: ${amount.toLocaleString('ru-RU')} ₽`,
      icon: '/icons/shortcut-expense.png',
      tag: 'expense-notification',
      data: { type: 'expense', expenseName, amount },
      actions: [
        {
          action: 'view-expense',
          title: 'Подробнее'
        }
      ]
    });
  }

  // Show report notification
  async showReportNotification(reportName: string): Promise<void> {
    await this.showNotification('Отчет готов', {
      body: `Отчет "${reportName}" сформирован`,
      icon: '/icons/shortcut-reports.png',
      tag: 'report-notification',
      data: { type: 'report', reportName },
      actions: [
        {
          action: 'view-report',
          title: 'Посмотреть отчет'
        }
      ]
    });
  }

  // Schedule recurring notifications (budget reminders, etc.)
  scheduleRecurringNotification(
    type: 'daily' | 'weekly' | 'monthly',
    title: string,
    body: string,
    time: { hour: number; minute: number }
  ): void {
    // This would typically be handled by the service worker
    // For now, we'll just register the intent with the service worker
    if (this.registration?.active) {
      this.registration.active.postMessage({
        type: 'SCHEDULE_NOTIFICATION',
        data: {
          type,
          title,
          body,
          time
        }
      });
    }
  }

  // Helper methods
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

  private formatSubscription(subscription: PushSubscription): PushSubscriptionData {
    const key = subscription.getKey('p256dh');
    const token = subscription.getKey('auth');

    return {
      endpoint: subscription.endpoint,
      keys: {
        p256dh: key ? btoa(String.fromCharCode(...new Uint8Array(key))) : '',
        auth: token ? btoa(String.fromCharCode(...new Uint8Array(token))) : ''
      }
    };
  }

  private async sendSubscriptionToServer(subscription: PushSubscriptionData): Promise<void> {
    try {
      const response = await fetch('/api/push-subscriptions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(subscription)
      });

      if (!response.ok) {
        throw new Error('Failed to save subscription on server');
      }
    } catch (error) {
      console.error('Failed to send subscription to server:', error);
      throw error;
    }
  }

  private async removeSubscriptionFromServer(): Promise<void> {
    try {
      if (this.subscription) {
        const response = await fetch('/api/push-subscriptions', {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ endpoint: this.subscription.endpoint })
        });

        if (!response.ok) {
          console.warn('Failed to remove subscription from server');
        }
      }
    } catch (error) {
      console.error('Failed to remove subscription from server:', error);
    }
  }
}

// Export singleton instance
export const pushNotificationsService = browser ? new PushNotificationsService() : null;

// Utility functions for common notification patterns
export const notifyBudgetExceeded = (categoryName: string, exceededAmount: number) => {
  return pushNotificationsService?.showBudgetReminder(
    `Превышен бюджет категории "${categoryName}" на ${exceededAmount.toLocaleString('ru-RU')} ₽`,
    exceededAmount
  );
};

export const notifyBudgetReminder = (categoryName: string, remainingAmount: number) => {
  return pushNotificationsService?.showBudgetReminder(
    `Осталось ${remainingAmount.toLocaleString('ru-RU')} ₽ в категории "${categoryName}"`,
    remainingAmount
  );
};

export const notifyLargeExpense = (expenseName: string, amount: number) => {
  return pushNotificationsService?.showExpenseNotification(expenseName, amount);
};