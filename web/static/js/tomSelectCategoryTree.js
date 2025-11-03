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
      ...options
    };

    this.tomSelectInstance = null;
    this.tree = null;
    this.flatNodes = null;
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
      <div class="category-info">
        <div class="category-name">${escape(data.name)}</div>
        ${data.parentPath.length > 0 ? `<div class="category-path">${escape(data.fullPath)}</div>` : ''}
      </div>
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
   * Инициализировать Tom Select
   */
  init() {
    // Построить дерево
    this.tree = this.buildTree();
    this.flatNodes = this.flattenTree();

    // Очистить select и добавить options
    this.selectElement.innerHTML = '';

    // Пустая опция
    const emptyOption = document.createElement('option');
    emptyOption.value = '';
    emptyOption.textContent = this.options.emptyOptionText;
    this.selectElement.appendChild(emptyOption);

    // Добавить все узлы как опции
    this.flatNodes.forEach(node => {
      const option = document.createElement('option');
      option.value = node.id;
      option.textContent = node.name;

      // Сохранить данные узла в data-атрибутах для Tom Select
      option.setAttribute('data-level', node.level);
      option.setAttribute('data-is-leaf', node.isLeaf);
      option.setAttribute('data-full-path', node.fullPath);
      option.setAttribute('data-parent-path', JSON.stringify(node.parentPath));

      // Disabled для родительских категорий
      if (!node.isLeaf) {
        option.disabled = true;
      }

      // Предвыбранное значение
      if (this.options.selectedId && node.id === this.options.selectedId) {
        option.selected = true;
      }

      this.selectElement.appendChild(option);
    });

    // Инициализировать Tom Select
    this.tomSelectInstance = new TomSelect(this.selectElement, {
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
          // Найти полные данные узла
          const nodeData = this.flatNodes.find(n => n.id === parseInt(data.id));
          if (!nodeData) return `<div>${escape(data.name)}</div>`;
          return this.renderOption(nodeData, escape);
        },
        item: (data, escape) => {
          // Найти полные данные узла
          const nodeData = this.flatNodes.find(n => n.id === parseInt(data.id));
          if (!nodeData) return `<div>${escape(data.name)}</div>`;
          return this.renderItem(nodeData, escape);
        },
        option_create: (data, escape) => {
          return `<div class="create">Добавить <strong>${escape(data.input)}</strong>&hellip;</div>`;
        },
        no_results: () => {
          return '<div class="no-results">Категории не найдены</div>`;
        }
      },

      // Custom scoring для fuzzy search
      score: (search) => {
        const self = this;
        return function(item) {
          // Найти полные данные узла
          const nodeData = self.flatNodes.find(n => n.id === parseInt(item.id));
          if (!nodeData) return 0;

          // Родительские категории не показывать в результатах поиска
          if (!nodeData.isLeaf && search) return 0;

          return self.fuzzyScore(search, nodeData);
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

      // Настройки для desktop
      controlInput: null,
      openOnFocus: true,
      selectOnTab: true,

      // onChange callback
      onChange: (value) => {
        // Trigger change event на оригинальном select для compatibility
        const event = new Event('change', { bubbles: true });
        this.selectElement.dispatchEvent(event);
      }
    });

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
