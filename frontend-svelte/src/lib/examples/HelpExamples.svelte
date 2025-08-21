<script lang="ts">
  // Example usage of help and tour components
  import { InlineHelp, HelpPanel } from '$lib/components/help';
  import { GuidedTour, TourLauncher } from '$lib/components/tour';
  import { tourState } from '$lib/stores/tourStore';
  import type { HelpContent, Tour } from '$lib/types/help';

  // Example help content
  const helpItems: HelpContent[] = [
    {
      id: 'budget-help',
      title: 'Управление бюджетом',
      content: 'Здесь вы можете создавать и управлять статьями бюджета, устанавливать лимиты и отслеживать расходы.',
      type: 'info',
      links: [
        {
          label: 'Подробное руководство',
          url: '/help/budget',
          external: false
        }
      ]
    },
    {
      id: 'warning-help',
      title: 'Превышение лимита',
      content: 'Внимание! Расходы по этой статье превышают установленный лимит.',
      type: 'warning',
      actions: [
        {
          label: 'Увеличить лимит',
          action: () => alert('Увеличение лимита'),
          primary: true
        },
        {
          label: 'Подробнее',
          action: () => alert('Подробная информация')
        }
      ]
    },
    {
      id: 'tip-help',
      title: 'Совет по экономии',
      content: 'Используйте автоматическое распределение для более эффективного планирования бюджета.',
      type: 'tip'
    }
  ];

  // Example tour
  const exampleTours: Tour[] = [
    {
      id: 'budget-intro',
      name: 'Знакомство с бюджетом',
      description: 'Пошаговое знакомство с основными функциями управления бюджетом',
      steps: [
        {
          id: 'step-1',
          target: '.budget-header',
          title: 'Добро пожаловать!',
          content: 'Это главная страница управления бюджетом. Здесь вы увидите все ваши доходы и расходы.',
          position: 'bottom'
        },
        {
          id: 'step-2',
          target: '.add-budget-btn',
          title: 'Создание статьи бюджета',
          content: 'Нажмите эту кнопку, чтобы создать новую статью бюджета.',
          position: 'top'
        },
        {
          id: 'step-3',
          target: '.budget-list',
          title: 'Список статей',
          content: 'Здесь отображаются все ваши статьи бюджета с текущими суммами и лимитами.',
          position: 'right'
        }
      ]
    }
  ];

  let showCompactHelp = false;
</script>

<div class="p-8 space-y-8">
  <div class="max-w-4xl mx-auto">
    <h1 class="text-3xl font-bold mb-6">Примеры компонентов помощи</h1>

    <!-- Inline Help Examples -->
    <section class="space-y-6">
      <h2 class="text-2xl font-semibold">InlineHelp компоненты</h2>
      
      <div class="space-y-4">
        <h3 class="text-lg font-medium">Обычный режим</h3>
        {#each helpItems as item}
          <InlineHelp content={item} />
        {/each}
      </div>

      <div class="space-y-4">
        <div class="flex items-center gap-4">
          <h3 class="text-lg font-medium">Компактный режим</h3>
          <label class="flex items-center gap-2">
            <input type="checkbox" bind:checked={showCompactHelp} />
            <span class="text-sm">Показать компактный</span>
          </label>
        </div>
        
        {#if showCompactHelp}
          <div class="flex gap-4">
            {#each helpItems as item}
              <InlineHelp content={item} compact={true} />
            {/each}
          </div>
        {/if}
      </div>

      <div class="space-y-4">
        <h3 class="text-lg font-medium">HelpPanel</h3>
        <HelpPanel 
          title="Помощь по разделу" 
          items={helpItems}
        />
      </div>
    </section>

    <!-- Tour Examples -->
    <section class="space-y-6">
      <h2 class="text-2xl font-semibold">Интерактивные туры</h2>
      
      <div class="space-y-4">
        <h3 class="text-lg font-medium">Tour Launcher</h3>
        <div class="relative">
          <TourLauncher 
            tours={exampleTours}
            completedTours={$tourState.completedTours}
            className="inline-block"
          />
        </div>
      </div>

      <!-- Guided Tour Component -->
      <GuidedTour 
        tours={exampleTours}
        on:tourComplete={(e) => console.log('Тур завершен:', e.detail)}
        on:tourSkip={(e) => console.log('Тур пропущен:', e.detail)}
        on:stepComplete={(e) => console.log('Шаг завершен:', e.detail)}
      />

      <!-- Demo elements for tour -->
      <div class="bg-gray-50 p-6 rounded-lg space-y-4">
        <h3 class="text-lg font-medium budget-header">Демо-элементы для тура</h3>
        <button class="add-budget-btn px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
          Добавить статью бюджета
        </button>
        <div class="budget-list bg-white p-4 border border-gray-200 rounded">
          <p class="text-sm text-gray-600">Список статей бюджета будет здесь</p>
        </div>
      </div>
    </section>

    <!-- Usage Information -->
    <section class="space-y-4">
      <h2 class="text-2xl font-semibold">Использование</h2>
      <div class="bg-gray-50 p-6 rounded-lg">
        <h3 class="text-lg font-medium mb-4">Импорт компонентов:</h3>
        <pre class="bg-gray-800 text-white p-4 rounded text-sm overflow-x-auto"><code>{`// Компоненты помощи
import { InlineHelp, HelpPanel } from '$lib/components/help';

// Компоненты туров
import { GuidedTour, TourLauncher } from '$lib/components/tour';

// Stores для управления состоянием
import { helpStore } from '$lib/stores/helpStore';
import { tourStore, tourState } from '$lib/stores/tourStore';

// Типы
import type { HelpContent, Tour } from '$lib/types/help';`}</code></pre>
      </div>
    </section>
  </div>
</div>