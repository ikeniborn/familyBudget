<script lang="ts">
  import { isAdmin } from '$lib/stores/auth.store';
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  
  let mounted = false;
  
  onMount(() => {
    mounted = true;
    // Double-check admin status on client side
    if (mounted && !$isAdmin) {
      goto('/settings?error=access_denied&message=' + encodeURIComponent('Доступ запрещен. Требуются права администратора.'));
    }
  });
</script>

{#if mounted && $isAdmin}
  <slot />
{:else}
  <!-- Loading state while checking permissions -->
  <div class="min-h-screen flex items-center justify-center">
    <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
  </div>
{/if}