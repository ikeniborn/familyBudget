<script lang="ts">
  import { BarChart3, Table } from 'lucide-svelte';

  // Props
  export let currentMode: 'chart' | 'table';
  export let onModeChange: (mode: typeof currentMode) => void;

  // View modes configuration
  const viewModes = [
    {
      value: 'chart' as const,
      label: 'Графики',
      icon: BarChart3,
      description: 'Визуализация данных'
    },
    {
      value: 'table' as const,
      label: 'Таблица',
      icon: Table,
      description: 'Табличный вид'
    }
  ];

  // Handle mode change
  function handleModeSelect(mode: typeof currentMode) {
    if (mode !== currentMode) {
      onModeChange(mode);
    }
  }
</script>

<div class="space-y-3">
  <label class="text-xs font-medium text-gray-700 uppercase tracking-wide">
    Режим отображения
  </label>
  
  <!-- Toggle Button Group -->
  <div class="flex bg-gray-100 p-1 rounded-lg">
    {#each viewModes as mode}
      <button
        on:click={() => handleModeSelect(mode.value)}
        class="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all {
          currentMode === mode.value
            ? 'bg-white text-purple-700 shadow-sm'
            : 'text-gray-600 hover:text-gray-900'
        }"
      >
        <svelte:component 
          this={mode.icon} 
          class="h-4 w-4 {currentMode === mode.value ? 'text-purple-600' : 'text-gray-400'}" 
        />
        {mode.label}
      </button>
    {/each}
  </div>
  
  <!-- Current mode description -->
  {#if currentMode}
    {@const selectedMode = viewModes.find(m => m.value === currentMode)}
    {#if selectedMode}
      <div class="text-xs text-gray-500 flex items-center gap-2">
        <svelte:component this={selectedMode.icon} class="h-3 w-3" />
        <span>{selectedMode.description}</span>
      </div>
    {/if}
  {/if}
</div>