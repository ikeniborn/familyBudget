<script lang="ts">
  import { HelpCircle } from 'lucide-svelte';
  import type { HelpContent } from '$lib/types/help';
  import InlineHelp from './InlineHelp.svelte';

  export let title: string | undefined = undefined;
  export let items: HelpContent[];
  export let compact: boolean = false;
  export let className: string = '';
</script>

<div class="space-y-3 {className}">
  {#if title}
    <h3 class="text-lg font-medium text-gray-900 flex items-center gap-2">
      <HelpCircle class="h-5 w-5 text-blue-600" />
      {title}
    </h3>
  {/if}
  
  <div class="space-y-2">
    {#each items as item (item.id)}
      <InlineHelp
        content={item}
        {compact}
      />
    {/each}
  </div>
</div>