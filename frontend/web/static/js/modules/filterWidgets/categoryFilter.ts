export interface CategoryFilterWidget {
  init(elementId: string, articleType?: string | null): void;
  destroy(): void;
  setValue(value: string | null): void;
  clearValue(): void;
  getInstance(): any;
}

export function createCategoryFilterWidget(): CategoryFilterWidget {
  let instance: any = null;

  const widget: CategoryFilterWidget = {
    init(elementId: string, articleType?: string | null): void {
      const ChoicesCategoryTree = (window as any).BudgetShared?.ChoicesCategoryTree;
      if (!ChoicesCategoryTree) return;
      instance = new ChoicesCategoryTree(elementId, {
        ...(articleType ? { type: articleType } : {}),
        multiple: false,
        showPath: true,
        showClearButton: true,
      });
    },

    destroy(): void {
      if (instance?.destroy) {
        instance.destroy();
        instance = null;
      }
    },

    setValue(value: string | null): void {
      if (instance?.setChoiceByValue) {
        instance.setChoiceByValue(value ?? '');
      }
    },

    clearValue(): void {
      widget.setValue(null);
    },

    getInstance(): any {
      return instance;
    },
  };

  return widget;
}
