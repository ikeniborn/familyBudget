<script lang="ts">
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import { page } from '$app/stores';
  import { isAuthenticated, isAuthLoading, authStore } from '$lib/stores/auth.store';

  let mounted = false;
  let authChecked = false;

  // Get initial auth data from SSR
  $: ssrAuthData = $page.data;

  onMount(async () => {
    mounted = true;
    
    // If we have SSR auth data, use it immediately
    if (ssrAuthData?.user && ssrAuthData?.authenticated) {
      authStore.setUser({
        user_id: ssrAuthData.user.id || ssrAuthData.user.user_id,
        user_name: ssrAuthData.user.user_name || ssrAuthData.user.username || '',
        user_telegram_id: ssrAuthData.user.telegram_id || 0,
        first_name: ssrAuthData.user.first_name || '',
        last_name: ssrAuthData.user.last_name || '',
        username: ssrAuthData.user.username || '',
        authMethod: 'password'
      });
      authChecked = true;
    }
    // Only check auth if we're not already authenticated and don't have SSR data
    else if (browser && !authChecked && !$isAuthenticated) {
      authChecked = true;
      try {
        await authStore.checkAuth();
      } catch (error) {
        console.error('Auth check failed:', error);
      }
    } else if ($isAuthenticated) {
      // If already authenticated, mark as checked
      authChecked = true;
    }
  });

  // Note: Server-side redirect is handled by +layout.server.ts
  // This component handles both SSR data and client-side auth state display
</script>

{#if $isAuthLoading}
  <div class="min-h-screen flex items-center justify-center">
    <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
  </div>
{:else if $isAuthenticated}
  <slot />
{/if}