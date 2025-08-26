<script lang="ts">
  import { isMobileOrTablet } from '$lib/stores/device.store';
  import Table from './Table.svelte';
  import MobileTable from './MobileTable.svelte';

  export let data: any[] = [];
  export let columns: any[] = [];
  
  // Transform columns for mobile if needed
  $: mobileColumns = columns.map(col => ({
    ...col,
    priority: col.priority || (col.important ? 'primary' : 'secondary')
  }));
</script>

{#if $isMobileOrTablet}
  <MobileTable {data} columns={mobileColumns} />
{:else}
  <Table {data} {columns} />
{/if}