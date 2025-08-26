<script lang="ts">
  import '../app.css';
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { authStore } from '$lib/stores/auth.store';
  import { pwaStore } from '$lib/stores/pwa.store';
  import ErrorBoundary from '$lib/components/common/ErrorBoundary.svelte';
  import ToastContainer from '$lib/components/common/ToastContainer.svelte';
  import PWAInstallPrompt from '$lib/components/pwa/PWAInstallPrompt.svelte';
  import PWAUpdateNotification from '$lib/components/pwa/PWAUpdateNotification.svelte';
  import { performanceMonitor, trackPageView } from '$lib/utils/performance';
  import { pushNotificationsService } from '$lib/services/pushNotifications.service';
  import { backgroundSyncService } from '$lib/services/backgroundSync.service';
  
  // Track page views for performance monitoring
  $: if ($page.url.pathname) {
    trackPageView($page.url.pathname.replace('/', '') || 'home');
  }
  
  // Initialize app services on startup
  onMount(async () => {
    // Initialize auth
    await authStore.checkAuth();
    
    // Initialize PWA functionality
    pwaStore.init();
    
    // Initialize performance monitoring
    if (performanceMonitor) {
      performanceMonitor.markTime('app-init-start');
    }
    
    // Initialize push notifications if user is authenticated
    const authUser = authStore.getUser();
    if (authUser && pushNotificationsService) {
      // Setup notifications after user grants permission
      const permission = pushNotificationsService.getPermissionStatus();
      if (permission.granted) {
        try {
          await pushNotificationsService.getSubscription();
        } catch (error) {
          console.warn('Failed to initialize push notifications:', error);
        }
      }
    }
    
    // Initialize background sync
    if (backgroundSyncService) {
      // Process any pending sync operations
      await backgroundSyncService.processPendingOperations();
    }
    
    if (performanceMonitor) {
      performanceMonitor.markTime('app-init-end');
      performanceMonitor.measureTime('app-init-duration', 'app-init-start', 'app-init-end');
    }
  });
</script>

<ErrorBoundary>
  <slot />
  <ToastContainer />
  
  <!-- PWA Components -->
  <PWAInstallPrompt />
  <PWAUpdateNotification />
</ErrorBoundary>