<script lang="ts">
  import '../app.css';
  import { onMount } from 'svelte';
  import { get } from 'svelte/store';
  import { authStore } from '$lib/stores/auth.store';
  import ToastContainer from '$lib/components/common/ToastContainer.svelte';

  // Initialize app services on startup
  onMount(async () => {
    // Only check auth if we don't already have user data from server
    // This avoids unnecessary 401 errors when user is already authenticated server-side
    const currentState = get(authStore);
    if (!currentState?.user && !currentState?.isAuthenticated) {
      // Initialize auth only if no user data exists
      await authStore.checkAuth();
    }
  });
</script>

<slot />
<ToastContainer />