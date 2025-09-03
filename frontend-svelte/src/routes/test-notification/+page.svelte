<script lang="ts">
  import NotificationDropdown from '$lib/components/common/NotificationDropdown.svelte';
</script>

<div class="p-8">
  <h1 class="text-2xl font-bold mb-6">Тест компонента уведомлений</h1>
  
  <div class="mb-4">
    <p class="text-gray-600">Нажмите на колокольчик ниже, чтобы открыть панель уведомлений:</p>
  </div>
  
  <div class="flex items-center gap-4 p-4 bg-gray-100 rounded-lg">
    <span class="text-sm text-gray-600">Компонент уведомлений →</span>
    <NotificationDropdown />
  </div>
  
  <div class="mt-8 p-4 bg-blue-50 rounded-lg">
    <h2 class="font-semibold mb-2">Инструкция по тестированию:</h2>
    <ol class="list-decimal list-inside space-y-1 text-sm">
      <li>Нажмите на колокольчик - должна открыться панель уведомлений</li>
      <li>В панели должны отображаться тестовые уведомления</li>
      <li>Нажмите на уведомление - оно должно пометиться как прочитанное</li>
      <li>Нажмите кнопку "Развернуть" - панель должна расшириться на весь экран</li>
      <li>Нажмите вне панели или ESC - панель должна закрыться</li>
    </ol>
  </div>
  
  <div class="mt-4 p-4 bg-green-50 rounded-lg">
    <p class="text-sm text-green-800">
      <strong>Консоль браузера:</strong> Откройте консоль разработчика (F12) для просмотра отладочных сообщений при клике на колокольчик.
    </p>
  </div>
</div>