<script lang="ts">
  import Card from '$lib/components/ui/Card.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import { FileText, Upload, Download, FileSpreadsheet, AlertCircle } from 'lucide-svelte';

  let selectedDataType = '';
  let selectedFormat = 'excel';
  let includeHeaders = true;
  let activeOnly = false;
  let selectedFile: File | null = null;
  
  const handleFileSelect = (event: Event) => {
    const target = event.target as HTMLInputElement;
    if (target.files && target.files[0]) {
      selectedFile = target.files[0];
    }
  };

  const handleImport = () => {
    if (!selectedDataType || !selectedFile) {
      alert('Пожалуйста, выберите тип данных и файл для импорта');
      return;
    }
    // TODO: Implement import logic
    console.log('Import:', { dataType: selectedDataType, file: selectedFile });
  };

  const handleExport = () => {
    if (!selectedDataType) {
      alert('Пожалуйста, выберите тип данных для экспорта');
      return;
    }
    // TODO: Implement export logic
    console.log('Export:', { dataType: selectedDataType, format: selectedFormat, includeHeaders, activeOnly });
  };

  const downloadTemplate = (template: string) => {
    // TODO: Implement template download
    console.log('Download template:', template);
  };
</script>

<svelte:head>
  <title>Импорт и Экспорт данных - Family Budget</title>
</svelte:head>

<div class="space-y-6">
  <div class="flex items-center gap-3">
    <FileText class="h-8 w-8 text-slate-600" />
    <div>
      <h1 class="text-2xl font-bold text-slate-900">Импорт и Экспорт данных</h1>
      <p class="text-slate-600">Массовое обновление справочников через файлы</p>
    </div>
  </div>

  <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
    <!-- Import Section -->
    <Card>
      <div class="p-6 space-y-4">
        <div class="flex items-center gap-2 mb-4">
          <Upload class="h-5 w-5" />
          <h2 class="text-xl font-semibold">Импорт данных</h2>
        </div>

        <div class="space-y-2">
          <p class="text-sm text-gray-600">
            Загрузите файл Excel или CSV для массового импорта данных в справочники.
          </p>
          
          <div class="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <div class="flex gap-2">
              <AlertCircle class="h-4 w-4 text-blue-600 flex-shrink-0 mt-0.5" />
              <div class="text-sm text-blue-800">
                <p class="font-medium">Поддерживаемые форматы:</p>
                <ul class="list-disc list-inside mt-1">
                  <li>Excel (.xlsx, .xls)</li>
                  <li>CSV (.csv)</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        <div class="space-y-2">
          <label class="text-sm font-medium" for="import-data-type">Выберите тип данных</label>
          <select 
            id="import-data-type"
            bind:value={selectedDataType}
            class="w-full px-3 py-2 border rounded-lg"
          >
            <option value="">Выберите тип данных</option>
            <option value="periods">Периоды</option>
            <option value="financial-centers">Финансовые центры</option>
            <option value="cost-centers">Центры затрат</option>
            <option value="nomenclatures">Номенклатуры</option>
            <option value="products">Продукты</option>
          </select>
        </div>

        <div class="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
          <FileSpreadsheet class="h-12 w-12 text-gray-400 mx-auto mb-3" />
          <p class="text-sm text-gray-600 mb-2">
            {selectedFile ? selectedFile.name : 'Перетащите файл сюда или нажмите для выбора'}
          </p>
          <input 
            type="file" 
            accept=".xlsx,.xls,.csv" 
            on:change={handleFileSelect}
            class="hidden"
            id="file-input"
          />
          <Button 
            variant="outline" 
            size="sm"
            on:click={() => document.getElementById('file-input')?.click()}
          >
            Выбрать файл
          </Button>
        </div>

        <Button class="w-full" on:click={handleImport}>
          <Upload class="h-4 w-4 mr-2" />
          Начать импорт
        </Button>
      </div>
    </Card>

    <!-- Export Section -->
    <Card>
      <div class="p-6 space-y-4">
        <div class="flex items-center gap-2 mb-4">
          <Download class="h-5 w-5" />
          <h2 class="text-xl font-semibold">Экспорт данных</h2>
        </div>

        <p class="text-sm text-gray-600">
          Выберите данные для экспорта в файл.
        </p>

        <div class="space-y-2">
          <label class="text-sm font-medium" for="export-data-type">Тип данных</label>
          <select 
            id="export-data-type"
            bind:value={selectedDataType}
            class="w-full px-3 py-2 border rounded-lg"
          >
            <option value="">Выберите тип данных</option>
            <option value="periods">Периоды</option>
            <option value="financial-centers">Финансовые центры</option>
            <option value="cost-centers">Центры затрат</option>
            <option value="nomenclatures">Номенклатуры</option>
            <option value="products">Продукты</option>
            <option value="all">Все справочники</option>
          </select>
        </div>

        <div class="space-y-2">
          <span class="text-sm font-medium">Формат файла</span>
          <div class="grid grid-cols-2 gap-2">
            <label class="flex items-center gap-2 p-2 border rounded-lg cursor-pointer hover:bg-gray-50">
              <input type="radio" bind:group={selectedFormat} value="excel" />
              <span class="text-sm">Excel (.xlsx)</span>
            </label>
            <label class="flex items-center gap-2 p-2 border rounded-lg cursor-pointer hover:bg-gray-50">
              <input type="radio" bind:group={selectedFormat} value="csv" />
              <span class="text-sm">CSV (.csv)</span>
            </label>
          </div>
        </div>

        <div class="space-y-2">
          <span class="text-sm font-medium">Дополнительные опции</span>
          <div class="space-y-2">
            <label class="flex items-center gap-2">
              <input type="checkbox" bind:checked={includeHeaders} />
              <span class="text-sm">Включить заголовки</span>
            </label>
            <label class="flex items-center gap-2">
              <input type="checkbox" bind:checked={activeOnly} />
              <span class="text-sm">Только активные записи</span>
            </label>
          </div>
        </div>

        <Button class="w-full" on:click={handleExport}>
          <Download class="h-4 w-4 mr-2" />
          Скачать файл
        </Button>
      </div>
    </Card>
  </div>

  <!-- Templates Section -->
  <Card>
    <div class="p-6">
      <h2 class="text-xl font-semibold mb-4">Шаблоны для импорта</h2>
      <p class="text-sm text-gray-600 mb-4">
        Скачайте шаблоны файлов с правильной структурой для импорта данных.
      </p>
      <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {#each ['Периоды', 'Финансовые центры', 'Центры затрат', 'Номенклатуры', 'Продукты'] as template}
          <Button 
            variant="outline" 
            size="sm" 
            class="w-full"
            on:click={() => downloadTemplate(template)}
          >
            <FileSpreadsheet class="h-4 w-4 mr-1" />
            {template}
          </Button>
        {/each}
      </div>
    </div>
  </Card>
</div>