<script lang="ts">
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { isAuthenticated, isAuthLoading, authStore } from '$lib/stores/auth.store';

  let mounted = false;
  let authChecked = false;
  let isClientAuthReady = false;

  // Get initial auth data from SSR
  $: ssrAuthData = $page.data;

  onMount(async () => {
    mounted = true;

    // If we have SSR auth data, use it immediately and mark as SSR-authenticated
    if (ssrAuthData?.user && ssrAuthData?.authenticated) {
      authStore.setUser({
        user_id: ssrAuthData.user.id || ssrAuthData.user.user_id,
        user_name: ssrAuthData.user.user_name || ssrAuthData.user.username || '',
        user_telegram_id: ssrAuthData.user.telegram_id || 0,
        first_name: ssrAuthData.user.first_name || '',
        last_name: ssrAuthData.user.last_name || '',
        username: ssrAuthData.user.username || '',
        authMethod: ssrAuthData.user.auth_method || 'password',
        role: ssrAuthData.user.role || 'user'
      });
      authStore.markSSRAuthenticated();
      authChecked = true;
      isClientAuthReady = true;
    }
    // If we're already authenticated (from localStorage) and have SSR data, trust it
    else if ($isAuthenticated && ssrAuthData?.authenticated) {
      authChecked = true;
      isClientAuthReady = true;
      // SSR already validated the session, no need to verify again
    }
    // If authenticated but no SSR data, verify with server
    else if ($isAuthenticated) {
      authChecked = true;
      try {
        // Verify the stored auth is still valid
        await authStore.checkAuth();
      } catch (error) {
        console.error('Auth verification failed:', error);
      } finally {
        isClientAuthReady = true;
      }
    }
    // Not authenticated, check with server
    else if (browser && !authChecked) {
      authChecked = true;
      try {
        await authStore.checkAuth();
      } catch (error) {
        console.error('Auth check failed:', error);
      } finally {
        isClientAuthReady = true;
      }
    } else {
      // No auth data and not authenticated
      isClientAuthReady = true;
    }
  });

  // Redirect to login if not authenticated after check
  $: if (isClientAuthReady && !$isAuthenticated && !$isAuthLoading && browser) {
    const returnUrl = encodeURIComponent($page.url.pathname + $page.url.search);
    goto(`/login?returnUrl=${returnUrl}`);
  }

  // Note: Server-side redirect is handled by +layout.server.ts
  // This component handles both SSR data and client-side auth state display
</script>

{#if $isAuthLoading || !isClientAuthReady}
  <div class="min-h-screen flex items-center justify-center">
    <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
  </div>
{:else if $isAuthenticated}
  <slot />
{:else}
  <!-- Will redirect to login automatically -->
  <div class="min-h-screen flex items-center justify-center">
    <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
  </div>
{/if}