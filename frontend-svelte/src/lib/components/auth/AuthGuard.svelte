<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { isAuthenticated, isAuthLoading, authStore } from '$lib/stores/auth.store';

  export let redirectTo = '/login';

  let mounted = false;

  onMount(async () => {
    mounted = true;
    // Check authentication status on mount
    if (!$isAuthenticated) {
      await authStore.checkAuth();
    }
  });

  // Reactive statement to handle authentication redirects
  $: {
    if (mounted && !$isAuthLoading && !$isAuthenticated) {
      // Save the attempted location and redirect to login
      const returnUrl = $page.url.pathname + $page.url.search;
      goto(`${redirectTo}?returnUrl=${encodeURIComponent(returnUrl)}`);
    }
  }
</script>

{#if $isAuthLoading}
  <div class="min-h-screen flex items-center justify-center">
    <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
  </div>
{:else if $isAuthenticated}
  <slot />
{/if}