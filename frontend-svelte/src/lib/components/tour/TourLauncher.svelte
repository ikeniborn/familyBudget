<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { Play } from 'lucide-svelte';
  import { tourStore } from '$lib/stores/tourStore';
  import type { Tour } from '$lib/types/help';

  export let tours: Tour[];
  export let completedTours: string[];
  export let className: string = '';

  const dispatch = createEventDispatcher();

  let showPanel = false;

  function startTour(tour: Tour) {
    tourStore.startTour(tour);
    dispatch('startTour', tour);
    showPanel = false;
  }

  $: availableTours = tours.filter(tour => !completedTours.includes(tour.id));
  $: completedToursData = tours.filter(tour => completedTours.includes(tour.id));
</script>

<div class={className}>
  <button
    on:click={() => showPanel = !showPanel}
    class="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
  >
    <Play class="h-4 w-4" />
    Обучение ({availableTours.length})
  </button>

  {#if showPanel}
    <div class="absolute right-0 mt-2 w-80 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
      <div class="p-4">
        <h3 class="text-lg font-semibold mb-3">Интерактивные туры</h3>

        {#if availableTours.length > 0}
          <div class="space-y-3">
            <h4 class="text-sm font-medium text-gray-700">Доступные туры:</h4>
            {#each availableTours as tour (tour.id)}
              <div class="p-3 border border-gray-200 rounded-lg">
                <div class="flex items-start justify-between">
                  <div class="flex-1">
                    <h5 class="font-medium">{tour.name}</h5>
                    <p class="text-sm text-gray-600 mt-1">{tour.description}</p>
                    <div class="text-xs text-gray-500 mt-2">
                      {tour.steps.length} шагов
                    </div>
                  </div>
                  <button
                    on:click={() => startTour(tour)}
                    class="ml-3 px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
                  >
                    Начать
                  </button>
                </div>
              </div>
            {/each}
          </div>
        {:else}
          <p class="text-gray-600 text-sm">Все доступные туры пройдены!</p>
        {/if}

        {#if completedToursData.length > 0}
          <div class="mt-4 pt-4 border-t border-gray-200">
            <h4 class="text-sm font-medium text-gray-700 mb-2">Пройденные туры:</h4>
            <div class="space-y-1">
              {#each completedToursData as tour (tour.id)}
                <div class="flex items-center gap-2 text-sm text-gray-600">
                  <div class="w-2 h-2 bg-green-500 rounded-full" />
                  {tour.name}
                </div>
              {/each}
            </div>
          </div>
        {/if}
      </div>
    </div>
  {/if}
</div>

<!-- Click outside to close -->
{#if showPanel}
  <!-- svelte-ignore a11y-click-events-have-key-events -->
  <!-- svelte-ignore a11y-no-static-element-interactions -->
  <div
    class="fixed inset-0 z-40"
    on:click={() => showPanel = false}
  />
{/if}