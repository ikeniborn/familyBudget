<script lang="ts">
  import { clsx } from 'clsx';
  import Card from './Card.svelte';
  import Badge from './Badge.svelte';
  import Button from './Button.svelte';
  import { ChevronRight, MoreVertical } from 'lucide-svelte';

  interface Column {
    key: string;
    label: string;
    format?: (value: any) => string;
    priority?: 'primary' | 'secondary' | 'hidden';
    align?: 'left' | 'center' | 'right';
  }

  export let data: any[] = [];
  export let columns: Column[] = [];
  export let onRowClick: ((row: any) => void) | undefined = undefined;
  export let onRowAction: ((row: any, action: string) => void) | undefined = undefined;
  export let actions: Array<{ key: string; label: string; icon?: any }> = [];
  export let emptyMessage: string = 'Нет данных';
  export let loading: boolean = false;
  
  let className = '';
  export { className as class };

  let expandedRows: Set<number> = new Set();
  let actionMenuOpen: number | null = null;

  // Separate columns by priority
  $: primaryColumns = columns.filter(c => c.priority === 'primary' || !c.priority);
  $: secondaryColumns = columns.filter(c => c.priority === 'secondary');
  $: hiddenColumns = columns.filter(c => c.priority === 'hidden');

  function toggleRow(index: number) {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    expandedRows = newExpanded;
  }

  function toggleActionMenu(index: number, e: Event) {
    e.stopPropagation();
    actionMenuOpen = actionMenuOpen === index ? null : index;
  }

  function handleAction(row: any, action: string, e: Event) {
    e.stopPropagation();
    actionMenuOpen = null;
    onRowAction?.(row, action);
  }

  function formatValue(column: Column, value: any): string {
    if (column.format) {
      return column.format(value);
    }
    if (value === null || value === undefined) {
      return '-';
    }
    if (typeof value === 'boolean') {
      return value ? 'Да' : 'Нет';
    }
    return String(value);
  }
</script>

<div class={clsx('space-y-3', className)}>
  {#if loading}
    <div class="flex items-center justify-center py-8">
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
    </div>
  {:else if data.length === 0}
    <Card variant="beige" class="p-8 text-center">
      <p class="text-muted-foreground">{emptyMessage}</p>
    </Card>
  {:else}
    {#each data as row, index}
      {@const isExpanded = expandedRows.has(index)}
      
      <Card
        class={clsx(
          'overflow-hidden transition-all',
          onRowClick && 'cursor-pointer active:scale-[0.98]'
        )}
      >
        <!-- Main row content -->
        <div
          class="p-4"
          onclick={() => onRowClick ? onRowClick(row) : toggleRow(index)}
          role={onRowClick ? 'button' : 'presentation'}
          tabindex={onRowClick ? 0 : -1}
        >
          <!-- Primary content -->
          <div class="flex items-start justify-between gap-3">
            <div class="flex-1 min-w-0">
              {#each primaryColumns.slice(0, 2) as column}
                <div class={clsx(
                  'mb-1',
                  column === primaryColumns[0] && 'font-semibold text-foreground',
                  column !== primaryColumns[0] && 'text-sm text-muted-foreground'
                )}>
                  {formatValue(column, row[column.key])}
                </div>
              {/each}
              
              <!-- Secondary badges -->
              {#if secondaryColumns.length > 0}
                <div class="flex flex-wrap gap-1 mt-2">
                  {#each secondaryColumns.slice(0, 2) as column}
                    {@const value = formatValue(column, row[column.key])}
                    {#if value !== '-'}
                      <Badge variant="secondary" size="sm">
                        <span class="text-xs">
                          {column.label}: {value}
                        </span>
                      </Badge>
                    {/if}
                  {/each}
                </div>
              {/if}
            </div>

            <!-- Actions and expand button -->
            <div class="flex items-center gap-1">
              {#if actions.length > 0}
                <div class="relative">
                  <Button
                    variant="ghost"
                    size="icon"
                    onclick={(e: Event) => toggleActionMenu(index, e)}
                    class="h-8 w-8"
                  >
                    <MoreVertical class="h-4 w-4" />
                  </Button>
                  
                  {#if actionMenuOpen === index}
                    <div class="absolute right-0 top-8 z-10 w-48 bg-background rounded-md shadow-lg border">
                      {#each actions as action}
                        <button
                          class="w-full text-left px-4 py-2 text-sm hover:bg-muted transition-colors"
                          onclick={(e) => handleAction(row, action.key, e)}
                        >
                          <div class="flex items-center gap-2">
                            {#if action.icon}
                              {@const Icon = action.icon}
                              <Icon class="h-4 w-4" />
                            {/if}
                            {action.label}
                          </div>
                        </button>
                      {/each}
                    </div>
                  {/if}
                </div>
              {/if}
              
              {#if !onRowClick && (secondaryColumns.length > 2 || hiddenColumns.length > 0)}
                <Button
                  variant="ghost"
                  size="icon"
                  class={clsx(
                    'h-8 w-8 transition-transform',
                    isExpanded && 'rotate-90'
                  )}
                >
                  <ChevronRight class="h-4 w-4" />
                </Button>
              {/if}
            </div>
          </div>
        </div>

        <!-- Expanded content -->
        {#if isExpanded && !onRowClick}
          <div class="border-t bg-muted/30 p-4 space-y-2">
            {#each [...secondaryColumns.slice(2), ...hiddenColumns] as column}
              {@const value = formatValue(column, row[column.key])}
              {#if value !== '-'}
                <div class="flex justify-between text-sm">
                  <span class="text-muted-foreground">{column.label}:</span>
                  <span class="font-medium">{value}</span>
                </div>
              {/if}
            {/each}
          </div>
        {/if}
      </Card>
    {/each}
  {/if}
</div>

<style>
  /* Ensure action menu stays within viewport */
  :global(.relative) {
    position: relative;
  }

  /* Add safe area padding for iOS devices */
  @supports (padding-bottom: env(safe-area-inset-bottom)) {
    .space-y-3:last-child {
      padding-bottom: env(safe-area-inset-bottom);
    }
  }
</style>