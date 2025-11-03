/**
 * TomSelectCategoryTree - searchable компонент для выбора категории из иерархического дерева.
 * Web Interface (Desktop) версия.
 *
 * Особенности:
 * - Tom Select для searchable dropdown
 * - N-gram fuzzy search по названиям категорий
 * - Отображение полного пути родителей в результатах поиска
 * - Только листовые категории доступны для выбора
 * - Иерархическое отображение с отступами и иконками (desktop стиль)
 *
 * Использование:
 * const treeSelect = new TomSelectCategoryTree(selectElement, categories, options);
 * await treeSelect.init();
 */

class TomSelectCategoryTree {
  /**
   * @param {HTMLSelectElement} selectElement - Select элемент для инициализации
   * @param {Array} categories - Массив категорий из API
   * @param {Object} options - Опции конфигурации
   */
  constructor(selectElement, categories, options = {}) {
    this.selectElement = selectElement;
    this.categories = categories || [];
    this.options = {
      emptyOptionText: 'Выберите категорию',
      filterType: null, // null, 'income', 'expense'
      selectedId: null,
      indentChar: '  ⤷  ', // Символ для отступа (desktop style)
      parentPrefix: '📂', // Иконка для родителя (папка)
      leafPrefix: '  ▸', // Иконка для листа (стрелка)
      pathSeparator: ' › ', // Разделитель для пути родителей
      pathDisplayElementId: null, // ID элемента для отображения полного пути выбранной категории
      ...options
    };

    this.tomSelectInstance = null;
    this.tree = null;
    this.flatNodes = null;
    this.pathDisplayElement = null;
  }

  /**
   * Построить иерархическое дерево категорий
   */
  buildTree() {
    // Фильтровать по типу если указано
    let filtered = this.categories;
    if (this.options.filterType) {
      filtered = this.categories.filter(c => c.type === this.options.filterType);
    }

    // Найти корневые категории (parent_id === null)
    const roots = filtered.filter(c => !c.parent_id);

    // Рекурсивно построить дерево
    const buildNode = (category, level = 0, parentPath = []) => {
      const children = filtered
        .filter(c => c.parent_id === category.id)
        .map(child => buildNode(child, level + 1, [...parentPath, category.name]));

      return {
        ...category,
        level,
        children,
        isLeaf: children.length === 0,
        parentPath: parentPath, // Массив имен родителей
        fullPath: [...parentPath, category.name].join(this.options.pathSeparator) // Полный путь
      };
    };

    return roots.map(root => buildNode(root));
  }

  /**
   * Flatten tree для использования в Tom Select
   */
  flattenTree(nodes = this.tree) {
    const result = [];

    const traverse = (node) => {
      result.push(node);
      if (node.children && node.children.length > 0) {
        node.children.forEach(traverse);
      }
    };

    nodes.forEach(traverse);
    return result;
  }

  /**
   * N-gram fuzzy search по названию категории
   * @param {string} query - Поисковый запрос
   * @param {object} item - Элемент для проверки
   * @returns {number} - Score совпадения (0-1, выше = лучше)
   */
  fuzzyScore(query, item) {
    if (!query) return 1;

    const searchTerm = query.toLowerCase();
    const itemName = item.name.toLowerCase();
    const itemFullPath = item.fullPath.toLowerCase();

    // Точное совпадение в начале названия - максимальный приоритет
    if (itemName.startsWith(searchTerm)) {
      return 1.0;
    }

    // Точное совпадение в любом месте названия
    if (itemName.includes(searchTerm)) {
      return 0.8;
    }

    // Совпадение в полном пути
    if (itemFullPath.includes(searchTerm)) {
      return 0.6;
    }

    // N-gram fuzzy matching
    const ngramSize = 2;
    const queryNgrams = this.getNgrams(searchTerm, ngramSize);
    const itemNgrams = this.getNgrams(itemName, ngramSize);

    if (queryNgrams.length === 0 || itemNgrams.length === 0) {
      return 0;
    }

    // Подсчет совпадающих n-грамм
    let matches = 0;
    queryNgrams.forEach(qGram => {
      if (itemNgrams.includes(qGram)) {
        matches++;
      }
    });

    const score = matches / queryNgrams.length;
    return score > 0.3 ? score * 0.5 : 0; // Порог 0.3 для n-gram, пониженный приоритет
  }

  /**
   * Получить n-граммы из строки
   * @param {string} str - Исходная строка
   * @param {number} n - Размер n-граммы
   * @returns {Array} - Массив n-грамм
   */
  getNgrams(str, n) {
    const ngrams = [];
    for (let i = 0; i <= str.length - n; i++) {
      ngrams.push(str.substring(i, i + n));
    }
    return ngrams;
  }

  /**
   * Render функция для опции в выпадающем списке
   */
  renderOption(data, escape) {
    // Только листовые категории доступны для выбора
    if (!data.isLeaf) {
      return `<div class="tom-select-option-disabled">
        <span class="category-indent" style="opacity: 0.5;">${this.options.indentChar.repeat(data.level)}</span>
        <span class="category-icon">${this.options.parentPrefix}</span>
        <span class="category-name" style="font-style: italic; opacity: 0.7; font-weight: 600;">${escape(data.name)}</span>
      </div>`;
    }

    return `<div class="tom-select-option">
      <span class="category-indent">${this.options.indentChar.repeat(data.level)}</span>
      <span class="category-icon">${this.options.leafPrefix}</span>
      <span class="category-name">${escape(data.name)}</span>
    </div>`;
  }

  /**
   * Render функция для выбранного элемента
   */
  renderItem(data, escape) {
    const icon = data.isLeaf ? this.options.leafPrefix : this.options.parentPrefix;
    return `<div class="tom-select-item">
      <span class="category-icon">${icon}</span>
      <span class="category-name">${escape(data.name)}</span>
    </div>`;
  }

  /**
   * Обновить отображение полного пути выбранной категории
   */
  updatePathDisplay(categoryId) {
    if (!this.pathDisplayElement) return;

    if (!categoryId) {
      this.pathDisplayElement.textContent = '';
      this.pathDisplayElement.style.display = 'none';
      return;
    }

    const node = this.flatNodes.find(n => n.id === parseInt(categoryId));
    if (node && node.fullPath) {
      this.pathDisplayElement.textContent = node.fullPath;
      this.pathDisplayElement.style.display = 'block';
    } else {
      this.pathDisplayElement.textContent = '';
      this.pathDisplayElement.style.display = 'none';
    }
  }

  /**
   * Проверить загрузку TomSelect библиотеки
   */
  async waitForTomSelect(maxAttempts = 10, delayMs = 100) {
    for (let i = 0; i < maxAttempts; i++) {
      if (typeof TomSelect !== 'undefined') {
        return true;
      }
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
    return false;
  }

  /**
   * Инициализировать Tom Select
   */
  async init() {
    // Check if TomSelect library is loaded with retry mechanism
    const isLoaded = await this.waitForTomSelect();

    if (!isLoaded) {
      const errorMsg = 'TomSelect library not loaded after waiting. Make sure Tom Select CDN script is included in <head> before tomSelectCategoryTree.js';
      console.error(errorMsg);
      console.error('Expected CDN: <script src="https://cdn.jsdelivr.net/npm/tom-select@2.3.1/dist/js/tom-select.complete.min.js"></script>');

      // Fallback: показать стандартный select без Tom Select
      this.selectElement.style.display = 'block';
      throw new Error(errorMsg);
    }

    // Построить дерево
    this.tree = this.buildTree();
    this.flatNodes = this.flattenTree();

    // Найти элемент для отображения пути (если указан)
    if (this.options.pathDisplayElementId) {
      this.pathDisplayElement = document.getElementById(this.options.pathDisplayElementId);
      if (!this.pathDisplayElement) {
        console.warn(`Path display element with id "${this.options.pathDisplayElementId}" not found`);
      }
    }

    // Очистить select и добавить пустую опцию
    this.selectElement.innerHTML = '';
    const emptyOption = document.createElement('option');
    emptyOption.value = '';
    emptyOption.textContent = this.options.emptyOptionText;
    this.selectElement.appendChild(emptyOption);

    // Инициализировать Tom Select с данными через options API
    this.tomSelectInstance = new TomSelect(this.selectElement, {
      // Передача данных напрямую через options вместо DOM parsing
      options: this.flatNodes.map(node => ({
        id: node.id,
        name: node.name,
        level: node.level,
        isLeaf: node.isLeaf,
        fullPath: node.fullPath,
        parentPath: node.parentPath
      })),
      plugins: {
        remove_button: {
          title: 'Удалить'
        }
      },
      valueField: 'id',
      labelField: 'name',
      searchField: ['name', 'fullPath'], // Поиск по имени и полному пути
      maxItems: 1,
      closeAfterSelect: true,
      hideSelected: false,

      // Custom render функции
      render: {
        option: (data, escape) => {
          // data уже содержит все необходимые поля благодаря options API
          return this.renderOption(data, escape);
        },
        item: (data, escape) => {
          // data уже содержит все необходимые поля благодаря options API
          return this.renderItem(data, escape);
        },
        option_create: (data, escape) => {
          return `<div class="create">Добавить <strong>${escape(data.input)}</strong>&hellip;</div>`;
        },
        no_results: () => {
          return '<div class="no-results">Категории не найдены</div>';
        }
      },

      // Custom scoring для fuzzy search
      score: (search) => {
        const self = this;
        return function(item) {
          // item уже содержит все необходимые поля благодаря options API
          // Родительские категории не показывать в результатах поиска
          if (!item.isLeaf && search) return 0;

          return self.fuzzyScore(search, item);
        };
      },

      // Сортировка результатов по score
      sortField: [
        { field: '$score', direction: 'desc' },
        { field: 'name', direction: 'asc' }
      ],

      // Плейсхолдер
      placeholder: this.options.emptyOptionText,

      // Создание новых элементов запрещено
      create: false,

      // Настройки для mobile
      controlInput: null, // Использовать стандартный input
      openOnFocus: true,
      selectOnTab: true,

      // onChange callback
      onChange: (value) => {
        // Обновить отображение пути
        this.updatePathDisplay(value);

        // Trigger change event на оригинальном select для compatibility
        const event = new Event('change', { bubbles: true });
        this.selectElement.dispatchEvent(event);
      }
    });

    // Установить предвыбранное значение если указано
    if (this.options.selectedId) {
      this.tomSelectInstance.setValue(this.options.selectedId, true); // silent = true
      this.updatePathDisplay(this.options.selectedId);
    }

    return this.tomSelectInstance;
  }

  /**
   * Получить выбранную категорию
   */
  getSelectedCategory() {
    if (!this.tomSelectInstance) return null;

    const selectedId = parseInt(this.tomSelectInstance.getValue());
    if (!selectedId) return null;

    return this.flatNodes.find(n => n.id === selectedId) || null;
  }

  /**
   * Установить выбранную категорию
   */
  setSelectedCategory(categoryId) {
    if (!this.tomSelectInstance) return;

    this.tomSelectInstance.setValue(categoryId || '', true); // silent = true
    this.updatePathDisplay(categoryId);
  }

  /**
   * Обновить список категорий и перестроить
   */
  updateCategories(categories) {
    this.categories = categories;

    // Уничтожить текущий Tom Select instance
    if (this.tomSelectInstance) {
      this.tomSelectInstance.destroy();
    }

    // Пересоздать
    this.init();
  }

  /**
   * Проверить, является ли категория листовой (можно выбрать)
   */
  isLeafCategory(categoryId) {
    const node = this.flatNodes.find(n => n.id === categoryId);
    return node ? node.isLeaf : false;
  }

  /**
   * Уничтожить Tom Select instance
   */
  destroy() {
    if (this.tomSelectInstance) {
      this.tomSelectInstance.destroy();
      this.tomSelectInstance = null;
    }
  }
}

// Экспорт для использования
if (typeof window !== 'undefined') {
  window.TomSelectCategoryTree = TomSelectCategoryTree;
}
