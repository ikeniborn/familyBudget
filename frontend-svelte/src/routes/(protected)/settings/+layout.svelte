<script lang="ts">
  import { page } from '$app/stores';
  import { isAdmin } from '$lib/stores/auth.store';
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import Card from '$lib/components/ui/Card.svelte';
  import { Shield } from 'lucide-svelte';

  export let data;

  // Double-check admin status on client side
  onMount(() => {
    const unsubscribe = isAdmin.subscribe(adminStatus => {
      if (adminStatus === false) {
        console.warn('Non-admin user attempted to access settings');
        goto('/dashboard');
      }
    });

    return unsubscribe;
  });
</script>

<!-- Admin protection overlay -->
{#if !$isAdmin}
  <div class="min-h-screen bg-background flex items-center justify-center p-4">
    <Card class="max-w-md w-full text-center p-8">
      <div class="mb-4">
        <Shield class="h-16 w-16 mx-auto text-destructive" />
      </div>
      <h1 class="text-2xl font-bold text-foreground mb-2">Доступ запрещен</h1>
      <p class="text-muted-foreground mb-6">
        Для доступа к настройкам системы требуются права администратора.
      </p>
      <button
        on:click={() => goto('/dashboard')}
        class="w-full px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
      >
        Вернуться на главную
      </button>
    </Card>
  </div>
{:else}
  <!-- Settings content for admin users -->
  <slot />
{/if}