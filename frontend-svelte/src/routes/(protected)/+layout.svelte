<script lang="ts">
  import AuthGuard from '$lib/components/auth/AuthGuard.svelte';
  import Layout from '$lib/components/common/Layout.svelte';
</script>

<AuthGuard>
  <Layout>
    <slot />
  </Layout>
</AuthGuard>