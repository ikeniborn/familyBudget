<script lang="ts">
  import { AdvancedSearchPanel } from '$lib/components/advanced';
  
  // Example data
  let sampleData = [
    {
      period_id: 1,
      period_name: 'Январь 2024',
      period_year: 2024,
      period_month: 1,
      period_order: 1,
      is_active: true,
      created_at: '2024-01-01T00:00:00Z'
    },
    {
      period_id: 2,
      period_name: 'Февраль 2024',
      period_year: 2024,
      period_month: 2,
      period_order: 2,
      is_active: true,
      created_at: '2024-02-01T00:00:00Z'
    },
    {
      period_id: 3,
      period_name: 'Март 2024',
      period_year: 2024,
      period_month: 3,
      period_order: 3,
      is_active: false,
      created_at: '2024-03-01T00:00:00Z'
    }
  ];

  let filteredData = sampleData;

  function handleFilteredData(event) {
    filteredData = event.detail.data;
    console.log('Filtered data:', filteredData);
  }
</script>

<div class="p-8">
  <h1 class="text-2xl font-bold mb-6">Пример использования AdvancedSearchPanel</h1>
  
  <div class="mb-6">
    <AdvancedSearchPanel
      entityType="periods"
      data={sampleData}
      userId={1}
      on:filteredData={handleFilteredData}
    />
  </div>
  
  <div>
    <h2 class="text-xl font-semibold mb-4">Отфильтрованные данные ({filteredData.length})</h2>
    <div class="grid gap-4">
      {#each filteredData as item}
        <div class="border rounded-lg p-4 bg-white shadow">
          <h3 class="font-medium">{item.period_name}</h3>
          <p class="text-sm text-gray-600">Год: {item.period_year}, Месяц: {item.period_month}</p>
          <p class="text-sm text-gray-600">Активен: {item.is_active ? 'Да' : 'Нет'}</p>
        </div>
      {/each}
    </div>
  </div>
</div>