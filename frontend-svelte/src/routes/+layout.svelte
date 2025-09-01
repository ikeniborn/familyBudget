<script lang="ts">
  import '../app.css';
  import { onMount } from 'svelte';
  import { authStore } from '$lib/stores/auth.store';
  import ToastContainer from '$lib/components/common/ToastContainer.svelte';
  
  // Initialize app services on startup
  onMount(async () => {
    // Initialize auth
    await authStore.checkAuth();
  });
</script>

<slot />
<ToastContainer />