/**
 * CategoryTreeSelect - компонент для выбора категории из иерархического дерева.
 *
 * Особенности:
 * - Отображает категории в виде дерева с отступами
 * - Родительские категории (имеющие детей) disabled
 * - Можно выбрать только листовые категории (без детей)
 *
 * Использование:
 * const treeSelect = new CategoryTreeSelect(selectElement, categories, options);
 * await treeSelect.render();
 */

class CategoryTreeSelect {
  /**
   * @param {HTMLSelectElement} selectElement - Select элемент для рендеринга
   * @param {Array} categories - Массив категорий из API
   * @param {Object} options - Опции конфигурации
   */
  constructor(selectElement, categories, options = {}) {
    this.selectElement = selectElement;
    this.categories = categories || [];
    this.options = {
      emptyOptionText: 'Выберите категорию',
      showEmptyOption: true,
      filterType: null, // null, 'income', 'expense'
      selectedId: null,
      indentChar: '  ', // Символ для отступа
      parentPrefix: '📁', // Иконка для родителя
      leafPrefix: '📄', // Иконка для листа
      ...options
    };

    // Построить дерево при создании
    this.tree = this.buildTree();
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
    const buildNode = (category, level = 0) => {
      const children = filtered
        .filter(c => c.parent_id === category.id)
        .map(child => buildNode(child, level + 1));

      return {
        ...category,
        level,
        children,
        isLeaf: children.length === 0
      };
    };

    return roots.map(root => buildNode(root));
  }

  /**
   * Flatten tree для рендеринга
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
   * Отрендерить select с опциями
   */
  render() {
    // Очистить текущие опции
    this.selectElement.innerHTML = '';

    // Добавить пустую опцию
    if (this.options.showEmptyOption) {
      const emptyOption = document.createElement('option');
      emptyOption.value = '';
      emptyOption.textContent = this.options.emptyOptionText;
      this.selectElement.appendChild(emptyOption);
    }

    // Получить плоский список
    const flatNodes = this.flattenTree();

    // Создать опции
    flatNodes.forEach(node => {
      const option = document.createElement('option');
      option.value = node.id;

      // Отступ по уровню
      const indent = this.options.indentChar.repeat(node.level);

      // Иконка (родитель/лист)
      const icon = node.isLeaf ? this.options.leafPrefix : this.options.parentPrefix;

      // Текст опции
      option.textContent = `${indent}${icon} ${node.name}`;

      // Disable родительские категории
      if (!node.isLeaf) {
        option.disabled = true;
        option.style.color = 'var(--tg-theme-hint-color)';
        option.style.fontStyle = 'italic';
      }

      // Выбрать если указано
      if (this.options.selectedId && node.id === this.options.selectedId) {
        option.selected = true;
      }

      this.selectElement.appendChild(option);
    });
  }

  /**
   * Получить выбранную категорию
   */
  getSelectedCategory() {
    const selectedId = parseInt(this.selectElement.value);
    if (!selectedId) return null;

    const flatNodes = this.flattenTree();
    return flatNodes.find(n => n.id === selectedId) || null;
  }

  /**
   * Установить выбранную категорию
   */
  setSelectedCategory(categoryId) {
    this.options.selectedId = categoryId;
    this.selectElement.value = categoryId || '';
  }

  /**
   * Обновить список категорий и перерендерить
   */
  updateCategories(categories) {
    this.categories = categories;
    this.tree = this.buildTree();
    this.render();
  }

  /**
   * Проверить, является ли категория листовой (можно выбрать)
   */
  isLeafCategory(categoryId) {
    const flatNodes = this.flattenTree();
    const node = flatNodes.find(n => n.id === categoryId);
    return node ? node.isLeaf : false;
  }
}

// Экспорт для использования
if (typeof window !== 'undefined') {
  window.CategoryTreeSelect = CategoryTreeSelect;
}
