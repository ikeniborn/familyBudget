let articleChoicesInstance: any = null;

export function initAnalyticsArticleChoices(
  _articles: Array<{ id: number; name: string; type: string; parent_id: number | null }>,
  articleType: string | null
): void {
  const ChoicesCategoryTree = (window as any).BudgetShared?.ChoicesCategoryTree;
  if (!ChoicesCategoryTree) return;

  if (!articleType) {
    // No type selected — leave plain <select> as-is; destroy any previous widget
    if (articleChoicesInstance?.destroy) {
      articleChoicesInstance.destroy();
      articleChoicesInstance = null;
    }
    return;
  }

  if (articleChoicesInstance?.destroy) {
    articleChoicesInstance.destroy();
    articleChoicesInstance = null;
  }

  articleChoicesInstance = new ChoicesCategoryTree('#analytics-article', {
    type: articleType,
    multiple: false,
    showPath: false,
    showClearButton: true,
    mode: 'create',
  });
}
