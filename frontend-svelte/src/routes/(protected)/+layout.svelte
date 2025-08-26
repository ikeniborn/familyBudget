<script lang="ts">
  import AuthGuard from '$lib/components/auth/AuthGuard.svelte';
  import AdaptiveLayout from '$lib/components/common/AdaptiveLayout.svelte';
</script>

<AuthGuard>
  <AdaptiveLayout>
    <slot />
  </AdaptiveLayout>
</AuthGuard>