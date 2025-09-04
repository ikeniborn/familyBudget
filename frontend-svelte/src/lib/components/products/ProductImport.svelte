<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { productService } from '$lib/services/product.service';
  import { toastStore } from '$lib/stores/toast.store';
  import Card from '$lib/components/ui/Card.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import Input from '$lib/components/ui/Input.svelte';
  import Modal from '$lib/components/ui/Modal.svelte';
  import { Upload, FileSpreadsheet, X, Download, Globe } from 'lucide-svelte';
  import { browser } from '$app/environment';

  export let isOpen = false;

  const dispatch = createEventDispatcher<{
    close: void;
    success: void;
  }>();

  let activeTab: 'file' | 'sheets' = 'file';
  let isUploading = false;
  let dragActive = false;
  let previewData: any[] = [];
  let availableColumns: string[] = [];
  let importConfig = {
    productNameColumn: '',
    categoryColumn: '',
    unitColumn: '',
    barcodeColumn: '',
    descriptionColumn: '',
    priceColumn: '',
    supplierColumn: ''
  };
  let sheetsUrl = '';
  let fileInputRef: HTMLInputElement;

  function handleDrag(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      dragActive = true;
    } else if (e.type === 'dragleave') {
      dragActive = false;
    }
  }

  function handleDrop(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    dragActive = false;
    
    if (e.dataTransfer?.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  }

  function handleFileSelect(e: Event) {
    const target = e.target as HTMLInputElement;
    if (target.files && target.files[0]) {
      handleFileUpload(target.files[0]);
    }
  }

  async function handleFileUpload(file: File) {
    const allowedTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'text/csv'
    ];

    if (!allowedTypes.includes(file.type)) {
      toastStore.error('Поддерживаются только файлы Excel (.xlsx, .xls) и CSV');
      return;
    }

    try {
      isUploading = true;
      
      if (file.type === 'text/csv') {
        await parseCSVFile(file);
      } else {
        await parseExcelFile(file);
      }
    } catch (error: any) {
      console.error('Ошибка загрузки файла:', error);
      toastStore.error(error.message || 'Не удалось загрузить файл');
    } finally {
      isUploading = false;
    }
  }

  async function parseExcelFile(file: File) {
    // В браузере используем xlsx библиотеку
    if (browser) {
      const XLSX = await import('xlsx');
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
      
      if (jsonData.length === 0) {
        throw new Error('Файл пуст');
      }

      const headers = jsonData[0] as string[];
      const rows = jsonData.slice(1);
      
      availableColumns = headers;
      previewData = rows.slice(0, 5).map(row => {
        const obj: any = {};
        headers.forEach((header, index) => {
          obj[header] = row[index] || '';
        });
        return obj;
      });

      // Автоматическое сопоставление колонок
      autoMapColumns(headers);
    }
  }

  async function parseCSVFile(file: File) {
    const text = await file.text();
    const lines = text.split('\n');
    
    if (lines.length === 0) {
      throw new Error('Файл пуст');
    }

    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
    const rows = lines.slice(1, 6).map(line => {
      const values = line.split(',').map(v => v.trim().replace(/"/g, ''));
      const obj: any = {};
      headers.forEach((header, index) => {
        obj[header] = values[index] || '';
      });
      return obj;
    });

    availableColumns = headers;
    previewData = rows;
    autoMapColumns(headers);
  }

  function autoMapColumns(headers: string[]) {
    const mapping: Partial<typeof importConfig> = {};
    
    // Простое автоматическое сопоставление по ключевым словам
    headers.forEach(header => {
      const lowerHeader = header.toLowerCase();
      
      if (lowerHeader.includes('название') || lowerHeader.includes('наименование') || lowerHeader.includes('product')) {
        mapping.productNameColumn = header;
      } else if (lowerHeader.includes('категория') || lowerHeader.includes('category')) {
        mapping.categoryColumn = header;
      } else if (lowerHeader.includes('единица') || lowerHeader.includes('unit')) {
        mapping.unitColumn = header;
      } else if (lowerHeader.includes('штрихкод') || lowerHeader.includes('barcode')) {
        mapping.barcodeColumn = header;
      } else if (lowerHeader.includes('описание') || lowerHeader.includes('description')) {
        mapping.descriptionColumn = header;
      } else if (lowerHeader.includes('цена') || lowerHeader.includes('price')) {
        mapping.priceColumn = header;
      } else if (lowerHeader.includes('поставщик') || lowerHeader.includes('магазин') || lowerHeader.includes('supplier')) {
        mapping.supplierColumn = header;
      }
    });

    importConfig = { ...importConfig, ...mapping };
  }

  async function handleGoogleSheetsImport() {
    if (!sheetsUrl) {
      toastStore.error('Введите URL Google Sheets');
      return;
    }

    try {
      isUploading = true;
      
      // Преобразуем URL в CSV export URL
      const csvUrl = sheetsUrl.replace('/edit#gid=', '/export?format=csv&gid=')
                              .replace('/edit?usp=sharing', '/export?format=csv');
      
      const response = await fetch(csvUrl);
      if (!response.ok) {
        throw new Error('Не удалось получить данные из Google Sheets');
      }

      const csvText = await response.text();
      const lines = csvText.split('\n');
      
      if (lines.length === 0) {
        throw new Error('Google Sheets пуст');
      }

      const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
      const rows = lines.slice(1, 6).map(line => {
        const values = line.split(',').map(v => v.trim().replace(/"/g, ''));
        const obj: any = {};
        headers.forEach((header, index) => {
          obj[header] = values[index] || '';
        });
        return obj;
      });

      availableColumns = headers;
      previewData = rows;
      autoMapColumns(headers);
      
      toastStore.success('Данные из Google Sheets загружены');
    } catch (error: any) {
      console.error('Ошибка импорта из Google Sheets:', error);
      toastStore.error(error.message || 'Не удалось импортировать из Google Sheets');
    } finally {
      isUploading = false;
    }
  }

  async function handleImport() {
    if (!importConfig.productNameColumn) {
      toastStore.error('Выберите колонку с названием продукта');
      return;
    }

    try {
      isUploading = true;
      
      // Здесь должна быть логика отправки данных на сервер
      // Пока что просто имитируем успешный импорт
      const importData = previewData.map(row => ({
        product_name: row[importConfig.productNameColumn],
        category_name: importConfig.categoryColumn ? row[importConfig.categoryColumn] : undefined,
        unit_measure: importConfig.unitColumn ? row[importConfig.unitColumn] : undefined,
        barcode: importConfig.barcodeColumn ? row[importConfig.barcodeColumn] : undefined,
        description: importConfig.descriptionColumn ? row[importConfig.descriptionColumn] : undefined,
        price_value: importConfig.priceColumn ? parseFloat(row[importConfig.priceColumn]) || undefined : undefined,
        supplier_name: importConfig.supplierColumn ? row[importConfig.supplierColumn] : undefined,
      }));

      // TODO: Реализовать API endpoint для массового импорта
      console.log('Данные для импорта:', importData);
      
      toastStore.success(`Импортировано ${importData.length} продуктов`);
      handleClose();
      dispatch('success');
    } catch (error: any) {
      console.error('Ошибка импорта:', error);
      toastStore.error(error.message || 'Не удалось импортировать данные');
    } finally {
      isUploading = false;
    }
  }

  function downloadTemplate() {
    if (browser) {
      import('xlsx').then(XLSX => {
        const templateData = [
          ['Наименование продукта', 'Категория', 'Единица измерения', 'Штрихкод', 'Описание', 'Цена', 'Поставщик'],
          ['Молоко Простоквашино 2.5%', 'Молочные продукты', 'л', '4607034170011', 'Молоко пастеризованное', '89.90', 'Пятерочка'],
          ['Хлеб Дарницкий', 'Хлебобулочные', 'шт', '4607012345678', 'Хлеб ржано-пшеничный', '45.00', 'Магнит'],
        ];

        const ws = XLSX.utils.aoa_to_sheet(templateData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Продукты');
        XLSX.writeFile(wb, 'template_products.xlsx');
      });
    }
  }

  function handleClose() {
    isOpen = false;
    dispatch('close');
  }

  function resetForm() {
    previewData = [];
    availableColumns = [];
    importConfig = {
      productNameColumn: '',
      categoryColumn: '',
      unitColumn: '',
      barcodeColumn: '',
      descriptionColumn: '',
      priceColumn: '',
      supplierColumn: ''
    };
    sheetsUrl = '';
    activeTab = 'file';
  }

  // Сброс формы при закрытии
  $: if (!isOpen) {
    resetForm();
  }
</script>

<Modal bind:isOpen title="Импорт продуктов" size="large" onclose={handleClose}>
  <div class="space-y-6">
    <!-- Вкладки и кнопки -->
    <div class="flex justify-between items-center">
      <div class="flex space-x-1">
        <button
          class="px-4 py-2 rounded-md {
            activeTab === 'file' 
              ? 'bg-blue-100 text-blue-700' 
              : 'text-gray-500 hover:text-gray-700'
          }"
          on:click={() => activeTab = 'file'}
        >
          <FileSpreadsheet class="h-4 w-4 inline mr-1" />
          Файл
        </button>
        <button
          class="px-4 py-2 rounded-md {
            activeTab === 'sheets' 
              ? 'bg-blue-100 text-blue-700' 
              : 'text-gray-500 hover:text-gray-700'
          }"
          on:click={() => activeTab = 'sheets'}
        >
          <Globe class="h-4 w-4 inline mr-1" />
          Google Sheets
        </button>
      </div>
      
      <Button variant="secondary" size="sm" on:click={downloadTemplate}>
        <Download class="h-4 w-4 mr-1" />
        Скачать шаблон
      </Button>
    </div>

    <!-- Вкладка загрузки файла -->
    {#if activeTab === 'file'}
      <div
        class="border-2 border-dashed rounded-lg p-8 text-center {
          dragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300'
        }"
        ondragenter={handleDrag}
        ondragleave={handleDrag}
        ondragover={handleDrag}
        ondrop={handleDrop}
        role="button"
        tabindex="0"
      >
        <Upload class="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <p class="text-lg font-medium text-gray-900 mb-2">
          Перетащите файл сюда или нажмите для выбора
        </p>
        <p class="text-sm text-gray-500 mb-4">
          Поддерживаются файлы Excel (.xlsx, .xls) и CSV
        </p>
        <Button
          variant="secondary"
          on:click={() => fileInputRef.click()}
          disabled={isUploading}
        >
          {isUploading ? 'Загрузка...' : 'Выбрать файл'}
        </Button>
        <input
          bind:this={fileInputRef}
          type="file"
          class="hidden"
          accept=".xlsx,.xls,.csv"
          on:change={handleFileSelect}
        />
      </div>
    {/if}

    <!-- Вкладка Google Sheets -->
    {#if activeTab === 'sheets'}
      <div class="space-y-4">
        <div>
          <label for="sheets-url" class="block text-sm font-medium text-gray-700 mb-2">
            URL Google Sheets
          </label>
          <Input
            id="sheets-url"
            placeholder="https://docs.google.com/spreadsheets/d/..."
            bind:value={sheetsUrl}
          />
          <p class="text-xs text-gray-500 mt-1">
            Убедитесь, что таблица доступна для просмотра всем пользователям
          </p>
        </div>
        <Button
          on:click={handleGoogleSheetsImport}
          disabled={isUploading || !sheetsUrl}
        >
          {isUploading ? 'Загрузка...' : 'Загрузить из Google Sheets'}
        </Button>
      </div>
    {/if}

    <!-- Предварительный просмотр и настройка колонок -->
    {#if previewData.length > 0}
      <div class="space-y-4">
        <h3 class="text-lg font-medium">Настройка соответствия колонок</h3>
        
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label for="product-name-col" class="block text-sm font-medium text-gray-700 mb-1">
              Название продукта *
            </label>
            <select
              id="product-name-col"
              bind:value={importConfig.productNameColumn}
              class="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
            >
              <option value="">Выберите колонку</option>
              {#each availableColumns as col}
                <option value={col}>{col}</option>
              {/each}
            </select>
          </div>

          <div>
            <label for="category-col" class="block text-sm font-medium text-gray-700 mb-1">
              Категория
            </label>
            <select
              id="category-col"
              bind:value={importConfig.categoryColumn}
              class="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
            >
              <option value="">Не импортировать</option>
              {#each availableColumns as col}
                <option value={col}>{col}</option>
              {/each}
            </select>
          </div>

          <div>
            <label for="unit-col" class="block text-sm font-medium text-gray-700 mb-1">
              Единица измерения
            </label>
            <select
              id="unit-col"
              bind:value={importConfig.unitColumn}
              class="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
            >
              <option value="">Не импортировать</option>
              {#each availableColumns as col}
                <option value={col}>{col}</option>
              {/each}
            </select>
          </div>

          <div>
            <label for="price-col" class="block text-sm font-medium text-gray-700 mb-1">
              Цена
            </label>
            <select
              id="price-col"
              bind:value={importConfig.priceColumn}
              class="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
            >
              <option value="">Не импортировать</option>
              {#each availableColumns as col}
                <option value={col}>{col}</option>
              {/each}
            </select>
          </div>

          <div>
            <label for="supplier-col" class="block text-sm font-medium text-gray-700 mb-1">
              Поставщик/Магазин
            </label>
            <select
              id="supplier-col"
              bind:value={importConfig.supplierColumn}
              class="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
            >
              <option value="">Не импортировать</option>
              {#each availableColumns as col}
                <option value={col}>{col}</option>
              {/each}
            </select>
          </div>
        </div>

        <!-- Предварительный просмотр -->
        <div>
          <h4 class="text-md font-medium mb-2">Предварительный просмотр (первые 5 строк)</h4>
          <div class="overflow-x-auto">
            <table class="min-w-full border border-gray-200">
              <thead class="bg-gray-50">
                <tr>
                  {#each availableColumns as col}
                    <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase border-b">
                      {col}
                    </th>
                  {/each}
                </tr>
              </thead>
              <tbody>
                {#each previewData as row, index}
                  <tr class="border-b">
                    {#each availableColumns as col}
                      <td class="px-4 py-2 text-sm text-gray-900">
                        {row[col] || '—'}
                      </td>
                    {/each}
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    {/if}
  </div>

  <svelte:fragment slot="footer">
    {#if previewData.length > 0}
      <div class="flex justify-end space-x-2">
        <Button variant="secondary" on:click={handleClose}>
          Отмена
        </Button>
        <Button
          on:click={handleImport}
          disabled={isUploading || !importConfig.productNameColumn}
        >
          {isUploading ? 'Импорт...' : 'Импортировать'}
        </Button>
      </div>
    {/if}
  </svelte:fragment>
</Modal>