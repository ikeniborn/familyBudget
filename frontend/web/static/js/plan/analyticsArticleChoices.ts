let articleChoicesInstance: any = null;

export function initAnalyticsArticleChoices(
  articles: Array<{ id: number; name: string; type: string; parent_id: number | null }>,
  articleType: string | null
): void {
  const ChoicesCategoryTree = (window as any).BudgetShared?.ChoicesCategoryTree;
  if (!ChoicesCategoryTree) return;

  if (articleChoicesInstance?.destroy) {
    articleChoicesInstance.destroy();
    articleChoicesInstance = null;
  }

  articleChoicesInstance = new ChoicesCategoryTree('#analytics-article', {
    ...(articleType ? { type: articleType } : {}),
    multiple: false,
    showPath: false,
    showClearButton: true,
    mode: 'create',
  });

  if (articles.length > 0 && articleChoicesInstance?.setChoices) {
    const mapped = articles.map((a: { id: number; name: string }) => ({ value: String(a.id), label: a.name, customProperties: a }));
    articleChoicesInstance.setChoices(mapped, 'value', 'label', true);
  }
}
