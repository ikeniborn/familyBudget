<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { isAuthenticated } from '$lib/stores/auth.store';
  
  onMount(() => {
    // Redirect authenticated users to dashboard
    if ($isAuthenticated) {
      goto('/dashboard');
    } else {
      goto('/login');
    }
  });
</script>

<svelte:head>
  <title>Family Budget - SvelteKit</title>
</svelte:head>

<div class="container mx-auto px-4 py-8">
  <div class="max-w-4xl mx-auto">
    <div class="bg-white rounded-lg shadow-lg p-8 border-l-4 border-l-blue-500">
      <h1 class="text-3xl font-bold text-gray-800 mb-4">
        Family Budget - SvelteKit
      </h1>
      <p class="text-gray-600 mb-6">
        Система управления семейным бюджетом на SvelteKit
      </p>
      
      <div class="grid gap-4 md:grid-cols-2">
        <div class="p-4 bg-blue-50 rounded-lg">
          <h2 class="font-semibold text-blue-900 mb-2">Готово к миграции</h2>
          <ul class="space-y-1 text-sm text-blue-700">
            <li>✓ TypeScript с строгим режимом</li>
            <li>✓ Tailwind CSS</li>
            <li>✓ Структура папок</li>
            <li>✓ Алиасы путей</li>
          </ul>
        </div>
        
        <div class="p-4 bg-green-50 rounded-lg">
          <h2 class="font-semibold text-green-900 mb-2">Установленные пакеты</h2>
          <ul class="space-y-1 text-sm text-green-700">
            <li>✓ svelte-forms-lib</li>
            <li>✓ @tanstack/svelte-table</li>
            <li>✓ chart.js</li>
            <li>✓ axios</li>
          </ul>
        </div>
      </div>
      
      <div class="mt-6 p-4 bg-gray-50 rounded-lg">
        <h2 class="font-semibold text-gray-900 mb-2">Следующие шаги</h2>
        <ol class="list-decimal list-inside space-y-1 text-sm text-gray-700">
          <li>Запустите <code class="bg-gray-200 px-1 rounded">npm install</code></li>
          <li>Запустите <code class="bg-gray-200 px-1 rounded">npm run dev</code></li>
          <li>Начните миграцию компонентов из React</li>
        </ol>
      </div>
    </div>
  </div>
</div>