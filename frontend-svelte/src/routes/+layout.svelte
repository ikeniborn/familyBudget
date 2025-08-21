<script lang="ts">
  import '../app.css';
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { authStore } from '$lib/stores/auth.store';
  import ErrorBoundary from '$lib/components/common/ErrorBoundary.svelte';
  import ToastContainer from '$lib/components/common/ToastContainer.svelte';
  
  // Initialize auth check on app startup
  onMount(async () => {
    await authStore.checkAuth();
  });
</script>

<ErrorBoundary>
  <slot />
  <ToastContainer />
</ErrorBoundary>