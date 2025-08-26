<script lang="ts">
  import { deviceStore, isMobileOrTablet } from '$lib/stores/device.store';
  import Layout from './Layout.svelte';
  import MobileLayout from './MobileLayout.svelte';

  // Determine which layout to use based on device type
  $: useMobileLayout = $isMobileOrTablet;
</script>

{#if useMobileLayout}
  <MobileLayout>
    <slot />
  </MobileLayout>
{:else}
  <Layout>
    <slot />
  </Layout>
{/if}