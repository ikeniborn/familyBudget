import { createCategoryFilterWidget } from '../../../modules/filterWidgets/categoryFilter';

export const factsFilterArticleWidget = createCategoryFilterWidget();

export function initFactsFilterArticle(type?: string | null): void {
  factsFilterArticleWidget.destroy();
  factsFilterArticleWidget.init('#filter-article', type ?? null);
}

export function resetFactsFilterArticle(): void {
  factsFilterArticleWidget.destroy();
  factsFilterArticleWidget.init('#filter-article', null);
}
