import { createCategoryFilterWidget } from '../../../modules/filterWidgets/categoryFilter';

export const planFilterArticleWidget = createCategoryFilterWidget();

export function initPlanFilterArticle(type?: string | null): void {
  planFilterArticleWidget.destroy();
  planFilterArticleWidget.init('#filter-article', type ?? null);
}

export function resetPlanFilterArticle(): void {
  planFilterArticleWidget.destroy();
  planFilterArticleWidget.init('#filter-article', null);
}
